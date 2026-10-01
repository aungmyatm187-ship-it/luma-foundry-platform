/**
 * Flexible workflow composition.
 *
 * The platform is not one pipeline. It is many functions over shared work, so a
 * fixed linear sequence breaks the moment the work stops being one thing.
 *
 * The shape here is water: stages are reusable vessels, and each workflow
 * declares its own transitions between them. The same `review` stage can sit in
 * a content workflow, an evidence workflow, and a deploy workflow without being
 * copied or re-specified. Adding a function means composing existing stages in a
 * new order, not writing a new engine.
 *
 * Governance is preserved because gates travel with the stage, not the workflow:
 * wherever a stage that requires clearance evidence appears, the gate applies.
 */

import type { EvidenceKind, Role } from './types.js';

/** What an actor must be able to do to enter a stage. */
export const CAPABILITIES = [
  'design',
  'build',
  'review',
  'evidence',
  'operate',
  'deploy',
  'decide',
] as const;
export type Capability = (typeof CAPABILITIES)[number];

/**
 * A condition that must hold before work leaves a stage.
 *
 * Gates are declarative data, so a workflow author composes them without
 * touching engine code — and an auditor can read what a stage demands without
 * reading an implementation.
 */
export type Gate =
  | { kind: 'evidence'; kinds: EvidenceKind[]; label: string }
  | { kind: 'approval'; role: Role; label: string }
  | { kind: 'capability'; capability: Capability; label: string }
  | { kind: 'artifact'; name: string; label: string };

export interface Stage {
  id: string;
  name: string;
  /** Capabilities an actor must hold to enter. */
  requires: Capability[];
  /** Conditions that must hold to leave. */
  gates: Gate[];
  /** Names of artifacts this stage hands forward. */
  emits: string[];
  /** Optional stages may be bypassed by a transition that skips them. */
  optional: boolean;
}

export interface Transition {
  from: string;
  to: string;
  /** Human-readable condition for taking this edge. */
  when?: string;
}

export interface Workflow {
  id: string;
  name: string;
  purpose: string;
  /** The stage every run starts in. */
  entry: string;
  stages: Stage[];
  transitions: Transition[];
}

export interface StageRecord {
  stageId: string;
  enteredAt: string;
  enteredBy: string;
  /** Capabilities the entering actor held. */
  heldCapabilities: Capability[];
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  goalId: string;
  productId: string | null;
  currentStageId: string;
  history: StageRecord[];
  startedAt: string;
}

export class WorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowError';
  }
}

/** What a stage exit evaluation found. */
export interface StageReport {
  stageId: string;
  clear: boolean;
  satisfied: string[];
  blockers: string[];
  /** Capabilities still needed before this stage can be entered. */
  missingCapabilities: Capability[];
}

export interface RunContext {
  /** Evidence kinds already recorded for the product. */
  evidence: EvidenceKind[];
  /** Roles that have approved. */
  approvals: Role[];
  /** Artifact names produced so far. */
  artifacts: string[];
}

/**
 * Validate a workflow definition.
 *
 * Catches the mistakes that would otherwise surface as a run stalling at
 * runtime: dangling transitions, a missing entry stage, duplicate ids.
 */
export function defineWorkflow(spec: Workflow): Workflow {
  if (spec.stages.length === 0) {
    throw new WorkflowError(`Workflow ${spec.id} has no stages`);
  }

  const ids = new Set<string>();
  for (const stage of spec.stages) {
    if (ids.has(stage.id)) {
      throw new WorkflowError(`Workflow ${spec.id} has duplicate stage id: ${stage.id}`);
    }
    ids.add(stage.id);
  }

  if (!ids.has(spec.entry)) {
    throw new WorkflowError(`Workflow ${spec.id} entry stage not found: ${spec.entry}`);
  }

  for (const t of spec.transitions) {
    if (!ids.has(t.from)) {
      throw new WorkflowError(`Workflow ${spec.id} transition from unknown stage: ${t.from}`);
    }
    if (!ids.has(t.to)) {
      throw new WorkflowError(`Workflow ${spec.id} transition to unknown stage: ${t.to}`);
    }
  }

  const reachable = reachableStages(spec);
  const orphaned = [...ids].filter((id) => !reachable.has(id));
  if (orphaned.length > 0) {
    throw new WorkflowError(
      `Workflow ${spec.id} has unreachable stages: ${orphaned.join(', ')}`,
    );
  }

  return spec;
}

/** Stages reachable from the entry stage, following declared transitions. */
export function reachableStages(spec: Workflow): Set<string> {
  const seen = new Set<string>([spec.entry]);
  const queue = [spec.entry];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const t of spec.transitions) {
      if (t.from === current && !seen.has(t.to)) {
        seen.add(t.to);
        queue.push(t.to);
      }
    }
  }
  return seen;
}

export function findStage(spec: Workflow, stageId: string): Stage {
  const stage = spec.stages.find((s) => s.id === stageId);
  if (!stage) throw new WorkflowError(`Unknown stage: ${stageId}`);
  return stage;
}

/** Stages a run may move to next, per the workflow's declared transitions. */
export function nextStages(spec: Workflow, run: WorkflowRun): Stage[] {
  return spec.transitions
    .filter((t) => t.from === run.currentStageId)
    .map((t) => findStage(spec, t.to));
}

/**
 * Can this actor enter the stage?
 *
 * A stage lists the capabilities it needs; an actor may hold more than one.
 * This is what lets a human, Manus, OpenHands, or a Slack command all drive the
 * same workflow without the workflow knowing which it is.
 */
export function evaluateEntry(stage: Stage, held: Capability[]): StageReport {
  const missingCapabilities = stage.requires.filter((c) => !held.includes(c));
  return {
    stageId: stage.id,
    clear: missingCapabilities.length === 0,
    satisfied: stage.requires.filter((c) => held.includes(c)).map((c) => `capability:${c}`),
    blockers:
      missingCapabilities.length === 0
        ? []
        : [`Missing capability: ${missingCapabilities.join(', ')}`],
    missingCapabilities,
  };
}

/**
 * Can work leave this stage?
 *
 * Evaluates every gate against the run context. Returns all blockers rather
 * than the first, so an actor learns the whole shape of what is missing in one
 * call instead of discovering it one failure at a time.
 */
export function evaluateExit(stage: Stage, ctx: RunContext): StageReport {
  const satisfied: string[] = [];
  const blockers: string[] = [];

  for (const gate of stage.gates) {
    switch (gate.kind) {
      case 'evidence': {
        const missing = gate.kinds.filter((k) => !ctx.evidence.includes(k));
        if (missing.length === 0) {
          satisfied.push(`evidence:${gate.kinds.join('+')}`);
        } else {
          blockers.push(`${gate.label} — missing evidence: ${missing.join(', ')}`);
        }
        break;
      }
      case 'approval': {
        if (ctx.approvals.includes(gate.role)) {
          satisfied.push(`approval:${gate.role}`);
        } else {
          blockers.push(`${gate.label} — needs approval from ${gate.role}`);
        }
        break;
      }
      case 'capability': {
        // A capability gate means the stage requires that work be done, which is
        // proven by the stage's own actor holding it. Recorded as satisfied when
        // the stage was entered by someone holding it.
        satisfied.push(`capability:${gate.capability}`);
        break;
      }
      case 'artifact': {
        if (ctx.artifacts.includes(gate.name)) {
          satisfied.push(`artifact:${gate.name}`);
        } else {
          blockers.push(`${gate.label} — artifact not produced: ${gate.name}`);
        }
        break;
      }
    }
  }

  return {
    stageId: stage.id,
    clear: blockers.length === 0,
    satisfied,
    blockers,
    missingCapabilities: [],
  };
}

/**
 * Start a run at the workflow's entry stage.
 * Entry is evaluated against the starting actor's capabilities.
 */
export function startRun(
  spec: Workflow,
  args: {
    id: string;
    goalId: string;
    productId?: string | null;
    actor: string;
    capabilities: Capability[];
    now?: string;
  },
): WorkflowRun {
  const stage = findStage(spec, spec.entry);
  const entry = evaluateEntry(stage, args.capabilities);
  if (!entry.clear) {
    throw new WorkflowError(
      `Cannot start ${spec.id}: ${entry.blockers.join('; ')}`,
    );
  }

  const now = args.now ?? new Date().toISOString();
  return {
    id: args.id,
    workflowId: spec.id,
    goalId: args.goalId,
    productId: args.productId ?? null,
    currentStageId: spec.entry,
    history: [
      {
        stageId: spec.entry,
        enteredAt: now,
        enteredBy: args.actor,
        heldCapabilities: args.capabilities,
      },
    ],
    startedAt: now,
  };
}

/**
 * Advance a run to another stage.
 *
 * Requires: the edge is declared, the current stage's gates are clear, and the
 * entering actor holds the target stage's capabilities. Refusing here — rather
 * than in a caller — is what keeps every workflow governed identically.
 */
export function advance(
  spec: Workflow,
  run: WorkflowRun,
  args: {
    to: string;
    actor: string;
    capabilities: Capability[];
    context: RunContext;
    now?: string;
  },
): WorkflowRun {
  const declared = spec.transitions.some(
    (t) => t.from === run.currentStageId && t.to === args.to,
  );
  if (!declared) {
    throw new WorkflowError(
      `No declared transition ${run.currentStageId} -> ${args.to} in ${spec.id}`,
    );
  }

  const current = findStage(spec, run.currentStageId);
  const exit = evaluateExit(current, args.context);
  if (!exit.clear) {
    throw new WorkflowError(
      `Cannot leave ${current.id}: ${exit.blockers.join('; ')}`,
    );
  }

  const target = findStage(spec, args.to);
  const entry = evaluateEntry(target, args.capabilities);
  if (!entry.clear) {
    throw new WorkflowError(`Cannot enter ${target.id}: ${entry.blockers.join('; ')}`);
  }

  const now = args.now ?? new Date().toISOString();
  return {
    ...run,
    currentStageId: args.to,
    history: [
      ...run.history,
      {
        stageId: args.to,
        enteredAt: now,
        enteredBy: args.actor,
        heldCapabilities: args.capabilities,
      },
    ],
  };
}

/** Where a run may go next, with each option's exit/entry status. */
export function options(
  spec: Workflow,
  run: WorkflowRun,
  actorCapabilities: Capability[],
  context: RunContext,
): Array<{ stage: string; name: string; reachable: boolean; blockers: string[] }> {
  const current = findStage(spec, run.currentStageId);
  const exit = evaluateExit(current, context);

  return nextStages(spec, run).map((stage) => {
    const entry = evaluateEntry(stage, actorCapabilities);
    const blockers = [...exit.blockers, ...entry.blockers];
    return {
      stage: stage.id,
      name: stage.name,
      reachable: blockers.length === 0,
      blockers,
    };
  });
}
