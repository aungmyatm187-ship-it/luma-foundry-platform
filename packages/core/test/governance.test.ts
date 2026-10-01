import { describe, expect, it } from 'vitest';
import {
  GovernanceError,
  REQUIRED_EVIDENCE,
  Workspace,
  evaluateClearance,
  type EvidenceKind,
} from '../src/index.js';

function seeded() {
  const ws = new Workspace();
  const owner = ws.createUser('Owner', 'owner');
  const goal = ws.createGoal({
    ownerId: owner.id,
    title: 'Launch Batch 01 storefront',
    outcome: 'Five AI products commercially cleared and sellable',
  });
  const product = ws.createProduct({
    goalId: goal.id,
    name: 'Axiom Grid',
    category: 'AI infrastructure',
    route: '/axiom-grid',
  });
  return { ws, owner, goal, product };
}

function giveAllEvidence(
  ws: Workspace,
  productId: string,
  by: 'operator_a' | 'operator_b' = 'operator_b',
) {
  for (const kind of REQUIRED_EVIDENCE) {
    ws.recordEvidence({
      productId,
      kind,
      reference: `ref://${kind}`,
      note: `recorded ${kind}`,
      recordedBy: by,
    });
  }
}

describe('governance: clearance requires evidence', () => {
  it('a product with no evidence is not clearable', () => {
    const { ws, product } = seeded();
    const report = evaluateClearance(product, ws.evidenceFor(product.id));

    expect(report.clearable).toBe(false);
    expect(report.missing).toEqual([...REQUIRED_EVIDENCE]);
    expect(report.blockers.length).toBe(REQUIRED_EVIDENCE.length);
  });

  it('a source commit alone never implies clearance', () => {
    const { ws, product } = seeded();
    ws.recordEvidence({
      productId: product.id,
      kind: 'source_commit',
      reference: '2bb64e1',
      note: 'ember-lite HEAD',
      recordedBy: 'operator_a',
    });

    const report = evaluateClearance(product, ws.evidenceFor(product.id));
    expect(report.clearable).toBe(false);
    expect(report.traceabilityOnly).toEqual(['source_commit']);
    expect(report.blockers.some((b) => b.includes('Traceability never proves'))).toBe(true);
  });

  it('cannot transition to cleared without full evidence', () => {
    const { ws, product } = seeded();
    expect(() => ws.updateProductStatus(product.id, 'cleared')).toThrow(GovernanceError);
  });

  it('can transition to cleared once every required kind is present', () => {
    const { ws, product } = seeded();
    giveAllEvidence(ws, product.id);

    const report = evaluateClearance(product, ws.evidenceFor(product.id));
    expect(report.clearable).toBe(true);
    expect(report.missing).toEqual([]);

    const updated = ws.updateProductStatus(product.id, 'cleared');
    expect(updated.status).toBe('cleared');
  });

  it('non-clearing transitions are unaffected by evidence', () => {
    const { ws, product } = seeded();
    expect(ws.updateProductStatus(product.id, 'in_build').status).toBe('in_build');
    expect(ws.updateProductStatus(product.id, 'conditional').status).toBe('conditional');
    expect(ws.updateProductStatus(product.id, 'blocked').status).toBe('blocked');
  });

  it('duplicate evidence kinds do not count twice', () => {
    const { ws, product } = seeded();
    giveAllEvidence(ws, product.id);
    giveAllEvidence(ws, product.id, 'operator_a');

    const report = evaluateClearance(product, ws.evidenceFor(product.id));
    expect(report.present.length).toBe(REQUIRED_EVIDENCE.length);
    expect(report.clearable).toBe(true);
  });

  it('evidence from one product does not clear another', () => {
    const { ws, goal, product } = seeded();
    const other = ws.createProduct({
      goalId: goal.id,
      name: 'Selene Agents',
      category: 'Agent orchestration',
      route: '/selene-agents',
    });
    giveAllEvidence(ws, product.id);

    const otherReport = evaluateClearance(other, ws.evidenceFor(other.id));
    expect(otherReport.clearable).toBe(false);
    expect(otherReport.missing.length).toBe(REQUIRED_EVIDENCE.length);
    expect(() => ws.updateProductStatus(other.id, 'cleared')).toThrow(GovernanceError);
  });

  it('reports exactly which kinds are missing', () => {
    const { ws, product } = seeded();
    const partial: EvidenceKind[] = ['source_commit', 'design_history'];
    for (const kind of partial) {
      ws.recordEvidence({
        productId: product.id,
        kind,
        reference: 'x',
        note: 'x',
        recordedBy: 'operator_a',
      });
    }

    const report = evaluateClearance(product, ws.evidenceFor(product.id));
    expect([...report.present].sort()).toEqual([...partial].sort());
    expect(report.missing).not.toContain('source_commit');
    expect(report.missing).toContain('counsel_review');
  });
});

describe('workspace: pipeline integrity', () => {
  it('runs the full Goal -> Product -> Work -> Handoff -> Decision flow', () => {
    const { ws, goal, product } = seeded();

    const work = ws.createWorkItem({
      goalId: goal.id,
      productId: product.id,
      type: 'build',
      assignedTo: 'operator_a',
      title: 'Build product page',
      detail: 'Implement hero, system plane, and evidence panel',
      priority: 'high',
    });
    expect(work.status).toBe('todo');
    expect(ws.updateWorkItemStatus(work.id, 'done').status).toBe('done');

    const handoff = ws.createHandoff({
      goalId: goal.id,
      productId: product.id,
      fromRole: 'operator_a',
      toRole: 'operator_b',
      title: 'Axiom Grid build handoff',
      summary: 'Build complete, evidence attached',
      asks: 'Verify asset licence and contributor rights',
    });
    expect(handoff.status).toBe('draft');
    expect(ws.updateHandoffStatus(handoff.id, 'sent').status).toBe('sent');

    const decision = ws.createDecision({
      goalId: goal.id,
      productId: product.id,
      title: 'Approve Axiom Grid for sale',
      context: 'All evidence present',
      decision: 'Approve',
      ownerId: goal.ownerId,
    });
    expect(decision.status).toBe('open');
    expect(decision.resolvedAt).toBeNull();
    const resolved = ws.updateDecisionStatus(decision.id, 'approved');
    expect(resolved.status).toBe('approved');
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it('rejects references to unknown goals and products', () => {
    const { ws, goal } = seeded();
    expect(() =>
      ws.createProduct({ goalId: 'goal-9999', name: 'X', category: 'c', route: '/x' }),
    ).toThrow(/Unknown goal/);
    expect(() =>
      ws.createWorkItem({
        goalId: goal.id,
        productId: 'prd-9999',
        type: 'build',
        assignedTo: 'operator_a',
        title: 't',
        detail: 'd',
      }),
    ).toThrow(/Unknown product/);
    expect(() => ws.updateProductStatus('prd-9999', 'in_build')).toThrow(/Unknown product/);
  });

  it('snapshot is a copy, not a live reference', () => {
    const { ws, goal } = seeded();
    const snap = ws.snapshot();
    ws.createProduct({ goalId: goal.id, name: 'Later', category: 'c', route: '/later' });
    expect(snap.products.length).toBe(1);
    expect(ws.snapshot().products.length).toBe(2);
    expect(snap.takenAt).toBeTruthy();
  });
});
