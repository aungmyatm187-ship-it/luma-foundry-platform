import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

const databaseUrl = process.env.RLS_TEST_DATABASE_URL;
if (!databaseUrl) {
  throw new Error('RLS_TEST_DATABASE_URL must point to a disposable, empty Postgres database.');
}
const databaseAddress = new URL(databaseUrl);
if (
  !['localhost', '127.0.0.1', '::1'].includes(databaseAddress.hostname) ||
  databaseAddress.pathname !== '/luma_rls_test'
) {
  throw new Error('Refusing to run migrations except on local database luma_rls_test.');
}

const root = process.cwd();
const db = postgres(databaseUrl, { max: 1, prepare: false });
const userA = 'aaaaaaaa-0000-0000-0000-000000000001';
const userB = 'bbbbbbbb-0000-0000-0000-000000000001';
const evidenceKinds = [
  'source_commit',
  'design_history',
  'asset_licence',
  'contributor_rights',
  'dependency_sbom',
  'third_party_notices',
  'counsel_review',
  'buyer_terms',
];

async function applySqlFile(filePath) {
  const contents = await readFile(filePath, 'utf8');
  await db.unsafe(contents);
  console.log(`Applied ${path.relative(root, filePath)}`);
}

async function asRole(authUserId, callback, role = 'app_user') {
  return db.begin(async (tx) => {
    await tx.unsafe(`SET LOCAL ROLE ${role}`);
    if (authUserId) {
      await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: authUserId })}, true)`;
    }
    return callback(tx);
  });
}

async function asDatabaseOwner(callback) {
  return db.begin(callback);
}

async function expectSqlFailure(label, operation, allowedCodes = ['42501', '23503', '23514']) {
  try {
    await operation();
  } catch (error) {
    assert.ok(
      allowedCodes.includes(error.code),
      `${label}: expected a SQL authorization/constraint failure, got ${error.code}: ${error.message}`,
    );
    console.log(`PASS ${label} (SQLSTATE ${error.code})`);
    return;
  }
  assert.fail(`${label}: operation unexpectedly succeeded`);
}

async function bootstrap() {
  const existingSchema = await db`SELECT to_regclass('public.users') AS users_table`;
  if (existingSchema[0]?.users_table) {
    throw new Error('RLS_TEST_DATABASE_URL must point to an empty database; public.users already exists.');
  }
  for (const roleDdl of [
    'CREATE ROLE anon NOLOGIN',
    'CREATE ROLE authenticated NOLOGIN',
    'CREATE ROLE service_role NOLOGIN BYPASSRLS',
    'CREATE ROLE app_user LOGIN NOBYPASSRLS',
  ]) {
    await db.unsafe(`DO $role$ BEGIN ${roleDdl}; EXCEPTION WHEN duplicate_object THEN NULL; END $role$`);
  }
  await db.unsafe('CREATE SCHEMA auth');
  await db.unsafe('CREATE SCHEMA extensions');
  await db.unsafe('CREATE EXTENSION pgcrypto WITH SCHEMA extensions');
  await db.unsafe(`
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $uid$
      SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
    $uid$
  `);
  await db.unsafe(`
    CREATE TABLE auth.users (
      id uuid PRIMARY KEY,
      email text,
      raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
    )
  `);
  await db.unsafe('GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, app_user');
  await db.unsafe('GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, app_user');
}

async function applyMigrations() {
  const drizzleDir = path.join(root, 'drizzle');
  const drizzleFiles = (await readdir(drizzleDir))
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();
  assert.ok(drizzleFiles.length >= 2, 'Expected the initial and follow-up Drizzle migrations.');
  for (const name of drizzleFiles) await applySqlFile(path.join(drizzleDir, name));

  const manualDir = path.join(drizzleDir, 'manual');
  const manualFiles = (await readdir(manualDir))
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort();
  assert.deepEqual(
    manualFiles,
    [
      '0001_evidence_hash_chain.sql',
      '0002_link_auth_users.sql',
      '0003_enforce_product_clearance.sql',
      '0004_policies_to_public.sql',
      '0005_security_linter_fixes.sql',
      '0006_least_privilege_grants.sql',
    ],
    'Manual migration chain must remain complete and ordered.',
  );
  for (const name of manualFiles) await applySqlFile(path.join(manualDir, name));
}

async function seedAuthUsers() {
  await db`
    INSERT INTO auth.users (id, email)
    VALUES (${userA}, 'rls-a@example.invalid'), (${userB}, 'rls-b@example.invalid')
  `;
  const [a] = await db`SELECT id FROM public.users WHERE auth_user_id = ${userA}`;
  const [b] = await db`SELECT id FROM public.users WHERE auth_user_id = ${userB}`;
  assert.ok(a?.id && b?.id, 'Auth signup trigger must provision public.users rows.');
  return { internalA: a.id, internalB: b.id };
}

async function runSecurityAssertions({ internalA, internalB }) {
  const runtimeRole = await db`
    SELECT role.rolcanlogin, role.rolsuper, role.rolbypassrls
    FROM pg_catalog.pg_roles AS role
    WHERE role.rolname = 'app_user'
  `;
  assert.equal(runtimeRole.length, 1);
  assert.equal(runtimeRole[0].rolcanlogin, true);
  assert.equal(runtimeRole[0].rolsuper, false);
  assert.equal(runtimeRole[0].rolbypassrls, false);

  const tableState = await db`
    SELECT relation.relname, relation.relrowsecurity,
           pg_catalog.pg_get_userbyid(relation.relowner) AS owner
    FROM pg_catalog.pg_class AS relation
    JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = ANY(${db.array([
        'users', 'goals', 'products', 'work_items', 'handoffs', 'decisions', 'evidence',
      ])}::text[])
  `;
  assert.equal(tableState.length, 7);
  for (const table of tableState) {
    assert.equal(table.relrowsecurity, true, `${table.relname} must have RLS enabled`);
    assert.notEqual(table.owner, 'app_user', `${table.relname} must not be owned by app_user`);
  }
  console.log('PASS all seven workspace tables have RLS; app_user is not an owner or RLS bypass role');

  const policyRoles = await db`
    SELECT tablename, roles
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
  `;
  assert.equal(policyRoles.length, 7);
  for (const policy of policyRoles) {
    assert.ok(policy.roles.includes('public'), `${policy.tablename} policy must cover app_user`);
  }
  console.log('PASS every workspace RLS policy applies to PUBLIC, including app_user');

  const clientGrants = await db`
    SELECT
      pg_catalog.has_table_privilege('anon', 'public.goals', 'SELECT') AS anon_can_read,
      pg_catalog.has_table_privilege('authenticated', 'public.goals', 'SELECT') AS authenticated_can_read,
      pg_catalog.has_table_privilege('app_user', 'public.goals', 'SELECT') AS app_can_read,
      pg_catalog.has_table_privilege('app_user', 'public.goals', 'INSERT') AS app_can_insert,
      pg_catalog.has_table_privilege('app_user', 'public.users', 'UPDATE') AS app_can_update_user
  `;
  assert.equal(clientGrants[0].anon_can_read, false);
  assert.equal(clientGrants[0].authenticated_can_read, false);
  assert.equal(clientGrants[0].app_can_read, true);
  assert.equal(clientGrants[0].app_can_insert, true);
  assert.equal(clientGrants[0].app_can_update_user, false);
  console.log('PASS explicit least-privilege table grants; user role metadata is not writable by app_user');

  await db.unsafe('CREATE TABLE public.rls_default_grant_probe (id integer PRIMARY KEY)');
  const defaultGrants = await db`
    SELECT
      pg_catalog.has_table_privilege('anon', 'public.rls_default_grant_probe', 'SELECT') AS anon_can_read,
      pg_catalog.has_table_privilege('authenticated', 'public.rls_default_grant_probe', 'SELECT') AS authenticated_can_read,
      pg_catalog.has_table_privilege('app_user', 'public.rls_default_grant_probe', 'SELECT') AS app_can_read
  `;
  assert.equal(defaultGrants[0].anon_can_read, false);
  assert.equal(defaultGrants[0].authenticated_can_read, false);
  assert.equal(defaultGrants[0].app_can_read, false);
  await db.unsafe('DROP TABLE public.rls_default_grant_probe');
  console.log('PASS future public tables default to no Data API or app_user access');

  const { goalA, productA } = await asRole(userA, async (tx) => {
    const [goal] = await tx`
      INSERT INTO public.goals (owner_id, title, outcome)
      VALUES (${internalA}, 'Goal A', 'RLS test')
      RETURNING id
    `;
    const [product] = await tx`
      INSERT INTO public.products (goal_id, name, category, route)
      VALUES (${goal.id}, 'Product A', 'Test', '/rls-a')
      RETURNING id
    `;
    return { goalA: goal.id, productA: product.id };
  });
  const { goalB, productB } = await asRole(userB, async (tx) => {
    const [goal] = await tx`
      INSERT INTO public.goals (owner_id, title, outcome)
      VALUES (${internalB}, 'Goal B', 'RLS test')
      RETURNING id
    `;
    const [product] = await tx`
      INSERT INTO public.products (goal_id, name, category, route)
      VALUES (${goal.id}, 'Product B', 'Test', '/rls-b')
      RETURNING id
    `;
    return { goalB: goal.id, productB: product.id };
  });

  const hidden = await asRole(userA, async (tx) => {
    const goals = await tx`SELECT id FROM public.goals WHERE id = ${goalB}`;
    const products = await tx`SELECT id FROM public.products WHERE id = ${productB}`;
    return { goals, products };
  });
  assert.equal(hidden.goals.length, 0);
  assert.equal(hidden.products.length, 0);
  console.log('PASS user A cannot read user B goals or products');

  await expectSqlFailure('composite work item foreign key rejects cross-goal references', () =>
    asDatabaseOwner((tx) => tx`
      INSERT INTO public.work_items (goal_id, product_id, type, assigned_to, title, detail)
      VALUES (${goalA}, ${productB}, 'build', 'operator_a', 'bad link', 'must fail')
    `),
    ['23503'],
  );
  await expectSqlFailure('composite handoff foreign key rejects cross-goal references', () =>
    asDatabaseOwner((tx) => tx`
      INSERT INTO public.handoffs (goal_id, product_id, from_role, to_role, title, summary, asks)
      VALUES (${goalA}, ${productB}, 'operator_a', 'operator_b', 'bad link', 'must fail', 'must fail')
    `),
    ['23503'],
  );
  await expectSqlFailure('composite decision foreign key rejects cross-goal references', () =>
    asDatabaseOwner((tx) => tx`
      INSERT INTO public.decisions (goal_id, product_id, title, context, decision, owner_id)
      VALUES (${goalA}, ${productB}, 'bad link', 'must fail', 'must fail', ${internalA})
    `),
    ['23503'],
  );

  await expectSqlFailure('cross-goal work item reference is rejected', () =>
    asRole(userA, (tx) => tx`
      INSERT INTO public.work_items (goal_id, product_id, type, assigned_to, title, detail)
      VALUES (${goalA}, ${productB}, 'build', 'operator_a', 'bad link', 'must fail')
    `),
  );
  await expectSqlFailure('cross-goal handoff reference is rejected', () =>
    asRole(userA, (tx) => tx`
      INSERT INTO public.handoffs (goal_id, product_id, from_role, to_role, title, summary, asks)
      VALUES (${goalA}, ${productB}, 'operator_a', 'operator_b', 'bad link', 'must fail', 'must fail')
    `),
  );
  await expectSqlFailure('cross-goal decision reference is rejected', () =>
    asRole(userA, (tx) => tx`
      INSERT INTO public.decisions (goal_id, product_id, title, context, decision, owner_id)
      VALUES (${goalA}, ${productB}, 'bad link', 'must fail', 'must fail', ${internalA})
    `),
  );

  const validRows = await asRole(userA, async (tx) => {
    const [workItem] = await tx`
      INSERT INTO public.work_items (goal_id, product_id, type, assigned_to, title, detail)
      VALUES (${goalA}, ${productA}, 'build', 'operator_a', 'valid work', 'valid')
      RETURNING id
    `;
    const [handoff] = await tx`
      INSERT INTO public.handoffs (goal_id, product_id, from_role, to_role, title, summary, asks)
      VALUES (${goalA}, ${productA}, 'operator_a', 'operator_b', 'valid handoff', 'valid', 'review')
      RETURNING id
    `;
    const [decision] = await tx`
      INSERT INTO public.decisions (goal_id, product_id, title, context, decision, owner_id)
      VALUES (${goalA}, ${productA}, 'valid decision', 'valid', 'approve', ${internalA})
      RETURNING id
    `;
    return { workItem, handoff, decision };
  });
  assert.ok(validRows.workItem?.id && validRows.handoff?.id && validRows.decision?.id);
  console.log('PASS same-goal work item, handoff, and decision references are accepted');

  await expectSqlFailure(
    'direct clearance without evidence is rejected by the database trigger',
    () => asRole(userA, (tx) => tx`UPDATE public.products SET status = 'cleared' WHERE id = ${productA}`),
    ['23514'],
  );

  await asRole(userA, async (tx) => {
    for (const kind of evidenceKinds) {
      await tx`
        INSERT INTO public.evidence (product_id, kind, reference, note, recorded_by)
        VALUES (${productA}, ${kind}, 'test-reference', 'test evidence', 'operator_a')
      `;
    }
    await tx`UPDATE public.products SET status = 'cleared' WHERE id = ${productA}`;
  });
  const cleared = await asRole(userA, (tx) => tx`SELECT status FROM public.products WHERE id = ${productA}`);
  assert.equal(cleared[0]?.status, 'cleared');
  console.log('PASS clearance succeeds only after all eight required evidence kinds exist');

  const bCannotReadEvidence = await asRole(userB, (tx) => tx`SELECT id FROM public.evidence WHERE product_id = ${productA}`);
  assert.equal(bCannotReadEvidence.length, 0);
  console.log('PASS user B cannot read user A evidence');

  await expectSqlFailure(
    'anonymous Data API role has no direct workspace table grant',
    () => asRole(null, (tx) => tx`SELECT id FROM public.goals`, 'anon'),
  );
  await expectSqlFailure(
    'authenticated Data API role has no direct workspace table grant',
    () => asRole(userA, (tx) => tx`SELECT id FROM public.goals`, 'authenticated'),
  );
  await expectSqlFailure(
    'runtime app_user cannot mutate its users.role metadata',
    () => asRole(userA, (tx) => tx`UPDATE public.users SET role = 'operator_a' WHERE auth_user_id = ${userA}`),
  );
}

try {
  await bootstrap();
  await applyMigrations();
  const users = await seedAuthUsers();
  await runSecurityAssertions(users);
  console.log('\nRLS/database regression suite passed.');
} catch (error) {
  console.error('\nRLS/database regression suite failed:', error);
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 5 });
}
