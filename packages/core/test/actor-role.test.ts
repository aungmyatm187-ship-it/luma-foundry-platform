/**
 * Server-derived actor roles.
 *
 * The invariant under test: the role recorded for a write is the role resolved
 * from the session identity, never a value the caller supplies. A caller may
 * describe a role; it may not grant itself one.
 */
import { describe, expect, it } from 'vitest';
import {
  AsyncWorkspace,
  GovernanceError,
  InMemoryRepository,
  Workspace,
  resolveRecordedRole,
  type Role,
} from '../src/index.js';

describe('resolveRecordedRole', () => {
  it('returns the actor role when no role is claimed', () => {
    expect(resolveRecordedRole('operator_a')).toBe('operator_a');
  });

  it('returns the actor role when the claim matches', () => {
    expect(resolveRecordedRole('operator_b', 'operator_b')).toBe('operator_b');
    expect(resolveRecordedRole('owner', 'owner')).toBe('owner');
  });

  it('rejects a non-owner claiming owner', () => {
    expect(() => resolveRecordedRole('operator_a', 'owner')).toThrow(GovernanceError);
    expect(() => resolveRecordedRole('operator_b', 'owner')).toThrow(/may not record work as 'owner'/);
  });

  it('records the actor role when an owner acts as an operator', () => {
    expect(resolveRecordedRole('owner', 'operator_a')).toBe('owner');
    expect(resolveRecordedRole('owner', 'operator_b')).toBe('owner');
  });

  it('records the actor role for any other mismatch', () => {
    expect(resolveRecordedRole('operator_a', 'operator_b')).toBe('operator_a');
  });
});

function boundWorkspace(role: Role) {
  const store = new Workspace();
  const actor = store.createUser(`${role} user`, role);
  const ws = AsyncWorkspace.fromInMemory(store, actor);
  const owner = store.createUser('Owner', 'owner');
  const goal = store.createGoal({ ownerId: owner.id, title: 'g', outcome: 'o' });
  const product = store.createProduct({ goalId: goal.id, name: 'P', category: 'c', route: '/p' });
  return { store, actor, ws, goal, product };
}

describe('AsyncWorkspace: bound actor is authoritative', () => {
  it('exposes the bound session actor', async () => {
    const { ws, actor } = boundWorkspace('operator_a');
    await expect(ws.currentUser()).resolves.toMatchObject({ id: actor.id, role: 'operator_a' });
  });

  it('rejects an operator claiming owner on a work item', async () => {
    const { ws, goal, product } = boundWorkspace('operator_a');
    await expect(
      ws.createWorkItem({
        goalId: goal.id,
        productId: product.id,
        type: 'build',
        assignedTo: 'owner',
        title: 't',
        detail: 'd',
      }),
    ).rejects.toThrow(/may not record work as 'owner'/);
  });

  it('rejects an operator claiming owner on evidence', async () => {
    const { ws, product } = boundWorkspace('operator_b');
    await expect(
      ws.recordEvidence({
        productId: product.id,
        kind: 'source_commit',
        reference: 'x',
        note: 'x',
        recordedBy: 'owner',
      }),
    ).rejects.toThrow(/may not record work as 'owner'/);
  });

  it('records the server role when an owner acts as an operator', async () => {
    const { ws, goal, product } = boundWorkspace('owner');
    const item = await ws.createWorkItem({
      goalId: goal.id,
      productId: product.id,
      type: 'build',
      assignedTo: 'operator_b',
      title: 't',
      detail: 'd',
    });
    expect(item.assignedTo).toBe('owner');
  });

  it('records the server role on a decision', async () => {
    const { ws, goal } = boundWorkspace('owner');
    const decision = await ws.createDecision({
      goalId: goal.id,
      title: 't',
      context: 'c',
      decision: 'd',
      ownerId: goal.ownerId,
    });
    const resolved = await ws.updateDecisionStatus(decision.id, 'approved', 'operator_b');
    expect(resolved.decidedBy).toBe('owner');
  });
});

describe('AsyncWorkspace: unbound keeps standalone behaviour', () => {
  it('currentUser is null and the caller label is preserved', async () => {
    const ws = AsyncWorkspace.fromInMemory();
    await expect(ws.currentUser()).resolves.toBeNull();
  });
});

describe('InMemoryRepository.currentUser', () => {
  it('returns null when no actor is bound', async () => {
    await expect(new InMemoryRepository().currentUser()).resolves.toBeNull();
  });
});
