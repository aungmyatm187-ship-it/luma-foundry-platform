/**
 * Exercises the tRPC router through a real caller — the same procedure path the
 * web app uses.
 *
 * Every procedure is protected, so tests build a context that satisfies the
 * Context type: { authUserId, ws }. The ws is in-memory — these tests verify
 * rule correctness, not persistence. Persistence is verified separately by
 * scripts/test-drizzle-repository.ts against live Postgres.
 */
import { AsyncWorkspace } from '@luma/core';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../src/router.js';
import type { Context } from '../src/trpc.js';

function setup(): { ws: AsyncWorkspace; caller: ReturnType<typeof appRouter.createCaller> } {
  const ws = AsyncWorkspace.fromInMemory();
  const ctx: Context = { authUserId: 'test-user-id', ws };
  const caller = appRouter.createCaller(ctx);
  return { ws, caller };
}

describe('workspace router', () => {
  it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
    const ws = AsyncWorkspace.fromInMemory();
    const caller = appRouter.createCaller({ authUserId: null, ws });
    await expect(caller.snapshot()).rejects.toThrow(/Authentication required/);
  });

  it('runs createGoal -> createProduct -> snapshot', async () => {
    const { caller } = setup();

    const user = await caller.createUser({ name: 'Owner', role: 'owner' });
    const goal = await caller.createGoal({
      ownerId: user.id,
      title: 'Launch Batch 01 storefront',
      outcome: 'Five products cleared',
      priority: 'high',
    });
    expect(goal.priority).toBe('high');

    const product = await caller.createProduct({
      goalId: goal.id,
      name: 'Axiom Grid',
      category: 'AI infrastructure',
      route: '/axiom-grid',
    });
    expect(product.status).toBe('concept');

    const snap = await caller.snapshot();
    expect(snap.goals.length).toBe(1);
    expect(snap.products.length).toBe(1);
  });

  it('exposes clearance as a query and guards the mutation', async () => {
    const { caller } = setup();
    const user = await caller.createUser({ name: 'Owner', role: 'owner' });
    const goal = await caller.createGoal({ ownerId: user.id, title: 'g', outcome: 'o' });
    const product = await caller.createProduct({
      goalId: goal.id,
      name: 'Selene Agents',
      category: 'Agent orchestration',
      route: '/selene-agents',
    });

    const report = await caller.checkClearance({ productId: product.id });
    expect(report.clearable).toBe(false);
    expect(report.missing.length).toBe(8);

    await expect(
      caller.setProductStatus({ productId: product.id, status: 'cleared' }),
    ).rejects.toThrow(/cannot be marked 'cleared'/);

    await expect(
      caller.setProductStatus({ productId: product.id, status: 'in_build' }),
    ).resolves.toMatchObject({ status: 'in_build' });
  });

  it('tracks a decision from open to approved', async () => {
    const { caller } = setup();
    const user = await caller.createUser({ name: 'Owner', role: 'owner' });
    const goal = await caller.createGoal({ ownerId: user.id, title: 'g', outcome: 'o' });
    const decision = await caller.createDecision({
      goalId: goal.id,
      title: 'Ship Ember Signal?',
      context: 'First real product',
      decision: 'Ship',
      ownerId: user.id,
    });
    expect(decision.status).toBe('open');
    expect(decision.resolvedAt).toBeNull();

    const approved = await caller.updateDecisionStatus({
      decisionId: decision.id,
      status: 'approved',
      decidedBy: 'owner',
    });
    expect(approved.status).toBe('approved');
    expect(approved.decidedBy).toBe('owner');
    expect(approved.resolvedAt).not.toBeNull();
  });

  it('rejects invalid input via schema validation', async () => {
    const { caller } = setup();
    await expect(
      caller.createProduct({ goalId: 'goal-1', name: '', category: 'c', route: '/x' }),
    ).rejects.toThrow();
  });
});
