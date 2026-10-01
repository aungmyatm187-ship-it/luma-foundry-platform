/**
 * Slack router tests.
 *
 * The property under test is the one that matters for a flexible surface: the
 * router can start and move any function, and still cannot bypass a gate. Each
 * test drives the real router over the real engine.
 */
import { describe, expect, it } from 'vitest';

import {
  RunStore,
  catalogue,
  handle,
  parseCommand,
  resolveWorkflow,
  type Actor,
  type RouterDeps,
} from '../src/router.js';
import type { RunContext } from '@luma/core';

const ACTORS: Record<string, Actor> = {
  U_OWNER: { slackUserId: 'U_OWNER', name: 'Owner', capabilities: ['decide', 'operate'] },
  U_MANUS: { slackUserId: 'U_MANUS', name: 'Manus', capabilities: ['design', 'build', 'operate'] },
  U_OH: { slackUserId: 'U_OH', name: 'OpenHands', capabilities: ['review', 'evidence', 'operate'] },
};

function deps(overrides: Partial<RouterDeps> = {}): RouterDeps {
  let n = 0;
  const store = new RunStore();
  return {
    store,
    contextFor: () => ({ evidence: [], approvals: [], artifacts: [] }),
    actorFor: (id) => ACTORS[id] ?? { slackUserId: id, name: 'Stranger', capabilities: [] },
    nextId: () => `run-${++n}`,
    now: () => '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('command parsing and resolution', () => {
  it('parses verb and target', () => {
    expect(parseCommand('hero axiom-grid')).toEqual({ verb: 'hero', target: 'axiom-grid' });
    expect(parseCommand('  STATUS  ')).toEqual({ verb: 'status', target: undefined });
    expect(parseCommand('')).toBeNull();
  });

  it('resolves each verb to a workflow', () => {
    expect(resolveWorkflow({ verb: 'hero' })?.id).toBe('hero-asset');
    expect(resolveWorkflow({ verb: 'workshop' })?.id).toBe('workshop-track');
    expect(resolveWorkflow({ verb: 'evidence' })?.id).toBe('evidence-review');
    expect(resolveWorkflow({ verb: 'deploy' })?.id).toBe('automation-deploy');
    expect(resolveWorkflow({ verb: 'release' })?.id).toBe('product-release');
    expect(resolveWorkflow({ verb: 'status' })).toBeNull();
  });

  it('exposes the catalogue', () => {
    expect(catalogue().map((w) => w.id)).toContain('hero-asset');
  });
});

describe('read-only verbs', () => {
  it('reports capabilities', () => {
    const r = handle({ verb: 'whoami' }, 'U_MANUS', deps());
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/Manus/);
    expect(r.text).toMatch(/`build`/);
  });

  it('reports no capabilities for a stranger', () => {
    const r = handle({ verb: 'whoami' }, 'U_UNKNOWN', deps());
    expect(r.text).toMatch(/_none_/);
  });

  it('reports an empty run list', () => {
    expect(handle({ verb: 'status' }, 'U_OWNER', deps()).text).toMatch(/No open runs/);
  });
});

describe('starting functions', () => {
  it('starts a hero-asset run for a target', () => {
    const d = deps();
    const r = handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/Hero asset production/);
    expect(d.store.forTarget('axiom-grid')?.workflowId).toBe('hero-asset');
  });

  it('refuses to start when the actor lacks the entry capability', () => {
    const r = handle({ verb: 'hero', target: 'x' }, 'U_UNKNOWN', deps());
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/Could not start/);
  });

  it('rejects an unknown function and lists the known ones', () => {
    const r = handle({ verb: 'nonsense', target: 'x' }, 'U_OWNER', deps());
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/Unknown function/);
    expect(r.text).toMatch(/hero/);
  });

  it('requires a target for workflow verbs', () => {
    expect(handle({ verb: 'hero' }, 'U_MANUS', deps()).text).toMatch(/Usage/);
  });
});

describe('advancing and gating', () => {
  it('advances through the hero workflow and stops at the licence gate', () => {
    const d = deps();
    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    // intake -> design
    expect(handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d).ok).toBe(true);
    // design -> assets
    expect(handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d).ok).toBe(true);
    // assets -> review requires asset_licence evidence
    const blocked = handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    expect(blocked.ok).toBe(false);
    expect(blocked.text).toMatch(/Asset licence recorded/);
  });

  it('advances past the licence gate once evidence exists', () => {
    let ctx: RunContext = { evidence: [], approvals: [], artifacts: [] };
    const d = deps({ contextFor: () => ctx });

    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);

    ctx = { ...ctx, evidence: ['asset_licence'] };
    const moved = handle({ verb: 'hero', target: 'axiom-grid' }, 'U_OH', d);
    expect(moved.ok).toBe(true);
    expect(moved.text).toMatch(/assets.*review/s);
  });

  it('does not let a build actor enter a decide stage', () => {
    const d = deps();
    // start a release run as owner, then try to move into clearance as Manus
    handle({ verb: 'release', target: 'p' }, 'U_OWNER', d);
    const r = handle({ verb: 'release', target: 'p' }, 'U_MANUS', d);
    // Manus can advance into design (build/design caps) but never into clearance
    expect(r.text).not.toMatch(/clearance/);
  });

  it('gates explains exactly what is blocking, without mutating', () => {
    const d = deps();
    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);
    handle({ verb: 'hero', target: 'axiom-grid' }, 'U_MANUS', d);

    const before = d.store.forTarget('axiom-grid')?.currentStageId;
    const r = handle({ verb: 'gates', target: 'axiom-grid' }, 'U_MANUS', d);
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/Asset licence recorded/);
    // unchanged
    expect(d.store.forTarget('axiom-grid')?.currentStageId).toBe(before);
  });

  it('gates reports no blockers when clear', () => {
    const d = deps();
    handle({ verb: 'hero', target: 'a' }, 'U_MANUS', d);
    const r = handle({ verb: 'gates', target: 'a' }, 'U_MANUS', d);
    expect(r.text).toMatch(/no blockers/);
  });

  it('gates on an unknown target is a clean error', () => {
    expect(handle({ verb: 'gates', target: 'nope' }, 'U_MANUS', deps()).text).toMatch(
      /No open run/,
    );
  });
});

describe('flexibility', () => {
  it('one command surface drives five different functions', () => {
    const d = deps();
    const verbs = [
      { verb: 'hero', target: 'a' },
      { verb: 'workshop', target: 'b' },
      { verb: 'evidence', target: 'c' },
      { verb: 'deploy', target: 'd' },
      { verb: 'release', target: 'e' },
    ];
    for (const v of verbs) {
      const r = handle(v, 'U_OWNER', d);
      expect(r.ok).toBe(true);
    }
    expect(d.store.all().length).toBe(5);
    expect(new Set(d.store.all().map((r) => r.workflowId)).size).toBe(5);
  });

  it('status groups runs by function', () => {
    const d = deps();
    handle({ verb: 'hero', target: 'a' }, 'U_OWNER', d);
    handle({ verb: 'hero', target: 'b' }, 'U_OWNER', d);
    handle({ verb: 'workshop', target: 'c' }, 'U_OWNER', d);

    const r = handle({ verb: 'status' }, 'U_OWNER', d);
    expect(r.text).toMatch(/Hero asset production\* — 2/);
    expect(r.text).toMatch(/Workshop track\* — 1/);
  });

  it('records who moved the run', () => {
    const d = deps();
    handle({ verb: 'hero', target: 'a' }, 'U_MANUS', d);
    handle({ verb: 'hero', target: 'a' }, 'U_MANUS', d);
    const run = d.store.forTarget('a');
    expect(run?.history.map((h) => h.enteredBy)).toEqual(['Manus', 'Manus']);
  });
});
