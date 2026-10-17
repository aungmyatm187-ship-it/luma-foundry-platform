/**
 * Exercises the tRPC router through a real caller — the same procedure path the
 * web app uses.
 *
 * Every procedure is protected, so tests build a context that satisfies the
 * Context type: { authUserId, actor, ws }. The ws is in-memory — these tests
 * verify rule correctness, not persistence. Persistence is verified separately by
 * scripts/test-drizzle-repository.ts against live Postgres.
 *
 * The actor is a real users row created in the same workspace, bound onto the
 * context the way createContext binds the one resolved from the verified JWT.
 * Nothing here is mocked, so the role checks run through the real router and
 * real governance rules.
 */
import { AsyncWorkspace, EVIDENCE_KINDS, type Role } from '@luma/core';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../src/router.js';
import type { Actor, Context } from '../src/trpc.js';

type Caller = ReturnType<typeof appRouter.createCaller>;

/** Adds a user with `role` to `ws` and returns a caller acting as that user. */
async function callerFor(
  ws: AsyncWorkspace,
  role: Role,
): Promise<{ actor: Actor; caller: Caller }> {
  const user = await ws.createUser(`${role} user`, role);
  const actor: Actor = { id: user.id, role: user.role };
  const ctx: Context = { authUserId: `auth-${user.id}`, actor, ws };
  return { actor, caller: appRouter.createCaller(ctx) };
}

/**
 * A workspace plus a caller acting as `role`. A separate owner row always
 * exists because goals need a real owner, and the acting user may not be one.
 * `callerAs` adds another actor to the SAME workspace, for tests that need two
 * roles to act on the same data.
 */
async function setup(role: Role = 'owner') {
  const ws = AsyncWorkspace.fromInMemory();
  const owner = await ws.createUser('Owner', 'owner');
  const { actor, caller } = await callerFor(ws, role);
  return {
    ws,
    ownerId: owner.id,
    actor,
    caller,
    callerAs: (other: Role) => callerFor(ws, other),
  };
}

async function seedProduct(caller: Caller, ownerId: string) {
  const goal = await caller.createGoal({ ownerId, title: 'g', outcome: 'o' });
  const product = await caller.createProduct({
    goalId: goal.id,
    name: 'P',
    category: 'c',
    route: '/p',
  });
  return { goal, product };
}

describe('workspace router', () => {
  it('rejects unauthenticated calls with UNAUTHORIZED', async () => {
    const ws = AsyncWorkspace.fromInMemory();
    const caller = appRouter.createCaller({ authUserId: null, actor: null, ws });
    await expect(caller.snapshot()).rejects.toThrow(/Authentication required/);
  });

  it('rejects a verified identity that has no actor with FORBIDDEN', async () => {
    // Distinct from UNAUTHORIZED: the session is valid but holds no role, so
    // nothing it attributes could be trusted.
    const ws = AsyncWorkspace.fromInMemory();
    const caller = appRouter.createCaller({ authUserId: 'unprovisioned', actor: null, ws });
    await expect(caller.snapshot()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('runs createGoal -> createProduct -> snapshot', async () => {
    const { ownerId, caller } = await setup('owner');

    const goal = await caller.createGoal({
      ownerId,
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
    const { ownerId, caller } = await setup('owner');
    const goal = await caller.createGoal({ ownerId, title: 'g', outcome: 'o' });
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
    const { ownerId, caller } = await setup('owner');
    const goal = await caller.createGoal({ ownerId, title: 'g', outcome: 'o' });
    const decision = await caller.createDecision({
      goalId: goal.id,
      title: 'Ship Ember Signal?',
      context: 'First real product',
      decision: 'Ship',
      ownerId,
    });
    expect(decision.status).toBe('open');
    expect(decision.resolvedAt).toBeNull();

    const approved = await caller.updateDecisionStatus({
      decisionId: decision.id,
      status: 'approved',
    });
    expect(approved.status).toBe('approved');
    expect(approved.decidedBy).toBe('owner');
    expect(approved.resolvedAt).not.toBeNull();
  });

  it('rejects products that belong to a different goal', async () => {
    const { ownerId, caller } = await setup('owner');
    const goalA = await caller.createGoal({ ownerId, title: 'Goal A', outcome: 'A' });
    const goalB = await caller.createGoal({ ownerId, title: 'Goal B', outcome: 'B' });
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
        ownerId,
      }),
    ).rejects.toThrow(/does not belong to the selected goal/);
  });

  it('rejects invalid input via schema validation', async () => {
    const { caller } = await setup('owner');
    await expect(
      caller.createProduct({ goalId: 'goal-1', name: '', category: 'c', route: '/x' }),
    ).rejects.toThrow();
  });

  // The `as never` casts below send fields that no longer exist in the input
  // schemas, to prove an old or hostile client cannot choose its own attribution:
  // zod strips unknown keys, so the server-derived value is what gets stored.
  describe('server-derived roles', () => {
    it('operator_a cannot createUser', async () => {
      const { ws, caller, callerAs } = await setup('operator_a');
      const before = (await ws.snapshot()).users.length;

      await expect(
        caller.createUser({ name: 'Intruder', role: 'owner' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        caller.createUser({ name: 'Peer', role: 'operator_b' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect((await ws.snapshot()).users.length).toBe(before);

      // Control: the refusal is about the actor's role, not about createUser
      // being broken.
      const { caller: owner } = await callerAs('owner');
      await expect(
        owner.createUser({ name: 'New B', role: 'operator_b' }),
      ).resolves.toMatchObject({ role: 'operator_b' });
    });

    it('derives recordedBy from the actor, ignoring a spoofed value', async () => {
      const { caller, ownerId, callerAs } = await setup('operator_a');
      const { product } = await seedProduct(caller, ownerId);

      const honest = await caller.recordEvidence({
        productId: product.id,
        kind: 'source_commit',
        reference: 'abc123',
        note: 'build commit',
      });
      expect(honest.recordedBy).toBe('operator_a');

      const spoofed = await caller.recordEvidence({
        productId: product.id,
        kind: 'design_history',
        reference: 'x',
        note: 'x',
        recordedBy: 'owner',
      } as never);
      expect(spoofed.recordedBy).toBe('operator_a');

      const { caller: operatorB } = await callerAs('operator_b');
      const verified = await operatorB.recordEvidence({
        productId: product.id,
        kind: 'asset_licence',
        reference: 'licence.pdf',
        note: 'verified',
      });
      expect(verified.recordedBy).toBe('operator_b');
    });

    it('operator_a cannot clear a product', async () => {
      const { caller, ownerId, callerAs } = await setup('operator_a');
      const { product } = await seedProduct(caller, ownerId);

      // Full evidence, so governance would allow clearance and only the role
      // check can be what refuses it. Everything is recorded as operator_a for
      // brevity; the gate checks that evidence exists, not who authored it.
      for (const kind of EVIDENCE_KINDS) {
        await caller.recordEvidence({
          productId: product.id,
          kind,
          reference: `ref-${kind}`,
          note: kind,
        });
      }
      await expect(
        caller.checkClearance({ productId: product.id }),
      ).resolves.toMatchObject({ clearable: true });

      await expect(
        caller.setProductStatus({ productId: product.id, status: 'cleared' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      const stored = (await caller.snapshot()).products.find((p) => p.id === product.id);
      expect(stored?.status).toBe('concept');

      // Only 'cleared' is withheld; the builder can still move its own product.
      await expect(
        caller.setProductStatus({ productId: product.id, status: 'in_build' }),
      ).resolves.toMatchObject({ status: 'in_build' });

      const { caller: owner } = await callerAs('owner');
      await expect(
        owner.setProductStatus({ productId: product.id, status: 'cleared' }),
      ).resolves.toMatchObject({ status: 'cleared' });
    });

    it('operator_a cannot approve a decision', async () => {
      const { caller, ownerId } = await setup('operator_a');
      const goal = await caller.createGoal({ ownerId, title: 'g', outcome: 'o' });
      const decision = await caller.createDecision({
        goalId: goal.id,
        title: 'Ship?',
        context: 'c',
        decision: 'Ship',
        ownerId,
      });

      await expect(
        caller.updateDecisionStatus({ decisionId: decision.id, status: 'approved' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        caller.updateDecisionStatus({ decisionId: decision.id, status: 'declined' }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });

      const stored = (await caller.snapshot()).decisions.find((d) => d.id === decision.id);
      expect(stored).toMatchObject({ status: 'open', decidedBy: null, resolvedAt: null });
    });

    it('lets the owner approve, with decidedBy recorded as owner', async () => {
      const { caller, ownerId } = await setup('owner');
      const goal = await caller.createGoal({ ownerId, title: 'g', outcome: 'o' });
      const decision = await caller.createDecision({
        goalId: goal.id,
        title: 'Ship?',
        context: 'c',
        decision: 'Ship',
        ownerId,
      });

      // A spoofed decidedBy must not leak into the audit trail.
      const approved = await caller.updateDecisionStatus({
        decisionId: decision.id,
        status: 'approved',
        decidedBy: 'operator_a',
      } as never);
      expect(approved.status).toBe('approved');
      expect(approved.decidedBy).toBe('owner');
      expect(approved.resolvedAt).not.toBeNull();
    });

    it('derives fromRole from the actor and takes toRole from input', async () => {
      const { caller, ownerId } = await setup('operator_a');
      const { goal, product } = await seedProduct(caller, ownerId);

      const handoff = await caller.createHandoff({
        goalId: goal.id,
        productId: product.id,
        toRole: 'operator_b',
        title: 'Verify rights',
        summary: 'Built and committed',
        asks: 'Verify asset licence and contributor rights',
      });
      expect(handoff.fromRole).toBe('operator_a');
      expect(handoff.toRole).toBe('operator_b');

      // Sender is attribution (ignored if supplied); recipient is a choice
      // (honoured even when it is 'owner').
      const spoofed = await caller.createHandoff({
        goalId: goal.id,
        productId: product.id,
        toRole: 'owner',
        fromRole: 'owner',
        title: 'Spoof attempt',
        summary: 's',
        asks: 'a',
      } as never);
      expect(spoofed.fromRole).toBe('operator_a');
      expect(spoofed.toRole).toBe('owner');
    });

    it('keeps assignedTo as the caller-supplied choice', async () => {
      // Guards against rewriting assignedTo to the acting role, which PR #26
      // did by mistake. An operator assigning work to someone else is normal.
      const { caller, ownerId } = await setup('operator_a');
      const { goal, product } = await seedProduct(caller, ownerId);

      for (const assignedTo of ['operator_b', 'owner', 'operator_a'] as const) {
        const item = await caller.createWorkItem({
          goalId: goal.id,
          productId: product.id,
          type: 'review',
          assignedTo,
          title: `For ${assignedTo}`,
          detail: 'Assignment is a choice, not attribution',
        });
        expect(item.assignedTo).toBe(assignedTo);
      }
    });
  });
});
