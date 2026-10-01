/**
 * Bot gateway.
 *
 * A platform-agnostic command router over the workflow engine. Telegram,
 * Discord, Slack and any future surface are adapters that translate their wire
 * format into a `BotCommand` and render a `BotReply` back; the routing and the
 * governance live here, once.
 *
 * The reason for a gateway rather than one bot per platform: the platform is
 * not the product. If governance lived in the Telegram adapter, adding Discord
 * would create a second place where gates could be bypassed. Here there is one
 * place, and every adapter inherits it.
 */

import {
  WORKFLOWS,
  advance,
  auditProduct,
  evaluateExit,
  findProduct,
  findWorkflow,
  options,
  startRun,
  type Capability,
  type RunContext,
  type Workflow,
  type WorkflowRun,
} from '@luma/core';

/** A platform user mapped to platform capabilities. */
export interface BotActor {
  /** Stable platform-scoped id (Telegram user id, Discord id, Slack id). */
  externalId: string;
  name: string;
  capabilities: Capability[];
}

/** Which platform a message arrived on. */
export type Platform = 'telegram' | 'discord' | 'slack' | 'web' | 'cli';

export interface BotCommand {
  platform: Platform;
  externalId: string;
  /** Raw command text, e.g. `hero axiom-grid`. */
  text: string;
}

export interface BotReply {
  ok: boolean;
  /** Plain text with minimal markdown; each adapter renders it its own way. */
  text: string;
  /** Suggested follow-up commands, for platforms that render buttons. */
  suggestions?: string[];
}

/** The whole of the command surface. Adding a verb is one line here. */
export const VERB_TO_WORKFLOW: Record<string, string> = {
  release: 'product-release',
  hero: 'hero-asset',
  workshop: 'workshop-track',
  deploy: 'automation-deploy',
  evidence: 'evidence-review',
};

const READ_ONLY_VERBS = ['status', 'gates', 'whoami', 'catalogue', 'licence', 'help'] as const;

export interface ParsedCommand {
  verb: string;
  target?: string;
}

export function parseCommand(text: string): ParsedCommand | null {
  const parts = text.trim().replace(/^\/\w+@?\w*\s*/, '').split(/\s+/).filter(Boolean);
  const verb = parts[0];
  if (verb === undefined) return null;
  return { verb: verb.toLowerCase(), target: parts.slice(1).join(' ').toLowerCase() || undefined };
}

export function resolveWorkflow(cmd: ParsedCommand): Workflow | null {
  const workflowId = VERB_TO_WORKFLOW[cmd.verb];
  if (!workflowId) return null;
  return findWorkflow(workflowId);
}

/** Persistence for open runs. In-memory here; swap for a store without touching routing. */
export class RunStore {
  private readonly runs = new Map<string, WorkflowRun>();

  put(run: WorkflowRun): WorkflowRun {
    this.runs.set(run.id, run);
    return run;
  }

  get(id: string): WorkflowRun | undefined {
    return this.runs.get(id);
  }

  forTarget(target: string): WorkflowRun | undefined {
    const matches = [...this.runs.values()].filter(
      (r) => r.productId === target || r.goalId === target,
    );
    return matches.at(-1);
  }

  all(): WorkflowRun[] {
    return [...this.runs.values()];
  }
}

export interface GatewayDeps {
  store: RunStore;
  contextFor: (target: string) => RunContext;
  actorFor: (platform: Platform, externalId: string) => BotActor;
  nextId: () => string;
  now?: () => string;
}

function fmtCaps(caps: Capability[]): string {
  return caps.length ? caps.map((c) => `\`${c}\``).join(', ') : '_none_';
}

/**
 * Handle one command.
 *
 * Every branch that moves work calls `advance()`. The gateway never writes run
 * state directly — that is what stops a convenient command surface from
 * becoming a way around the gates.
 */
export function handle(cmd: BotCommand, deps: GatewayDeps): BotReply {
  const actor = deps.actorFor(cmd.platform, cmd.externalId);
  const now = deps.now?.() ?? new Date().toISOString();
  const parsed = parseCommand(cmd.text);

  if (!parsed) {
    return { ok: true, text: 'Send a command. Try `help`.', suggestions: ['help'] };
  }

  const { verb, target } = parsed;

  // ---- Read-only verbs -------------------------------------------------

  if (verb === 'help') {
    const verbs = Object.keys(VERB_TO_WORKFLOW).join(', ');
    return {
      ok: true,
      text:
        '*Luma Foundry*\n\n' +
        `Functions: \`${verbs}\`\n` +
        `Read-only: \`${READ_ONLY_VERBS.join('`, `')}\`\n\n` +
        'Usage: `<function> <product-route>` — e.g. `hero axiom-grid`\n' +
        'Check blockers first with `gates <route>`.',
      suggestions: ['catalogue', 'status'],
    };
  }

  if (verb === 'whoami') {
    return { ok: true, text: `*${actor.name}* holds: ${fmtCaps(actor.capabilities)}` };
  }

  if (verb === 'catalogue') {
    const lines = WORKFLOWS.map((w) => `• *${w.name}* (\`${w.id}\`) — ${w.purpose}`);
    return { ok: true, text: `*Workflows*\n${lines.join('\n')}` };
  }

  if (verb === 'licence') {
    if (!target) {
      return { ok: false, text: 'Usage: `licence <product-route>` — e.g. `licence axiom-grid`' };
    }
    const audit = auditProduct(target);
    if (!audit) return { ok: false, text: `Unknown product \`${target}\`.` };

    if (audit.clear) {
      return {
        ok: true,
        text: `*${audit.product.name}* — typefaces are resale-safe:\n` +
          audit.findings.map((f) => `  • ${f.name} — ${f.licence}`).join('\n'),
      };
    }

    const bad = [...audit.blocked, ...audit.unknown];
    const detail = bad
      .map((f) => {
        const swap = f.replacements.length ? ` → use ${f.replacements.join(' or ')}` : '';
        return `  • *${f.name}* (${f.licence})${swap}`;
      })
      .join('\n');
    return {
      ok: false,
      text: `*${audit.product.name}* — ${bad.length} typeface(s) block resale:\n${detail}`,
    };
  }

  if (verb === 'status') {
    const runs = deps.store.all();
    if (runs.length === 0) return { ok: true, text: '_No open runs._' };

    const lines = runs.map((r) => {
      const wf = findWorkflow(r.workflowId);
      return `• \`${r.id}\` *${wf?.name ?? r.workflowId}* → \`${r.currentStageId}\` (${r.productId ?? r.goalId})`;
    });
    return { ok: true, text: `*Open runs* — ${runs.length}\n${lines.join('\n')}` };
  }

  if (verb === 'gates') {
    if (!target) return { ok: false, text: 'Usage: `gates <product-route>`' };
    const run = deps.store.forTarget(target);
    if (!run) return { ok: false, text: `No open run for \`${target}\`. Start one first.` };

    const wf = findWorkflow(run.workflowId);
    const stage = wf?.stages.find((s) => s.id === run.currentStageId);
    if (!wf || !stage) return { ok: false, text: `Run \`${run.id}\` is in an unknown stage.` };

    const report = evaluateExit(stage, deps.contextFor(target));
    if (report.clear) {
      const reachable = options(wf, run, actor.capabilities, deps.contextFor(target))
        .filter((o) => o.reachable)
        .map((o) => `\`${o.stage}\``);
      return {
        ok: true,
        text: `*${wf.name}* @ \`${stage.id}\` — clear. Can move to: ${reachable.join(', ') || '_none_'}`,
      };
    }
    return {
      ok: false,
      text: `*${wf.name}* @ \`${stage.id}\` — blocked:\n` +
        report.blockers.map((b) => `  • ${b}`).join('\n'),
    };
  }

  // ---- Workflow-backed verbs ------------------------------------------

  const wf = resolveWorkflow(parsed);
  if (!wf) {
    return {
      ok: false,
      text: `Unknown function \`${verb}\`. Try \`help\`.`,
      suggestions: ['help', 'catalogue'],
    };
  }

  if (!target) {
    return { ok: false, text: `Usage: \`${verb} <product-route>\`` };
  }

  // A route outside the catalogue is allowed (the platform is not only for the
  // 50), but say so, because it usually means a typo.
  const known = findProduct(target) !== undefined;
  const note = known ? '' : `\n_Note: \`${target}\` is not in the catalogue._`;

  const existing = deps.store.forTarget(target);
  const context = deps.contextFor(target);

  if (!existing || existing.workflowId !== wf.id) {
    try {
      const run = startRun(wf, {
        id: deps.nextId(),
        goalId: target,
        productId: target,
        actor: actor.name,
        capabilities: actor.capabilities,
        now,
      });
      deps.store.put(run);
      return {
        ok: true,
        text:
          `Started *${wf.name}* for \`${target}\` at \`${wf.entry}\`.${note}\n` +
          `Run \`${run.id}\`.\nNext: check \`gates ${target}\`.`,
        suggestions: [`gates ${target}`],
      };
    } catch (error) {
      return { ok: false, text: `Could not start: ${(error as Error).message}` };
    }
  }

  const opts = options(wf, existing, actor.capabilities, context);
  const reachable = opts.filter((o) => o.reachable);

  if (reachable.length === 0) {
    const blockers = opts.flatMap((o) => o.blockers);
    return {
      ok: false,
      text:
        `Cannot advance \`${target}\` from \`${existing.currentStageId}\`.\n` +
        (blockers.length
          ? blockers.map((b) => `  • ${b}`).join('\n')
          : '  • no declared next stage'),
    };
  }

  const chosen = reachable[0]!;
  try {
    const moved = advance(wf, existing, {
      to: chosen.stage,
      actor: actor.name,
      capabilities: actor.capabilities,
      context,
      now,
    });
    deps.store.put(moved);

    const next = options(wf, moved, actor.capabilities, context)
      .filter((o) => o.reachable)
      .map((o) => `\`${o.stage}\``);

    return {
      ok: true,
      text:
        `\`${target}\`: \`${existing.currentStageId}\` → *\`${moved.currentStageId}\`* ` +
        `by ${actor.name}.\nNext: ${next.join(', ') || '_end of workflow_'}`,
      suggestions: next.length ? [`gates ${target}`] : [],
    };
  } catch (error) {
    return { ok: false, text: `Blocked: ${(error as Error).message}` };
  }
}
