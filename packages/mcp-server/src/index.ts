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
  DECISION_STATUSES,
  EVIDENCE_KINDS,
  PRIORITIES,
  PRODUCT_STATUSES,
  ROLES,
  WORK_ITEM_STATUSES,
  Workspace,
  evaluateClearance,
} from '@luma/core';

export const SERVER_NAME = 'luma-foundry';
export const SERVER_VERSION = '0.1.0';

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
export function createServer(ws: Workspace = new Workspace()): McpServer {
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
    async () => ok(ws.snapshot()),
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
        return ok(ws.createGoal(args));
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
        return ok(ws.createProduct(args));
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
        return ok(ws.createWorkItem(args));
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
        return ok(ws.updateWorkItemStatus(workItemId, status));
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
        return ok(ws.createHandoff(args));
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
        return ok(ws.createDecision(args));
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
      },
    },
    async ({ decisionId, status }) => {
      try {
        return ok(ws.updateDecisionStatus(decisionId, status));
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
        return ok(ws.recordEvidence(args));
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
        const snap = ws.snapshot();
        const product = snap.products.find((p) => p.id === productId);
        if (!product) return fail(new Error(`Unknown product: ${productId}`));
        return ok(evaluateClearance(product, ws.evidenceFor(productId)));
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
        return ok(ws.updateProductStatus(productId, status));
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
