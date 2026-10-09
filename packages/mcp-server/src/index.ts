/**
 * Luma Foundry MCP server.
 *
 * Exposes the workshop platform as Model Context Protocol tools so any MCP
 * client — Manus, OpenHands, Claude, an IDE — can drive the same evidence-gated
 * pipeline the operators use by hand.
 *
 * Transport: stdio by default (co-located with the client). For a hosted,
 * multi-tenant deployment use Streamable HTTP and see docs/MCP.md.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import {
  CAPABILITIES,
  DECISION_STATUSES,
  EVIDENCE_KINDS,
  PRIORITIES,
  PRODUCT_STATUSES,
  ROLES,
  WORKFLOWS,
  WORK_ITEM_STATUSES,
AsyncWorkspace,
  advance,
  evaluateClearance,
  evaluateExit,
  findWorkflow,
  options,
  startRun,
  type Capability,
  type Role,
  type RunContext,
  type WorkflowRun,
} from '@luma/core';

export const SERVER_NAME = 'luma-foundry';
export const SERVER_VERSION = '0.1.0';

/**
 * Workflow runs started through the MCP surface.
 *
 * Kept beside the workspace for the same reason: process-local, swappable behind
 * an interface when persistence lands.
 */
const workflowRuns = new Map<string, WorkflowRun>();

/** Evidence recorded for a product, as the workflow engine expects it. */
async function contextFor(ws: AsyncWorkspace, productId: string): Promise<RunContext> {
  const snap = await ws.snapshot();
  const product = snap.products.find((p) => p.id === productId);
  const evidence = (await ws.evidenceFor(productId)).map((e) => e.kind);
  const decisions = snap.decisions.filter(
    (d) => d.productId === productId && d.status === 'approved' && d.decidedBy,
  );
  return {
    evidence,
    approvals: [
      ...new Set(
        decisions
          .map((d) => d.decidedBy)
          .filter((role): role is Role => role !== null),
      ),
    ],
    artifacts: product && product.status !== 'concept' ? ['build'] : [],
  };
}

/** Wrap a tool result as MCP text content. */
function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/**
 * Build the server around a workspace instance. Kept as a factory so tests can
 * construct an isolated server per case.
 */
export function createServer(
  ws: AsyncWorkspace = AsyncWorkspace.fromInMemory(),
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        'Luma Foundry workshop platform. Manage goals, products, work items, ' +
        'handoffs, and decisions for AI product builds. Governance rule: a product ' +
        'can only be marked "cleared" when all required evidence is recorded. ' +
        'Traceability alone (source commit, SBOM) never grants clearance.',
    },
  );

  server.registerTool(
    'snapshot',
    {
      title: 'Workspace snapshot',
      description: 'Return the full workspace state: goals, products, work items, handoffs, decisions, evidence.',
      inputSchema: {},
    },
    async () => ok(await ws.snapshot()),
  );

  server.registerTool(
    'create_goal',
    {
      title: 'Create goal',
      description: 'Create an outcome goal. Everything else hangs off a goal.',
      inputSchema: {
        ownerId: z.string().describe('User id of the goal owner'),
        title: z.string().min(1),
        outcome: z.string().min(1).describe('The measurable outcome'),
        priority: z.enum(PRIORITIES).optional(),
        targetDate: z.string().optional().describe('ISO date'),
      },
    },
    async (args) => {
      try {
        return ok(await ws.createGoal(args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_product',
    {
      title: 'Create product',
      description: 'Add a product to a goal. Products start in "concept" status.',
      inputSchema: {
        goalId: z.string(),
        name: z.string().min(1),
        category: z.string().min(1),
        route: z.string().min(1).describe('Public route, e.g. /axiom-grid'),
      },
    },
    async (args) => {
      try {
        return ok(await ws.createProduct(args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_work_item',
    {
      title: 'Create work item',
      description: 'Create a unit of build or review work and assign it to a role.',
      inputSchema: {
        goalId: z.string(),
        productId: z.string().optional(),
        type: z.string().min(1).describe('e.g. build, review, evidence, research'),
        assignedTo: z.enum(ROLES),
        title: z.string().min(1),
        detail: z.string().min(1),
        priority: z.enum(PRIORITIES).optional(),
      },
    },
    async (args) => {
      try {
        return ok(await ws.createWorkItem(args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_work_item_status',
    {
      title: 'Update work item status',
      inputSchema: {
        workItemId: z.string(),
        status: z.enum(WORK_ITEM_STATUSES),
      },
    },
    async ({ workItemId, status }) => {
      try {
        return ok(await ws.updateWorkItemStatus(workItemId, status));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_handoff',
    {
      title: 'Create handoff',
      description:
        'Record a handoff between roles. Operator A builds; Operator B reviews and gates. ' +
        'Operator B never edits product code — evidence and data handoff only.',
      inputSchema: {
        goalId: z.string(),
        productId: z.string().optional(),
        fromRole: z.enum(ROLES),
        toRole: z.enum(ROLES),
        title: z.string().min(1),
        summary: z.string().min(1),
        asks: z.string().min(1).describe('What the receiving role must do'),
      },
    },
    async (args) => {
      try {
        return ok(await ws.createHandoff(args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'create_decision',
    {
      title: 'Create decision',
      description: 'Raise a decision that must be explicitly approved or declined. Decisions stay open until resolved.',
      inputSchema: {
        goalId: z.string(),
        productId: z.string().optional(),
        title: z.string().min(1),
        context: z.string().min(1),
        decision: z.string().min(1),
        ownerId: z.string(),
      },
    },
    async (args) => {
      try {
        return ok(await ws.createDecision(args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'update_decision_status',
    {
      title: 'Resolve decision',
      inputSchema: {
        decisionId: z.string(),
        status: z.enum(DECISION_STATUSES),
        decidedBy: z.enum(ROLES).describe('The role resolving this decision'),
      },
    },
    async ({ decisionId, status, decidedBy }) => {
      try {
        return ok(await ws.updateDecisionStatus(decisionId, status, decidedBy));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'record_evidence',
    {
      title: 'Record evidence',
      description:
        'Attach a piece of release evidence to a product. Traceability kinds ' +
        '(source_commit, dependency_sbom) never on their own justify clearance.',
      inputSchema: {
        productId: z.string(),
        kind: z.enum(EVIDENCE_KINDS),
        reference: z.string().min(1).describe('URL, commit SHA, or file reference'),
        note: z.string().min(1),
        recordedBy: z.enum(ROLES),
      },
    },
    async (args) => {
      try {
        return ok(await ws.recordEvidence(args));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'check_clearance',
    {
      title: 'Check product clearance',
      description:
        'Evaluate whether a product has the evidence required to be commercially cleared. ' +
        'Returns present evidence, missing evidence, and blockers. Call this before any clearance decision.',
      inputSchema: { productId: z.string() },
    },
    async ({ productId }) => {
      try {
        const snap = await ws.snapshot();
        const product = snap.products.find((p) => p.id === productId);
        if (!product) return fail(new Error(`Unknown product: ${productId}`));
        const evidence = await ws.evidenceFor(productId);
        return ok(evaluateClearance(product, evidence));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'set_product_status',
    {
      title: 'Set product status',
      description:
        'Change a product status. Setting "cleared" is guarded — it throws unless every ' +
        'required evidence kind is recorded. Run check_clearance first.',
      inputSchema: {
        productId: z.string(),
        status: z.enum(PRODUCT_STATUSES),
      },
    },
    async ({ productId, status }) => {
      try {
        return ok(await ws.updateProductStatus(productId, status));
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'list_workflows',
    {
      title: 'List workflows',
      description:
        'List the platform functions (workflows) and their stages. Use this to discover what ' +
        'can be run before calling start_workflow.',
      inputSchema: {},
    },
    async () =>
      ok(
        WORKFLOWS.map((w) => ({
          id: w.id,
          name: w.name,
          purpose: w.purpose,
          entry: w.entry,
          stages: w.stages.map((s) => ({
            id: s.id,
            name: s.name,
            requires: s.requires,
            gates: s.gates.map((g) => g.label),
          })),
        })),
      ),
  );

  server.registerTool(
    'start_workflow',
    {
      title: 'Start workflow',
      description:
        'Start a function (workflow) for a product. Fails if the actor lacks the entry ' +
        'capability. Returns the run id and the stages reachable next.',
      inputSchema: {
        workflowId: z.string().describe('e.g. hero-asset, workshop-track, evidence-review'),
        productId: z.string(),
        actor: z.string().describe('Who is acting, e.g. "Manus"'),
        capabilities: z.array(z.enum(CAPABILITIES)).describe('Capabilities the actor holds'),
      },
    },
    async ({ workflowId, productId, actor, capabilities }) => {
      try {
        const wf = findWorkflow(workflowId);
        const run = startRun(wf, {
          id: `run-${workflowRuns.size + 1}`,
          goalId: productId,
          productId,
          actor,
          capabilities: capabilities as Capability[],
        });
        workflowRuns.set(run.id, run);
        return ok({
          runId: run.id,
          workflow: wf.id,
          stage: run.currentStageId,
          next: options(wf, run, capabilities as Capability[], await contextFor(ws, productId)),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'advance_workflow',
    {
      title: 'Advance workflow',
      description:
        "Move a run to another stage. The engine enforces the current stage's gates and the " +
        'target stage\'s capabilities — there is no force flag. Returns the blockers if refused.',
      inputSchema: {
        runId: z.string(),
        to: z.string().describe('Target stage id'),
        actor: z.string(),
        capabilities: z.array(z.enum(CAPABILITIES)),
      },
    },
    async ({ runId, to, actor, capabilities }) => {
      try {
        const run = workflowRuns.get(runId);
        if (!run) return fail(new Error(`Unknown run: ${runId}`));
        const wf = findWorkflow(run.workflowId);
        const productId = run.productId ?? run.goalId;
        const moved = advance(wf, run, {
          to,
          actor,
          capabilities: capabilities as Capability[],
          context: await contextFor(ws, productId),
        });
        workflowRuns.set(moved.id, moved);
        return ok({
          runId: moved.id,
          stage: moved.currentStageId,
          history: moved.history.map((h) => ({ stage: h.stageId, by: h.enteredBy })),
          next: options(wf, moved, capabilities as Capability[], await contextFor(ws, productId)),
        });
      } catch (e) {
        return fail(e);
      }
    },
  );

  server.registerTool(
    'workflow_gates',
    {
      title: 'Workflow gates',
      description:
        'Read-only: exactly what is blocking a run, and what it may move to next. Never mutates.',
      inputSchema: { runId: z.string() },
    },
    async ({ runId }) => {
      try {
        const run = workflowRuns.get(runId);
        if (!run) return fail(new Error(`Unknown run: ${runId}`));
        const wf = findWorkflow(run.workflowId);
        const stage = wf.stages.find((s) => s.id === run.currentStageId);
        if (!stage) return fail(new Error(`Unknown stage: ${run.currentStageId}`));
        return ok(evaluateExit(stage, await contextFor(ws, run.productId ?? run.goalId)));
      } catch (e) {
        return fail(e);
      }
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} MCP server v${SERVER_VERSION} running on stdio`);
}

// Only start stdio when executed directly, not when imported by tests.
const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (invokedDirectly) {
  main().catch((error) => {
    console.error('Fatal error starting Luma MCP server:', error);
    process.exit(1);
  });
}
