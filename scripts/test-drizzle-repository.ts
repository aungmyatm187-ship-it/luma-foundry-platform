/**
 * Integration test for DrizzleRepository.
 *
 * Runs against the live Supabase project. Creates two test users, exercises
 * every method, verifies RLS isolation, verifies the DB clearance trigger,
 * and cleans up. Safe to re-run.
 *
 * Note: setup and cleanup must run inside a transaction with the JWT claim
 * set, because the users RLS policy enforces auth.uid() = auth_user_id on
 * INSERT and DELETE.
 *
 * Usage: npx tsx scripts/test-drizzle-repository.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

import { DrizzleRepository } from '../packages/core/src/drizzle-repository.js';

const userA = 'aaaaaaaa-0000-0000-0000-000000000001';
const userB = 'bbbbbbbb-0000-0000-0000-000000000001';

const raw = postgres(process.env.DATABASE_URL!, { prepare: false });

async function asUser<T>(authUserId: string, fn: (tx: any) => Promise<T>): Promise<T> {
  return raw.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: authUserId })}, true)`;
    return fn(tx);
  });
}

async function setupUser(authUserId: string, name: string): Promise<string> {
  return asUser(authUserId, async (tx) => {
    await tx`
      insert into public.users (auth_user_id, name, role)
      values (${authUserId}, ${name}, 'owner')
      on conflict (auth_user_id) do nothing
    `;
    const [u] = await tx`select id from public.users where auth_user_id = ${authUserId}`;
    return u.id as string;
  });
}

async function cleanup() {
  // RLS forbids cross-user deletes, so each user must clean their own row.
  try { await asUser(userA, (tx) => tx`delete from public.users where auth_user_id = ${userA}`); } catch {}
  try { await asUser(userB, (tx) => tx`delete from public.users where auth_user_id = ${userB}`); } catch {}
}

const pass = (ok: boolean) => (ok ? '✅ PASS' : '❌ FAIL');

async function main() {
  try {
    console.log('══ DrizzleRepository Integration Test ══\n');

    await cleanup();
    console.log('── Setup ──');
    const aId = await setupUser(userA, 'Test User A');
    const bId = await setupUser(userB, 'Test User B');
    console.log('  A userId:', aId);
    console.log('  B userId:', bId);

    const repoA = new DrizzleRepository(userA);
    const repoB = new DrizzleRepository(userB);

    console.log('\n── Test 1: A creates goal via DrizzleRepository ──');
    const goalA = await repoA.createGoal({
      ownerId: aId,
      title: 'Goal from A',
      outcome: 'Verify DrizzleRepository works',
    });
    console.log('  Created:', goalA.id, '|', goalA.title);
    console.log('  Result:', pass(Boolean(goalA.id)));

    console.log('\n── Test 2: A snapshots — should see 1 goal ──');
    const snapA = await repoA.snapshot();
    console.log('  A sees goals:', snapA.goals.length);
    console.log('  Result:', pass(snapA.goals.length === 1));

    console.log('\n── Test 3: B snapshots — should see 0 goals (RLS isolation) ──');
    const snapB = await repoB.snapshot();
    console.log('  B sees goals:', snapB.goals.length);
    console.log('  Result:', pass(snapB.goals.length === 0));

    console.log('\n── Test 4: A creates product, tries to clear without evidence ──');
    const productA = await repoA.createProduct({
      goalId: goalA.id,
      name: 'Test Product',
      category: 'Test',
      route: '/test',
    });
    console.log('  Product:', productA.id, '| status:', productA.status);
    let triggerCaught = false;
    let triggerMessage = '';
    try {
      await repoA.updateProductStatus(productA.id, 'cleared');
    } catch (e) {
      triggerCaught = true;
      triggerMessage = (e as Error).message.slice(0, 100);
    }
    console.log('  Error:', triggerMessage);
    console.log('  Result:', pass(triggerCaught));

    console.log('\n── Test 5: A records 8 evidence kinds, then clears ──');
    const kinds = [
      'source_commit','design_history','asset_licence','contributor_rights',
      'dependency_sbom','third_party_notices','counsel_review','buyer_terms',
    ] as const;
    for (const kind of kinds) {
      await repoA.recordEvidence({
        productId: productA.id,
        kind,
        reference: 'test-ref',
        note: 'test-note',
        recordedBy: 'operator_a',
      });
    }
    const evidenceRows = await repoA.evidenceFor(productA.id);
    console.log('  Evidence rows:', evidenceRows.length);
    console.log('  First hash:', evidenceRows[0]?.rowHash?.slice(0, 16) ?? '(none)');

    const cleared = await repoA.updateProductStatus(productA.id, 'cleared');
    console.log('  Product status after clear:', cleared.status);
    console.log('  Result:', pass(cleared.status === 'cleared'));

    console.log('\n── Test 6: B cannot see A evidence ──');
    const evidenceB = await repoB.evidenceFor(productA.id);
    console.log('  B sees evidence rows:', evidenceB.length);
    console.log('  Result:', pass(evidenceB.length === 0));

    console.log('\n── Cleanup ──');
    await cleanup();
    console.log('  Cleaned.');

    console.log('\n══ Test complete ══');
  } catch (e) {
    console.error('\n❌ ERROR:', (e as Error).message);
    console.error((e as Error).stack);
    try { await cleanup(); } catch { /* ignore */ }
  } finally {
    await raw.end();
  }
}

main();
