/**
 * Luma Foundry Slack router.
 *
 * Slack is a front end onto the workflow engine, not a place where workflows
 * live. Commands name a *function*; the router resolves it to a workflow in the
 * catalogue and drives the shared engine. Adding a function means adding a
 * workflow — this file does not change.
 *
 * Routing is deliberately deterministic (no LLM). Resolving "/luma hero
 * axiom-grid" to a workflow is a lookup, and paying a model to do a lookup would
 * add cost and latency to every command for no benefit. The LLM enters only when
 * a human asks an open-ended question, which is not a routed command.
 */

import {
  WORKFLOWS,
  advance,
  evaluateExit,
  findWorkflow,
  options,
  startRun,
  type Capability,
  type RunContext,
  type Workflow,
  type WorkflowRun,
} from '@luma/core';

/** A Slack user mapped to platform capabilities. */
export interface Actor {
  slackUserId: string;
  name: string;
  capabilities: Capability[];
}

export interface Command {
  /** e.g. `hero`, `workshop`, `evidence`, `deploy`, `release`, `status`, `gates` */
  verb: string;
  /** e.g. `axiom-grid`, or a run id */
  target?: string;
}

export interface CommandResult {
  ok: boolean;
  /** Slack mrkdwn reply. */
  text: string;
  /** Block Kit blocks, when an interactive prompt is warranted. */
  blocks?: unknown[];
}

/**
 * Verb -> workflow id. This table is the whole of the Slack-to-function mapping.
 * A new function adds one line here and one workflow to the catalogue.
 */
export const VERB_TO_WORKFLOW: Record<string, string> = {
  release: 'product-release',
  hero: 'hero-asset',
  workshop: 'workshop-track',
  deploy: 'automation-deploy',
  evidence: 'evidence-review',
};

/** Parse `/luma <verb> <target...>` into a command. */
export function parseCommand(text: string): Command | null {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  const verb = parts[0];
  if (verb === undefined) return null;
  return { verb: verb.toLowerCase(), target: parts.slice(1).join(' ').toLowerCase() || undefined };
}

/**
 * Resolve a command to the workflow it addresses.
 * Returns null for verbs that are not workflow-backed (`status`, `gates`, `whoami`).
 */
export function resolveWorkflow(cmd: Command): Workflow | null {
  const workflowId = VERB_TO_WORKFLOW[cmd.verb];
  if (!workflowId) return null;
  return findWorkflow(workflowId);
}

/**
 * Run store.
 *
 * In-memory for now, matching the rest of the platform. When persistence lands,
 * this is the one interface to swap — the engine does not care where runs live.
 */
export class RunStore {
  private readonly runs = new Map<string, WorkflowRun>();

  put(run: WorkflowRun): WorkflowRun {
    this.runs.set(run.id, run);
    return run;
  }

  get(id: string): WorkflowRun | undefined {
    return this.runs.get(id);
  }

  /** The most recent open run for a target (a product route or name). */
  forTarget(target: string): WorkflowRun | undefined {
    const matches = [...this.runs.values()].filter(
      (r) => r.productId === target || r.goalId === target,
    );
    return matches.at(-1);
  }

  all(): WorkflowRun[] {
    return [...this.runs.values()];
  }

  byWorkflow(workflowId: string): WorkflowRun[] {
    return this.all().filter((r) => r.workflowId === workflowId);
  }
}

/** Everything the router needs from the outside world. */
export interface RouterDeps {
  store: RunStore;
  /** Context for a target: what evidence, approvals, artifacts exist. */
  contextFor: (target: string) => RunContext;
  /** Resolve a Slack user to an actor. Unknown users get no capabilities. */
  actorFor: (slackUserId: string) => Actor;
  /** Monotonic id source, injectable for tests. */
  nextId: () => string;
  now?: () => string;
}

/**
 * Handle a parsed command.
 *
 * Every branch that moves work calls `advance()`, which enforces gates and
 * capabilities. The router never writes state directly — that is what keeps a
 * flexible command surface from becoming a way around the rules.
 */
export function handle(cmd: Command, slackUserId: string, deps: RouterDeps): CommandResult {
  const actor = deps.actorFor(slackUserId);
  const now = deps.now?.() ?? new Date().toISOString();

  // ---- Read-only verbs -------------------------------------------------

  if (cmd.verb === 'whoami') {
    return {
      ok: true,
      text:
        `*${actor.name}* holds: ` +
        (actor.capabilities.length
          ? actor.capabilities.map((c) => `\`${c}\``).join(', ')
          : '_none_'),
    };
  }

  if (cmd.verb === 'status') {
    const runs = deps.store.all();
    if (runs.length === 0) return { ok: true, text: '_No open runs._' };

    const byWorkflow = new Map<string, WorkflowRun[]>();
    for (const run of runs) {
      byWorkflow.set(run.workflowId, [...(byWorkflow.get(run.workflowId) ?? []), run]);
    }

    const lines = [...byWorkflow.entries()].map(([workflowId, group]) => {
      const wf = findWorkflow(workflowId);
      const rows = group
        .map((r) => `    • \`${r.id}\` → *${r.currentStageId}* (${r.productId ?? r.goalId})`)
        .join('\n');
      return `*${wf.name}* — ${group.length}\n${rows}`;
    });

    return { ok: true, text: lines.join('\n\n') };
  }

  if (cmd.verb === 'gates') {
    if (!cmd.target) return { ok: false, text: 'Usage: `/luma gates <target>`' };
    const run = deps.store.forTarget(cmd.target);
    if (!run) return { ok: false, text: `No open run for \`${cmd.target}\`.` };

    const wf = findWorkflow(run.workflowId);
    const stage = wf.stages.find((s) => s.id === run.currentStageId);
    if (!stage) return { ok: false, text: `Run ${run.id} is in an unknown stage.` };

    const report = evaluateExit(stage, deps.contextFor(cmd.target));
    if (report.clear) {
      const opts = options(wf, run, actor.capabilities, deps.contextFor(cmd.target));
      const reachable = opts
        .filter((o) => o.reachable)
        .map((o) => `\`${o.stage}\``)
        .join(', ');
      return {
        ok: true,
        text: `*${wf.name}* @ \`${stage.id}\` — no blockers. Can move to: ${reachable || '_none_'}`,
      };
    }

    return {
      ok: true,
      text:
        `*${wf.name}* @ \`${stage.id}\` — blocked:\n` +
        report.blockers.map((b) => `  • ${b}`).join('\n'),
    };
  }

  // ---- Workflow-backed verbs ------------------------------------------

  const wf = resolveWorkflow(cmd);
  if (!wf) {
    const known = Object.keys(VERB_TO_WORKFLOW).join(', ');
    return {
      ok: false,
      text: `Unknown function \`${cmd.verb}\`. Known: ${known}, status, gates, whoami.`,
    };
  }

  if (!cmd.target) {
    return { ok: false, text: `Usage: \`/luma ${cmd.verb} <target>\`` };
  }

  const existing = deps.store.forTarget(cmd.target);
  const context = deps.contextFor(cmd.target);

  // No run yet -> start one at the workflow's entry stage.
  if (!existing || existing.workflowId !== wf.id) {
    try {
      const run = startRun(wf, {
        id: deps.nextId(),
        goalId: cmd.target,
        productId: cmd.target,
        actor: actor.name,
        capabilities: actor.capabilities,
        now,
      });
      deps.store.put(run);
      return {
        ok: true,
        text:
          `Started *${wf.name}* for \`${cmd.target}\` at \`${wf.entry}\`.\n` +
          `_${wf.purpose}_\nRun \`${run.id}\`.`,
      };
    } catch (error) {
      return { ok: false, text: `Could not start: ${(error as Error).message}` };
    }
  }

  // Run exists -> advance to the next reachable stage.
  const opts = options(wf, existing, actor.capabilities, context);
  const reachable = opts.filter((o) => o.reachable);

  if (reachable.length === 0) {
    const blockers = opts.flatMap((o) => o.blockers);
    return {
      ok: false,
      text:
        `Cannot advance \`${cmd.target}\` from \`${existing.currentStageId}\`.\n` +
        (blockers.length
          ? blockers.map((b) => `  • ${b}`).join('\n')
          : '  • no declared next stage'),
    };
  }

  // If the command names a stage explicitly, prefer it; otherwise take the first.
  const chosen = reachable[0];
  if (!chosen) {
    return { ok: false, text: `No reachable next stage for \`${cmd.target}\`.` };
  }

  try {
    const moved = advance(wf, existing, {
      to: chosen.stage,
      actor: actor.name,
      capabilities: actor.capabilities,
      context,
      now,
    });
    deps.store.put(moved);

    const nextOpts = options(wf, moved, actor.capabilities, context);
    const next = nextOpts.filter((o) => o.reachable).map((o) => `\`${o.stage}\``);

    return {
      ok: true,
      text:
        `\`${cmd.target}\`: \`${existing.currentStageId}\` → *\`${moved.currentStageId}\`* ` +
        `by ${actor.name}.\nNext: ${next.join(', ') || '_none — end of workflow_'}`,
    };
  } catch (error) {
    return { ok: false, text: `Blocked: ${(error as Error).message}` };
  }
}

/** Every workflow, for a `/luma help` listing. */
export function catalogue(): Array<{ id: string; name: string; purpose: string }> {
  return WORKFLOWS.map((w) => ({ id: w.id, name: w.name, purpose: w.purpose }));
}
