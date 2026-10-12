import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_CATEGORIES,
  REQUIRED_EVIDENCE,
  Workspace,
  createReleaseEvidencePassport,
} from '../src/index.js';

function seeded() {
  const ws = new Workspace();
  const owner = ws.createUser('Owner', 'owner');
  const goal = ws.createGoal({ ownerId: owner.id, title: 'Release', outcome: 'Ship with evidence' });
  const product = ws.createProduct({
    goalId: goal.id,
    name: 'Axiom Grid',
    category: 'AI infrastructure',
    route: '/axiom-grid',
  });
  return { ws, product };
}

describe('release evidence passport', () => {
  it('exports an honest, privacy-preserving report for an uncleared product', () => {
    const { ws, product } = seeded();
    ws.recordEvidence({
      productId: product.id,
      kind: 'source_commit',
      reference: 'https://github.com/example/repo/commit/abc123',
      note: 'private build note',
      recordedBy: 'operator_a',
    });

    const passport = createReleaseEvidencePassport(product, ws.evidenceFor(product.id), {
      generatedAt: '2026-10-12T12:00:00.000Z',
    });

    expect(passport.format).toBe('luma.release-evidence-passport');
    expect(passport.version).toBe(1);
    expect(passport.clearance.clearable).toBe(false);
    expect(passport.clearance.missing).toEqual(REQUIRED_EVIDENCE.filter((kind) => kind !== 'source_commit'));
    expect(passport.evidence).toHaveLength(1);
    expect(passport.evidence[0]).toMatchObject({
      kind: 'source_commit',
      category: 'traceability',
      producer: 'machine',
      recordedBy: 'operator_a',
    });
    expect(passport.evidence[0]).not.toHaveProperty('reference');
    expect(passport.evidence[0]).not.toHaveProperty('note');
    expect(passport.assurance).toMatchObject({
      cryptographicallySigned: false,
      referencesVerified: false,
      recorderIdentityVerified: false,
      ownerApprovalVerified: false,
      legalOpinion: false,
    });
  });

  it('includes references only when explicitly requested and never exports notes', () => {
    const { ws, product } = seeded();
    ws.recordEvidence({
      productId: product.id,
      kind: 'counsel_review',
      reference: 'vault://private/counsel-review',
      note: 'sensitive counsel note',
      recordedBy: 'operator_b',
    });

    const passport = createReleaseEvidencePassport(product, ws.evidenceFor(product.id), {
      generatedAt: '2026-10-12T12:00:00.000Z',
      includeReferences: true,
    });

    expect(passport.evidence[0]?.reference).toBe('vault://private/counsel-review');
    expect(passport.evidence[0]).not.toHaveProperty('note');
  });

  it('matches the clearance engine and emits stable, categorized evidence records', () => {
    const { ws, product } = seeded();
    for (const kind of REQUIRED_EVIDENCE) {
      ws.recordEvidence({
        productId: product.id,
        kind,
        reference: `ref://${kind}`,
        note: kind,
        recordedBy: kind === 'source_commit' || kind === 'dependency_sbom' || kind === 'third_party_notices' || kind === 'buyer_terms'
          ? 'operator_a'
          : 'operator_b',
      });
    }
    const evidence = ws.evidenceFor(product.id);
    const passport = createReleaseEvidencePassport(product, evidence, {
      generatedAt: '2026-10-12T12:00:00.000Z',
    });
    const reordered = createReleaseEvidencePassport(product, [...evidence].reverse(), {
      generatedAt: '2026-10-12T12:00:00.000Z',
    });

    expect(passport.clearance.clearable).toBe(true);
    expect(reordered).toEqual(passport);
    expect(passport.clearance.present).toEqual([...REQUIRED_EVIDENCE].sort());
    expect(passport.evidence.map((item) => item.kind)).toEqual(
      [...REQUIRED_EVIDENCE].sort((a, b) => a.localeCompare(b)),
    );
    expect(passport.evidence.find((item) => item.kind === 'buyer_terms')?.category).toBe('commercial');
    expect(passport.evidence.find((item) => item.kind === 'asset_licence')?.category).toBe('rights');
    expect(Object.keys(EVIDENCE_CATEGORIES).sort()).toEqual([...REQUIRED_EVIDENCE].sort());
  });

  it('rejects an invalid generation timestamp', () => {
    const { ws, product } = seeded();
    expect(() => createReleaseEvidencePassport(product, ws.evidenceFor(product.id), {
      generatedAt: 'not-a-date',
    })).toThrow(/valid ISO timestamp/);
  });
});
