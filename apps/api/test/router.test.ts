/**
 * Exercises the tRPC router through a real caller — the same procedure path the
 * web app uses.
 *
 * Every procedure is protected, so tests build a context that satisfies the
 * Context type: { authUserId, actor, ws }. The ws is in-memory — these tests
 * verify rule correctness, not persistence. Persistence is verified separately
 * by scripts/test-drizzle-repository.ts against live Postgres.
 *
 * Actor roles are bound into the workspace the same way the API binds the
 * resolved actor from the verified JWT, so these tests exercise the real
 * server-derived-role path rather than passing a role in the request body.
 */
import { AsyncWorkspace, Workspace, type Role } from '@luma/core';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../src/router.js';
import type { Context } from '../src/trpc.js';

function setup(role: Role = 'owner') {
  const store = new Workspace();
  const actor = store.createUser(`${role} user`, role);
  const ws = AsyncWorkspace.fromInMemory(store, actor);
  const ctx: Context = {
    authUserId: `auth-${role}`,
    actor: { id: actor.id, name: actor.name, role: actor.role },
    ws,
  };
  return { store, actor, ws, caller: appRouter.createCaller(ctx) };
}

describe('workspace router', () => {
  it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
    const ws = AsyncWorkspace.fromInMemory();
    const caller = appRouter.createCaller({ authUserId: null, actor: null, ws });
    await expect(caller.snapshot()).rejects.toThrow(/Authentication required/);
  });

  it('rejects an authenticated identity that has no actor record', async () => {
    const ws = AsyncWorkspace.fromInMemory();
    const caller = appRouter.createCaller({ authUserId: 'ghost', actor: null, ws });
    await expect(caller.snapshot()).rejects.toThrow(/Authentication required/);
  });

  it('exposes the server-derived actor via me', async () => {
    const { actor, caller } = setup('operator_a');
    const me = await caller.me();
    expect(me).toMatchObject({ id: actor.id, role: 'operator_a' });
  });

  it('runs createGoal -> createProduct -> snapshot', async () => {
    const { actor, caller } = setup('owner');

    const goal = await caller.createGoal({
      ownerId: actor.id,
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
    const { actor, caller } = setup('owner');
    const goal = await caller.createGoal({ ownerId: actor.id, title: 'g', outcome: 'o' });
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
    const { actor, caller } = setup('owner');
    const goal = await caller.createGoal({ ownerId: actor.id, title: 'g', outcome: 'o' });
    const decision = await caller.createDecision({
      goalId: goal.id,
      title: 'Ship Ember Signal?',
      context: 'First real product',
      decision: 'Ship',
      ownerId: actor.id,
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

  it('rejects products that belong to a different goal', async () => {
    const { actor, caller } = setup('owner');
    const goalA = await caller.createGoal({ ownerId: actor.id, title: 'Goal A', outcome: 'A' });
    const goalB = await caller.createGoal({ ownerId: actor.id, title: 'Goal B', outcome: 'B' });
    const productB = await caller.createProduct({
      goalId: goalB.id,
      name: 'Product B',
      category: 'Test',
      route: '/product-b',
    });

    await expect(
      caller.createWorkItem({
        goalId: goalA.id,
        productId: productB.id,
        type: 'build',
        assignedTo: 'operator_a',
        title: 'Cross-goal work item',
        detail: 'Must be rejected',
      }),
    ).rejects.toThrow(/does not belong to the selected goal/);

    await expect(
      caller.createHandoff({
        goalId: goalA.id,
        productId: productB.id,
        fromRole: 'operator_a',
        toRole: 'operator_b',
        title: 'Cross-goal handoff',
        summary: 'Must be rejected',
        asks: 'None',
      }),
    ).rejects.toThrow(/does not belong to the selected goal/);

    await expect(
      caller.createDecision({
        goalId: goalA.id,
        productId: productB.id,
        title: 'Cross-goal decision',
        context: 'Must be rejected',
        decision: 'Reject',
        ownerId: actor.id,
      }),
    ).rejects.toThrow(/does not belong to the selected goal/);
  });

  it('rejects invalid input via schema validation', async () => {
    const { caller } = setup('owner');
    await expect(
      caller.createProduct({ goalId: 'goal-1', name: '', category: 'c', route: '/x' }),
    ).rejects.toThrow();
  });

  describe('server-derived actor roles', () => {
    it('rejects an operator claiming the owner role', async () => {
      const { actor, caller } = setup('operator_a');
      const goal = await caller.createGoal({ ownerId: actor.id, title: 'g', outcome: 'o' });
      const product = await caller.createProduct({
        goalId: goal.id,
        name: 'P',
        category: 'c',
        route: '/p',
      });

      await expect(
        caller.createWorkItem({
          goalId: goal.id,
          productId: product.id,
          type: 'build',
          assignedTo: 'owner',
          title: 'Impersonation attempt',
          detail: 'Must be rejected',
        }),
      ).rejects.toThrow(/may not record work as 'owner'/);

      await expect(
        caller.recordEvidence({
          productId: product.id,
          kind: 'source_commit',
          reference: 'x',
          note: 'x',
          recordedBy: 'owner',
        }),
      ).rejects.toThrow(/may not record work as 'owner'/);
    });

    it('records the server role when an owner acts as an operator', async () => {
      const { actor, caller } = setup('owner');
      const goal = await caller.createGoal({ ownerId: actor.id, title: 'g', outcome: 'o' });
      const product = await caller.createProduct({
        goalId: goal.id,
        name: 'P',
        category: 'c',
        route: '/p',
      });

      const item = await caller.createWorkItem({
        goalId: goal.id,
        productId: product.id,
        type: 'build',
        assignedTo: 'operator_b',
        title: 'Owner acting as operator',
        detail: 'Attribution must follow the session role',
      });
      expect(item.assignedTo).toBe('owner');

      const evidence = await caller.recordEvidence({
        productId: product.id,
        kind: 'source_commit',
        reference: 'x',
        note: 'x',
        recordedBy: 'operator_b',
      });
      expect(evidence.recordedBy).toBe('owner');
    });

    it('accepts a valid matching role', async () => {
      const { actor, caller } = setup('operator_b');
      const goal = await caller.createGoal({ ownerId: actor.id, title: 'g', outcome: 'o' });
      const product = await caller.createProduct({
        goalId: goal.id,
        name: 'P',
        category: 'c',
        route: '/p',
      });

      const item = await caller.createWorkItem({
        goalId: goal.id,
        productId: product.id,
        type: 'review',
        assignedTo: 'operator_b',
        title: 'Valid role',
        detail: 'Accepted',
      });
      expect(item.assignedTo).toBe('operator_b');
    });

    it('restricts createUser to owners', async () => {
      const { caller: operator } = setup('operator_a');
      await expect(
        operator.createUser({ name: 'New', role: 'operator_b' }),
      ).rejects.toThrow(/Owner role required/);

      const { caller: owner } = setup('owner');
      await expect(
        owner.createUser({ name: 'New', role: 'operator_b' }),
      ).resolves.toMatchObject({ role: 'operator_b' });
    });
  });
});
