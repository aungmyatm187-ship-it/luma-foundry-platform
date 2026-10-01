/**
 * Workflow engine tests.
 *
 * These exercise the real engine over the real catalogue — no stubs — because
 * the property that matters is compositional: the same shared stages must behave
 * identically in every workflow that reuses them.
 */
import { describe, expect, it } from 'vitest';

import {
  HERO_ASSET,
  PRODUCT_RELEASE,
  STAGE,
  WORKFLOWS,
  WORKSHOP_TRACK,
  advance,
  defineWorkflow,
  evaluateEntry,
  evaluateExit,
  findWorkflow,
  options,
  reachableStages,
  startRun,
  type RunContext,
} from '../src/index.js';

const ownerCaps = ['decide', 'operate'] as const;
const aCaps = ['design', 'build', 'operate'] as const;
const bCaps = ['review', 'evidence', 'operate'] as const;
/** For tests about gates, where capability separation is not the subject. */
const allCaps = ['design', 'build', 'review', 'evidence', 'operate', 'deploy', 'decide'] as const;

function emptyCtx(): RunContext {
  return { evidence: [], approvals: [], artifacts: [] };
}

describe('workflow definitions', () => {
  it('every catalogue workflow is well-formed', () => {
    for (const wf of WORKFLOWS) {
      expect(() => defineWorkflow(wf)).not.toThrow();
    }
  });

  it('rejects a transition to an unknown stage', () => {
    expect(() =>
      defineWorkflow({
        id: 'broken',
        name: 'Broken',
        purpose: 'x',
        entry: 'intake',
        stages: [STAGE.intake],
        transitions: [{ from: 'intake', to: 'nowhere' }],
      }),
    ).toThrow(/unknown stage/);
  });

  it('rejects unreachable stages', () => {
    expect(() =>
      defineWorkflow({
        id: 'orphan',
        name: 'Orphan',
        purpose: 'x',
        entry: 'intake',
        stages: [STAGE.intake, STAGE.publish],
        transitions: [],
      }),
    ).toThrow(/unreachable/);
  });

  it('reuses shared stages rather than redefining them', () => {
    // `review` appears in four workflows; it must be the same object.
    const users = WORKFLOWS.filter((w) => w.stages.some((s) => s.id === 'review'));
    expect(users.length).toBeGreaterThanOrEqual(4);

    for (const wf of users) {
      const stage = wf.stages.find((s) => s.id === 'review');
      expect(stage).toBe(STAGE.review);
    }
  });

  it('computes reachable stages from entry', () => {
    const reachable = reachableStages(PRODUCT_RELEASE);
    expect(reachable.has('publish')).toBe(true);
    expect(reachable.size).toBe(PRODUCT_RELEASE.stages.length);
  });
});

describe('entry and exit evaluation', () => {
  it('reports missing capabilities without throwing', () => {
    const report = evaluateEntry(STAGE.build, ['operate']);
    expect(report.clear).toBe(false);
    expect(report.missingCapabilities).toEqual(['build']);
    expect(report.blockers[0]).toMatch(/Missing capability: build/);
  });

  it('returns every exit blocker, not just the first', () => {
    const report = evaluateExit(STAGE.clearance, emptyCtx());
    expect(report.clear).toBe(false);
    // one evidence blocker + one approval blocker
    expect(report.blockers.length).toBe(2);
    expect(report.blockers.join(' ')).toMatch(/missing evidence/);
    expect(report.blockers.join(' ')).toMatch(/needs approval from owner/);
  });

  it('passes the clearance gate only with all evidence and owner approval', () => {
    const ctx: RunContext = {
      evidence: [
        'source_commit',
        'design_history',
        'asset_licence',
        'contributor_rights',
        'dependency_sbom',
        'third_party_notices',
        'counsel_review',
        'buyer_terms',
      ],
      approvals: ['owner'],
      artifacts: [],
    };
    const report = evaluateExit(STAGE.clearance, ctx);
    expect(report.clear).toBe(true);
    expect(report.blockers).toEqual([]);
  });
});

describe('running a workflow', () => {
  it('starts at entry when the actor holds the capability', () => {
    const run = startRun(PRODUCT_RELEASE, {
      id: 'run-1',
      goalId: 'goal-1',
      actor: 'owner',
      capabilities: [...ownerCaps],
    });
    expect(run.currentStageId).toBe('intake');
    expect(run.history.length).toBe(1);
  });

  it('refuses to start without the entry capability', () => {
    expect(() =>
      startRun(PRODUCT_RELEASE, {
        id: 'run-2',
        goalId: 'goal-1',
        actor: 'ghost',
        capabilities: [],
      }),
    ).toThrow(/Cannot start product-release/);
  });

  it('refuses an undeclared transition', () => {
    const run = startRun(PRODUCT_RELEASE, {
      id: 'run-3',
      goalId: 'goal-1',
      actor: 'owner',
      capabilities: [...ownerCaps],
    });
    expect(() =>
      advance(PRODUCT_RELEASE, run, {
        to: 'publish', // skipping everything
        actor: 'owner',
        capabilities: [...ownerCaps],
        context: emptyCtx(),
      }),
    ).toThrow(/No declared transition/);
  });

  it('refuses to leave a stage whose gates are unmet', () => {
    let run = startRun(PRODUCT_RELEASE, {
      id: 'run-4',
      goalId: 'goal-1',
      actor: 'owner',
      capabilities: [...allCaps],
    });
    // intake has no gates, so design is reachable
    run = advance(PRODUCT_RELEASE, run, {
      to: 'design',
      actor: 'owner',
      capabilities: [...allCaps],
      context: emptyCtx(),
    });
    // design has no gates either, so build is reachable
    run = advance(PRODUCT_RELEASE, run, {
      to: 'build',
      actor: 'operator_a',
      capabilities: [...allCaps],
      context: emptyCtx(),
    });
    // build's gate demands a build artifact, which does not exist yet
    expect(() =>
      advance(PRODUCT_RELEASE, run, {
        to: 'assets',
        actor: 'operator_a',
        capabilities: [...allCaps],
        context: emptyCtx(),
      }),
    ).toThrow(/Cannot leave build/);
  });

  it('drives the full product-release pipeline to publish', () => {
    let run = startRun(PRODUCT_RELEASE, {
      id: 'run-5',
      goalId: 'goal-1',
      actor: 'owner',
      capabilities: [...ownerCaps],
    });

    run = advance(PRODUCT_RELEASE, run, {
      to: 'design', actor: 'operator_a', capabilities: [...allCaps], context: emptyCtx(),
    });
    run = advance(PRODUCT_RELEASE, run, {
      to: 'build', actor: 'operator_a', capabilities: [...allCaps], context: emptyCtx(),
    });

    // leaving build requires the build artifact
    const withBuild: RunContext = { ...emptyCtx(), artifacts: ['build'] };
    run = advance(PRODUCT_RELEASE, run, {
      to: 'assets', actor: 'operator_a', capabilities: [...allCaps], context: withBuild,
    });

    // leaving assets requires the asset licence
    const withLicence: RunContext = { ...withBuild, evidence: ['asset_licence'] };
    run = advance(PRODUCT_RELEASE, run, {
      to: 'review', actor: 'operator_b', capabilities: [...allCaps], context: withLicence,
    });

    // leaving review requires the review artifact
    const withReview: RunContext = { ...withLicence, artifacts: ['build', 'review'] };
    run = advance(PRODUCT_RELEASE, run, {
      to: 'evidence', actor: 'operator_b', capabilities: [...allCaps], context: withReview,
    });

    // leaving evidence requires rights evidence
    const withRights: RunContext = {
      ...withReview,
      evidence: ['asset_licence', 'design_history', 'contributor_rights'],
    };
    run = advance(PRODUCT_RELEASE, run, {
      to: 'clearance', actor: 'operator_b', capabilities: [...allCaps], context: withRights,
    });

    // clearance demands everything
    const full: RunContext = {
      evidence: [
        'source_commit', 'design_history', 'asset_licence', 'contributor_rights',
        'dependency_sbom', 'third_party_notices', 'counsel_review', 'buyer_terms',
      ],
      approvals: ['owner'],
      artifacts: ['build', 'review', 'assets', 'evidence'],
    };
    run = advance(PRODUCT_RELEASE, run, {
      to: 'publish', actor: 'owner', capabilities: [...allCaps], context: full,
    });

    expect(run.currentStageId).toBe('publish');
    expect(run.history.map((h) => h.stageId)).toEqual([
      'intake', 'design', 'build', 'assets', 'review', 'evidence', 'clearance', 'publish',
    ]);
  });

  it('records who entered each stage and with what capabilities', () => {
    let run = startRun(PRODUCT_RELEASE, {
      id: 'run-6', goalId: 'g', actor: 'owner', capabilities: [...ownerCaps],
    });
    run = advance(PRODUCT_RELEASE, run, {
      to: 'design', actor: 'operator_a', capabilities: [...allCaps], context: emptyCtx(),
    });

    expect(run.history[1].enteredBy).toBe('operator_a');
    expect(run.history[1].heldCapabilities).toContain('build');
    expect(run.history[0].enteredBy).toBe('owner');
  });

  it('lists reachable next options with their blockers', () => {
    const run = startRun(HERO_ASSET, {
      id: 'run-7', goalId: 'g', actor: 'operator_a', capabilities: [...aCaps],
    });
    const opts = options(HERO_ASSET, run, [...aCaps], emptyCtx());
    expect(opts.map((o) => o.stage)).toEqual(['design']);
    expect(opts[0].reachable).toBe(true);
  });
});

describe('workflows are composable', () => {
  it('the same review stage governs two different domains identically', () => {
    const ctx: RunContext = { evidence: [], approvals: [], artifacts: [] };
    const inProduct = PRODUCT_RELEASE.stages.find((s) => s.id === 'review') as typeof STAGE.review;
    const inWorkshop = WORKSHOP_TRACK.stages.find((s) => s.id === 'review') as typeof STAGE.review;

    expect(evaluateExit(inProduct, ctx)).toEqual(evaluateExit(inWorkshop, ctx));
  });

  it('hero-asset workflow requires an asset licence before evidence', () => {
    let run = startRun(HERO_ASSET, {
      id: 'run-8', goalId: 'g', actor: 'operator_a', capabilities: [...aCaps],
    });
    run = advance(HERO_ASSET, run, {
      to: 'design', actor: 'operator_a', capabilities: [...allCaps], context: emptyCtx(),
    });
    run = advance(HERO_ASSET, run, {
      to: 'assets', actor: 'operator_a', capabilities: [...allCaps], context: emptyCtx(),
    });

    // assets stage demands the licence before it can be left
    expect(() =>
      advance(HERO_ASSET, run, {
        to: 'review', actor: 'operator_a', capabilities: [...allCaps], context: emptyCtx(),
      }),
    ).toThrow(/Asset licence recorded/);
  });

  it('exposes every catalogue workflow by id', () => {
    expect(findWorkflow('hero-asset').name).toBe('Hero asset production');
    expect(findWorkflow('workshop-track').entry).toBe('intake');
    expect(() => findWorkflow('nope')).toThrow(/Unknown workflow/);
  });
});
