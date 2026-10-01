/**
 * Gateway tests.
 *
 * The important property under test is not that commands parse — it is that a
 * bot cannot move work past a gate. A convenient chat surface is exactly where
 * a governance bypass would hide, so the refusal paths are tested as carefully
 * as the happy path.
 */
import { describe, expect, it } from 'vitest';
import {
  RunStore,
  handle,
  parseCommand,
  resolveWorkflow,
  type BotActor,
  type GatewayDeps,
} from '../src/gateway.js';
import { auditFonts, auditProduct, auditCatalogue, classifyFont } from '@luma/core';

const OWNER: BotActor = {
  externalId: '1',
  name: 'Owner',
  capabilities: ['operate', 'design', 'build', 'review', 'evidence', 'deploy', 'decide'],
};

const NOBODY: BotActor = { externalId: '2', name: 'Stranger', capabilities: [] };

function deps(actor: BotActor = OWNER): GatewayDeps {
  let n = 0;
  return {
    store: new RunStore(),
    contextFor: () => ({ evidence: [], approvals: [], artifacts: [] }),
    actorFor: () => actor,
    nextId: () => `run-${(n += 1)}`,
    now: () => '2026-10-01T00:00:00.000Z',
  };
}

const msg = (text: string, externalId = '1') =>
  ({ platform: 'telegram' as const, externalId, text });

describe('parseCommand', () => {
  it('parses a verb and target', () => {
    expect(parseCommand('hero axiom-grid')).toEqual({ verb: 'hero', target: 'axiom-grid' });
  });

  it('strips a leading slash command', () => {
    expect(parseCommand('/luma hero axiom-grid')).toEqual({ verb: 'hero', target: 'axiom-grid' });
  });

  it('strips a slash command with a bot suffix', () => {
    expect(parseCommand('/luma@luma_bot status')).toEqual({ verb: 'status', target: undefined });
  });

  it('lowercases the verb and target', () => {
    expect(parseCommand('HERO Axiom-Grid')).toEqual({ verb: 'hero', target: 'axiom-grid' });
  });

  it('returns null for empty input', () => {
    expect(parseCommand('   ')).toBeNull();
  });
});

describe('resolveWorkflow', () => {
  it('maps each verb to a workflow in the catalogue', () => {
    for (const verb of ['release', 'hero', 'workshop', 'deploy', 'evidence']) {
      expect(resolveWorkflow({ verb })?.id).toBeTruthy();
    }
  });

  it('returns null for an unknown verb', () => {
    expect(resolveWorkflow({ verb: 'launch-nukes' })).toBeNull();
  });
});

describe('read-only verbs', () => {
  it('help lists the functions', () => {
    const r = handle(msg('help'), deps());
    expect(r.ok).toBe(true);
    expect(r.text).toContain('hero');
    expect(r.text).toContain('gates');
  });

  it('whoami reports capabilities', () => {
    expect(handle(msg('whoami'), deps()).text).toContain('build');
  });

  it('whoami for a stranger reports none', () => {
    const r = handle(msg('whoami', '2'), deps(NOBODY));
    expect(r.text).toContain('_none_');
  });

  it('catalogue lists workflows', () => {
    const r = handle(msg('catalogue'), deps());
    expect(r.ok).toBe(true);
    expect(r.text).toContain('Workflows');
  });

  it('status with no runs says so', () => {
    expect(handle(msg('status'), deps()).text).toContain('No open runs');
  });
});

describe('licence audit', () => {
  it('flags a product whose typefaces are commercial', () => {
    const r = handle(msg('licence axiom-grid'), deps());
    // Axiom Grid is Space Grotesk + IBM Plex Mono — both OFL, so it is clear.
    expect(r.ok).toBe(true);
  });

  it('refuses a product with commercial typefaces and names a substitute', () => {
    const r = handle(msg('licence selene-agents'), deps());
    expect(r.ok).toBe(false);
    expect(r.text).toContain('Canela');
    expect(r.text).toContain('Fraunces');
  });

  it('requires a target', () => {
    expect(handle(msg('licence'), deps()).ok).toBe(false);
  });

  it('rejects an unknown product', () => {
    expect(handle(msg('licence not-a-product'), deps()).ok).toBe(false);
  });
});

describe('starting a run', () => {
  it('starts a workflow for a known route', () => {
    const d = deps();
    const r = handle(msg('hero axiom-grid'), d);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('Started');
    expect(d.store.all()).toHaveLength(1);
  });

  it('notes an uncatalogued route but still starts', () => {
    const d = deps();
    const r = handle(msg('hero my-own-product'), d);
    expect(r.ok).toBe(true);
    expect(r.text).toContain('not in the catalogue');
  });

  it('requires a target', () => {
    expect(handle(msg('hero'), deps()).ok).toBe(false);
  });
});

describe('governance holds through the bot', () => {
  it('refuses to advance past the stage whose gate is unmet', () => {
    const d = deps();
    handle(msg('hero axiom-grid'), d);

    // hero-asset: intake -> design -> assets -> review -> evidence.
    // `intake` and `design` are ungated, so the first two advances succeed.
    expect(handle(msg('hero axiom-grid'), d).ok).toBe(true);
    expect(d.store.all()[0]!.currentStageId).toBe('design');
    expect(handle(msg('hero axiom-grid'), d).ok).toBe(true);
    expect(d.store.all()[0]!.currentStageId).toBe('assets');

    // `assets` requires a recorded asset licence. With no evidence in context
    // the advance must be refused, and the run must not move.
    const blocked = handle(msg('hero axiom-grid'), d);
    expect(blocked.ok).toBe(false);
    expect(blocked.text).toMatch(/Blocked|Cannot advance/);
    expect(d.store.all()[0]!.currentStageId).toBe('assets');
  });

  it('does not let an actor without capabilities start a run', () => {
    const d = deps(NOBODY);
    const r = handle(msg('hero axiom-grid', '2'), d);
    expect(r.ok).toBe(false);
    expect(d.store.all()).toHaveLength(0);
  });

  it('reports blockers via gates rather than moving work', () => {
    const d = deps();
    handle(msg('hero axiom-grid'), d);
    handle(msg('hero axiom-grid'), d);
    handle(msg('hero axiom-grid'), d);

    const before = d.store.all()[0]!.currentStageId;
    const r = handle(msg('gates axiom-grid'), d);
    const after = d.store.all()[0]!.currentStageId;

    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/blocked/i);
    expect(after).toBe(before);
  });

  it('gates on an unknown target does not throw', () => {
    expect(handle(msg('gates nothing-here'), deps()).ok).toBe(false);
  });
});

describe('licensing module', () => {
  it('classifies OFL fonts as resale-safe', () => {
    expect(classifyFont('Space Grotesk')?.licence).toBe('font-open');
    expect(classifyFont('Satoshi')?.licence).toBe('font-free');
  });

  it('classifies commercial fonts as blocked', () => {
    expect(classifyFont('Canela')?.licence).toBe('commercial');
    expect(classifyFont('Helvetica Now')?.licence).toBe('commercial');
  });

  it('treats an unknown font as unsafe', () => {
    const audit = auditFonts(['Totally Made Up Face']);
    expect(audit.clear).toBe(false);
    expect(audit.unknown).toHaveLength(1);
  });

  it('offers replacements for every commercial font', () => {
    const audit = auditFonts(['Canela', 'Didot', 'Druk Condensed']);
    for (const f of audit.blocked) {
      expect(f.replacements.length).toBeGreaterThan(0);
    }
  });

  it('audits a clean product as clear', () => {
    const audit = auditProduct('axiom-grid');
    expect(audit?.clear).toBe(true);
  });

  it('audits a blocked product as not clear', () => {
    const audit = auditProduct('selene-agents');
    expect(audit?.clear).toBe(false);
    expect(audit?.blocked.map((f) => f.name)).toContain('Canela');
  });

  it('returns null for an unknown product', () => {
    expect(auditProduct('nope')).toBeNull();
  });

  it('finds the whole catalogue and partitions it', () => {
    const all = auditCatalogue();
    expect(all.products).toHaveLength(50);
    expect(all.cleanProducts.length + all.blockedProducts.length).toBe(50);
    // The catalogue as written names commercial faces in most products; this is
    // the finding that motivated the audit, so it is asserted rather than assumed.
    expect(all.blockedProducts.length).toBeGreaterThan(0);
  });
});
