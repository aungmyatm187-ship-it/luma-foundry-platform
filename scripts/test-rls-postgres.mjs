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

// Synthetic fixture identities. All values are invented test data; nothing here
// is a real account, and no credentials are involved (the auth stub issues its
// own identities via request.jwt.claims).
//
// Legacy users are seeded BEFORE migration 0007 so the backfill has real rows
// to place; signup users are created AFTER 0007 so the replacement
// handle_new_user() trigger governs them.
const legacyUsers = {
  A: 'aaaaaaaa-0000-0000-0000-000000000001', // global 'owner', owns a goal  -> 'Luma Foundry' owner
  B: 'bbbbbbbb-0000-0000-0000-000000000001', // global 'operator_a', owns a goal -> 'Luma Foundry' member
  C: 'cccccccc-0000-0000-0000-000000000001', // global 'operator_b', owns nothing -> 'Luma Foundry' member
  D: 'dddddddd-0000-0000-0000-000000000001', // global 'owner', owns nothing -> personal workspace owner
};
const signupUsers = {
  E: 'eeeeeeee-0000-0000-0000-000000000001', // post-0007 signup -> users.role 'pending' + personal workspace
  F: 'ffffffff-0000-0000-0000-000000000001', // post-0007 signup -> member of E's "Widget Lab" workspace
  G: '99999999-0000-0000-0000-000000000001', // post-0007 signup -> stranger, for cross-workspace denial
};
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
      SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
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

/**
 * Applies the Drizzle chain and manual migrations 0001-0006. Returns the path
 * of 0007 WITHOUT applying it: the backfill inside 0007 is a data migration,
 * so the suite seeds deterministic synthetic pre-0007 rows in between and only
 * then applies 0007. This is what makes the backfill observable.
 */
async function applyMigrationsThrough0006() {
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
      '0007_workspace_membership.sql',
      '0008_workspace_invitations.sql',
      '0009_per_owner_workspaces_and_strict_attribution.sql',
    ],
    'Manual migration chain must remain complete and ordered.',
  );
  const through0006 = manualFiles.filter((name) => name !== '0007_workspace_membership.sql');
  assert.equal(through0006.length, 6, 'Expected manual migrations 0001-0006 before the 0007 backfill phase.');
  for (const name of through0006) await applySqlFile(path.join(manualDir, name));
  return path.join(manualDir, '0007_workspace_membership.sql');
}

/**
 * Deterministic synthetic pre-0007 world, seeded as the database owner (the
 * role that applied migrations 0001-0006). It exercises every branch of the
 * 0007 backfill rule:
 *   A: global role 'owner' AND owns a goal  -> default workspace, owner role
 *   B: global role 'operator_a' AND owns a goal -> default workspace, member
 *   C: global role 'operator_b', owns nothing   -> default workspace, member
 *   D: global role 'owner', owns nothing        -> personal workspace, owner
 * created_at values are explicit so any ordering (e.g. the oldest-user owner
 * promotion) is deterministic.
 */
async function seedLegacyFixtures() {
  const names = { A: 'Ada Owner', B: 'Ben Operator', C: 'Cara Operator', D: 'Dara Owner' };
  for (const [key, authUserId] of Object.entries(legacyUsers)) {
    await db`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES (${authUserId}, ${`legacy-${key.toLowerCase()}@example.invalid`},
              ${db.json({ name: names[key] })})
    `;
  }
  // 0002's handle_new_user gives every pre-0007 signup the global role 'owner'.
  // Simulate the pre-0007 operator assignments the backfill rule reacts to.
  await db`UPDATE public.users SET role = 'operator_a' WHERE auth_user_id = ${legacyUsers.B}`;
  await db`UPDATE public.users SET role = 'operator_b' WHERE auth_user_id = ${legacyUsers.C}`;
  // Explicit created_at ordering: A < B < C < D (deterministic for tie-breaks).
  const createdAt = {
    A: '2026-01-01T09:00:00Z',
    B: '2026-01-02T09:00:00Z',
    C: '2026-01-03T09:00:00Z',
    D: '2026-01-04T09:00:00Z',
  };
  for (const [key, authUserId] of Object.entries(legacyUsers)) {
    await db`UPDATE public.users SET created_at = ${createdAt[key]}::timestamptz WHERE auth_user_id = ${authUserId}`;
  }

  const [a] = await db`SELECT id FROM public.users WHERE auth_user_id = ${legacyUsers.A}`;
  const [b] = await db`SELECT id FROM public.users WHERE auth_user_id = ${legacyUsers.B}`;
  assert.ok(a?.id && b?.id, 'Auth signup trigger must provision public.users rows.');
  const internalA = a.id;
  const internalB = b.id;

  // Legacy domain rows across two goals, inserted as the database owner the
  // same way the pre-0007 application would have left them.
  const [goal1] = await db`
    INSERT INTO public.goals (owner_id, title, outcome)
    VALUES (${internalA}, 'Legacy Goal One', 'backfill fixture')
    RETURNING id
  `;
  const [goal2] = await db`
    INSERT INTO public.goals (owner_id, title, outcome)
    VALUES (${internalB}, 'Legacy Goal Two', 'backfill fixture')
    RETURNING id
  `;
  const [product1] = await db`
    INSERT INTO public.products (goal_id, name, category, route)
    VALUES (${goal1.id}, 'Legacy Product One', 'Fixture', '/legacy-one')
    RETURNING id
  `;
  const [product2] = await db`
    INSERT INTO public.products (goal_id, name, category, route)
    VALUES (${goal2.id}, 'Legacy Product Two', 'Fixture', '/legacy-two')
    RETURNING id
  `;
  await db`
    INSERT INTO public.work_items (goal_id, product_id, type, assigned_to, title, detail)
    VALUES (${goal1.id}, ${product1.id}, 'build', 'operator_a', 'legacy work item', 'fixture')
  `;
  await db`
    INSERT INTO public.handoffs (goal_id, product_id, from_role, to_role, title, summary, asks)
    VALUES (${goal1.id}, ${product1.id}, 'operator_a', 'operator_b', 'legacy handoff', 'fixture', 'fixture')
  `;
  await db`
    INSERT INTO public.decisions (goal_id, product_id, title, context, decision, owner_id)
    VALUES (${goal1.id}, ${product1.id}, 'legacy decision', 'fixture', 'approved', ${internalA})
  `;
  // Evidence with explicit recorded_at values so the hash chain is fully
  // deterministic and re-computable after the 0007 backfill.
  const [evidence1] = await db`
    INSERT INTO public.evidence (product_id, kind, reference, note, recorded_by, recorded_at)
    VALUES (${product1.id}, 'source_commit', 'legacy-ref-1', 'fixture evidence 1', 'operator_a',
            '2026-01-15T10:00:00Z'::timestamptz)
    RETURNING id
  `;
  const [evidence2] = await db`
    INSERT INTO public.evidence (product_id, kind, reference, note, recorded_by, recorded_at)
    VALUES (${product1.id}, 'design_history', 'legacy-ref-2', 'fixture evidence 2', 'operator_a',
            '2026-01-15T10:05:00Z'::timestamptz)
    RETURNING id
  `;
  const [evidence3] = await db`
    INSERT INTO public.evidence (product_id, kind, reference, note, recorded_by, recorded_at)
    VALUES (${product2.id}, 'asset_licence', 'legacy-ref-3', 'fixture evidence 3', 'operator_b',
            '2026-01-16T12:00:00Z'::timestamptz)
    RETURNING id
  `;

  console.log('Seeded synthetic pre-0007 fixtures (2 goals, 2 products, 3 work artifacts, 3 evidence rows)');
  return { internalA, internalB, goal1: goal1.id, goal2: goal2.id, product1: product1.id, product2: product2.id };
}

/**
 * Asserts the CURRENT documented behavior of the 0007 backfill against the
 * synthetic fixtures above. These assertions pin existing migration semantics;
 * they do not decide whether that semantics is the intended product behavior
 * (see the handoff: the single shared "Luma Foundry" workspace is a
 * data-sharing decision that still needs product sign-off).
 */
async function verifyWorkspaceBackfill({ goal1, goal2, product1, product2 }) {
  const workspaces = await db`
    SELECT id, name FROM public.workspaces ORDER BY created_at, id
  `;
  const defaultWs = workspaces.find((ws) => ws.name === 'Luma Foundry');
  const personalWorkspaces = workspaces.filter((ws) => ws.name !== 'Luma Foundry');
  assert.ok(defaultWs, '0007 must create the shared default workspace when legacy goals exist');
  assert.equal(personalWorkspaces.length, 1, 'only user D should receive a personal workspace');
  assert.match(personalWorkspaces[0].name, /^Dara Owner's workspace$/);

  const roster = (
    await db`
      SELECT u.name, m.role
        FROM public.workspace_members AS m
        JOIN public.users AS u ON u.id = m.user_id
       WHERE m.workspace_id = ${defaultWs.id}
       ORDER BY u.name
    `
  ).map((row) => ({ name: row.name, role: row.role }));
  assert.deepEqual(roster, [
    { name: 'Ada Owner', role: 'owner' },
    { name: 'Ben Operator', role: 'member' },
    { name: 'Cara Operator', role: 'member' },
  ]);
  const dInDefault = await db`
    SELECT 1 FROM public.workspace_members
     WHERE workspace_id = ${defaultWs.id}
       AND user_id = (SELECT id FROM public.users WHERE auth_user_id = ${legacyUsers.D})
  `;
  assert.equal(dInDefault.length, 0, 'user D must not be placed in the shared workspace');
  console.log('PASS 0007 backfill roster: goal owners and operators join "Luma Foundry" (global owner -> owner, operators -> member); unplaced users get a personal workspace');

  // Every pre-0007 row (and only those) lands in the shared workspace.
  for (const id of [goal1, goal2]) {
    const rows = await db`SELECT workspace_id FROM public.goals WHERE id = ${id}`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].workspace_id, defaultWs.id, 'goals row must be backfilled to the default workspace');
  }
  for (const id of [product1, product2]) {
    const rows = await db`SELECT workspace_id FROM public.products WHERE id = ${id}`;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].workspace_id, defaultWs.id, 'products row must be backfilled to the default workspace');
  }
  const childPlacement = await db`
    SELECT
      (SELECT count(*) FROM public.work_items WHERE workspace_id = ${defaultWs.id}) AS work_items,
      (SELECT count(*) FROM public.handoffs   WHERE workspace_id = ${defaultWs.id}) AS handoffs,
      (SELECT count(*) FROM public.decisions  WHERE workspace_id = ${defaultWs.id}) AS decisions,
      (SELECT count(*) FROM public.evidence   WHERE workspace_id = ${defaultWs.id}) AS evidence
  `;
  assert.equal(Number(childPlacement[0].work_items), 1);
  assert.equal(Number(childPlacement[0].handoffs), 1);
  assert.equal(Number(childPlacement[0].decisions), 1);
  assert.equal(Number(childPlacement[0].evidence), 3);
  console.log('PASS all pre-0007 goals and their children (products, work_items, handoffs, decisions, evidence) are backfilled into the shared workspace');

  // The migration's own invariants, re-asserted from the outside.
  const ownerlessWorkspaces = await db`
    SELECT count(*) AS n FROM public.workspaces AS w
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members AS m
        WHERE m.workspace_id = w.id AND m.role = 'owner'
     )
  `;
  assert.equal(Number(ownerlessWorkspaces[0].n), 0);
  const membershiplessUsers = await db`
    SELECT count(*) AS n FROM public.users AS u
     WHERE NOT EXISTS (
       SELECT 1 FROM public.workspace_members AS m WHERE m.user_id = u.id
     )
  `;
  assert.equal(Number(membershiplessUsers[0].n), 0);
  console.log('PASS every workspace has at least one owner and every user belongs to at least one workspace after backfill');
}

/**
 * The hash payload deliberately excludes workspace_id, and 0007 disables the
 * user triggers only for the one-column backfill, so pre-existing chains must
 * still verify. Recompute every row hash and the prev_hash linkage from stored
 * values, then prove the append-only guard is active again.
 */
async function verifyEvidenceChainIntegrity() {
  const hashChecks = await db`
    SELECT (encode(
              extensions.digest(
                coalesce(e.prev_hash, '') || '|' ||
                e.product_id::text || '|' ||
                e.kind::text || '|' ||
                e.reference || '|' ||
                e.note || '|' ||
                e.recorded_by::text || '|' ||
                e.recorded_at::text,
                'sha256'),
              'hex') = e.row_hash) AS hash_ok
      FROM public.evidence AS e
  `;
  assert.ok(hashChecks.length >= 3, 'expected the seeded legacy evidence rows to be present');
  assert.ok(hashChecks.every((row) => row.hash_ok), 'every evidence row_hash must recompute exactly after the workspace_id backfill');

  const linkageViolations = await db`
    SELECT count(*) AS n FROM (
      SELECT e.prev_hash,
             lag(e.row_hash) OVER (PARTITION BY e.product_id ORDER BY e.recorded_at, e.id) AS expected_prev
        FROM public.evidence AS e
    ) AS links
     WHERE coalesce(links.prev_hash, '') IS DISTINCT FROM coalesce(links.expected_prev, '')
  `;
  assert.equal(Number(linkageViolations[0].n), 0, 'prev_hash linkage must be intact after the backfill');
  console.log('PASS evidence hash chain still verifies row-by-row after the workspace_id backfill (hash payload excludes workspace_id)');

  const [anyEvidence] = await db`SELECT id, product_id FROM public.evidence LIMIT 1`;
  await expectSqlFailure(
    'evidence remains append-only after 0007 (admin UPDATE)',
    () => asDatabaseOwner((tx) => tx`UPDATE public.evidence SET note = 'tampered' WHERE id = ${anyEvidence.id}`),
    ['23001'],
  );
  await expectSqlFailure(
    'evidence remains append-only after 0007 (admin DELETE)',
    () => asDatabaseOwner((tx) => tx`DELETE FROM public.evidence WHERE id = ${anyEvidence.id}`),
    ['23001'],
  );
}

/**
 * Seeds post-0007 signups through the replacement handle_new_user() trigger.
 */
async function seedSignupUsers() {
  const names = { E: 'Eve Operator', F: 'Frank Member', G: 'Grace Stranger' };
  for (const [key, authUserId] of Object.entries(signupUsers)) {
    await db`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES (${authUserId}, ${`signup-${key.toLowerCase()}@example.invalid`},
              ${db.json({ name: names[key] })})
    `;
  }
  const rows = await db`
    SELECT u.auth_user_id, u.id, u.role, u.name, m.workspace_id AS personal_ws, m.role AS ws_role,
           w.name AS workspace_name
      FROM public.users AS u
      JOIN public.workspace_members AS m ON m.user_id = u.id
      JOIN public.workspaces AS w ON w.id = m.workspace_id
     WHERE u.auth_user_id = ANY(${db.array(Object.values(signupUsers))}::uuid[])
  `;
  assert.equal(rows.length, Object.keys(signupUsers).length, 'each new signup must own exactly one personal workspace');
  for (const row of rows) {
    assert.equal(row.role, 'pending', `signup ${row.name} must get the global role 'pending'`);
    assert.equal(row.ws_role, 'owner', `signup ${row.name} must own their personal workspace`);
    assert.equal(row.workspace_name, `${row.name}'s workspace`, 'personal workspace must be named after the user');
  }
  const byKey = Object.fromEntries(
    Object.entries(signupUsers).map(([key, authUserId]) => [
      key,
      rows.find((row) => row.auth_user_id === authUserId),
    ]),
  );
  console.log('PASS post-0007 signups get global role "pending" plus a personal workspace they own (handle_new_user v2)');
  return byKey;
}

/**
 * Structural security assertions: role hardening, RLS coverage, exact policy
 * inventory, least-privilege grants, helper-function privileges, enum shapes.
 */
async function runStructuralSecurityAssertions() {
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
        'workspaces', 'workspace_members',
      ])}::text[])
  `;
  assert.equal(tableState.length, 9);
  for (const table of tableState) {
    assert.equal(table.relrowsecurity, true, `${table.relname} must have RLS enabled`);
    assert.notEqual(table.owner, 'app_user', `${table.relname} must not be owned by app_user`);
  }
  console.log('PASS all nine workspace tables (7 core + workspaces + workspace_members) have RLS; app_user is not an owner or RLS bypass role');

  const policyInventory = (
    await db`
      SELECT tablename, policyname, cmd
        FROM pg_catalog.pg_policies
       WHERE schemaname = 'public'
       ORDER BY tablename, policyname
    `
  ).map((row) => ({ tablename: row.tablename, policyname: row.policyname, cmd: row.cmd }));
  assert.deepEqual(policyInventory, [
    { tablename: 'decisions', policyname: 'decisions_workspace_members', cmd: 'ALL' },
    { tablename: 'evidence', policyname: 'evidence_workspace_members', cmd: 'ALL' },
    { tablename: 'goals', policyname: 'goals_workspace_members', cmd: 'ALL' },
    { tablename: 'handoffs', policyname: 'handoffs_workspace_members', cmd: 'ALL' },
    { tablename: 'products', policyname: 'products_workspace_members', cmd: 'ALL' },
    { tablename: 'users', policyname: 'users_own_rows', cmd: 'SELECT' },
    { tablename: 'users', policyname: 'users_workspace_peers', cmd: 'SELECT' },
    { tablename: 'work_items', policyname: 'work_items_workspace_members', cmd: 'ALL' },
    { tablename: 'workspace_members', policyname: 'workspace_members_delete_owner_or_self', cmd: 'DELETE' },
    { tablename: 'workspace_members', policyname: 'workspace_members_insert_owners', cmd: 'INSERT' },
    { tablename: 'workspace_members', policyname: 'workspace_members_select', cmd: 'SELECT' },
    { tablename: 'workspace_members', policyname: 'workspace_members_update_owners', cmd: 'UPDATE' },
    { tablename: 'workspaces', policyname: 'workspaces_delete_owners', cmd: 'DELETE' },
    { tablename: 'workspaces', policyname: 'workspaces_select_members', cmd: 'SELECT' },
    { tablename: 'workspaces', policyname: 'workspaces_update_owners', cmd: 'UPDATE' },
  ]);
  const policyRoles = await db`
    SELECT DISTINCT roles FROM pg_catalog.pg_policies WHERE schemaname = 'public'
  `;
  assert.equal(policyRoles.length, 1, 'every policy must target the same role set');
  assert.deepEqual(policyRoles[0].roles, ['public'], 'every policy must apply TO PUBLIC so the non-member app_user role is covered');
  console.log('PASS exact workspace-scoped policy inventory (15 policies, all TO PUBLIC): member CRUD on core tables, owner-gated workspace/member administration, users_own_rows + workspace peers');

  const clientGrants = await db`
    SELECT
      pg_catalog.has_table_privilege('anon', 'public.goals', 'SELECT') AS anon_can_read,
      pg_catalog.has_table_privilege('authenticated', 'public.goals', 'SELECT') AS authenticated_can_read,
      pg_catalog.has_table_privilege('app_user', 'public.goals', 'SELECT') AS app_can_read,
      pg_catalog.has_table_privilege('app_user', 'public.goals', 'INSERT') AS app_can_insert,
      pg_catalog.has_table_privilege('app_user', 'public.users', 'UPDATE') AS app_can_update_user,
      pg_catalog.has_table_privilege('app_user', 'public.workspaces', 'INSERT') AS app_can_insert_workspace,
      pg_catalog.has_table_privilege('app_user', 'public.workspaces', 'SELECT') AS app_can_read_workspace,
      pg_catalog.has_table_privilege('app_user', 'public.workspace_members', 'INSERT') AS app_can_insert_member,
      pg_catalog.has_table_privilege('service_role', 'public.workspaces', 'INSERT') AS service_can_insert_workspace
  `;
  assert.equal(clientGrants[0].anon_can_read, false);
  assert.equal(clientGrants[0].authenticated_can_read, false);
  assert.equal(clientGrants[0].app_can_read, true);
  assert.equal(clientGrants[0].app_can_insert, true);
  assert.equal(clientGrants[0].app_can_update_user, false);
  assert.equal(clientGrants[0].app_can_insert_workspace, false, 'workspace creation must go through create_workspace(), not table INSERT');
  assert.equal(clientGrants[0].app_can_read_workspace, true);
  assert.equal(clientGrants[0].app_can_insert_member, true);
  assert.equal(clientGrants[0].service_can_insert_workspace, true);
  console.log('PASS explicit least-privilege grants incl. 0007 tables (no direct workspace INSERT for app_user; user role metadata not writable)');

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

  for (const [label, role, signature, expected] of [
    ['app_user can execute RLS helper functions', 'app_user', 'public.is_workspace_member(uuid)', true],
    ['app_user can execute create_workspace()', 'app_user', 'public.create_workspace(text)', true],
    ['anon cannot execute RLS helper functions', 'anon', 'public.is_workspace_member(uuid)', false],
    ['authenticated cannot execute create_workspace()', 'authenticated', 'public.create_workspace(text)', false],
  ]) {
    const granted = await db`
      SELECT pg_catalog.has_function_privilege(${role}, ${signature}, 'EXECUTE') AS can_execute
    `;
    assert.equal(granted[0].can_execute, expected, label);
  }
  console.log('PASS 0007 helper functions are executable by app_user/service_role only (revoked from PUBLIC, anon, authenticated)');

  const enumValues = await db`
    SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
      FROM pg_type AS t
      JOIN pg_enum AS e ON e.enumtypid = t.oid
     WHERE t.typname IN ('role', 'workspace_role')
     GROUP BY t.typname
  `;
  const roleEnum = enumValues.find((row) => row.typname === 'role');
  const workspaceRoleEnum = enumValues.find((row) => row.typname === 'workspace_role');
  assert.deepEqual(roleEnum.labels, ['owner', 'operator_a', 'operator_b', 'pending']);
  assert.deepEqual(workspaceRoleEnum.labels, ['owner', 'member']);
  console.log('PASS enum shapes: users.role gains "pending"; workspace_role is owner|member only');
}

/**
 * Behavioral RLS suite for the post-0007 world: real workspaces, real members,
 * real denials. Every assertion documents actual policy behavior; none of them
 * relaxes it.
 */
async function runWorkspaceBehaviorSuite(signups, legacy) {
  const E = signups.E;
  const F = signups.F;
  const G = signups.G;
  const internalA = legacy.internalA;

  // Workspace creation is function-only (no INSERT grant on workspaces).
  const [created] = await asRole(E.auth_user_id, (tx) => tx`SELECT public.create_workspace('Widget Lab') AS ws_id`);
  const wsWidget = created.ws_id;
  const creatorRoster = await db`
    SELECT u.auth_user_id, m.role
      FROM public.workspace_members AS m
      JOIN public.users AS u ON u.id = m.user_id
     WHERE m.workspace_id = ${wsWidget}
  `;
  assert.equal(creatorRoster.length, 1);
  assert.equal(creatorRoster[0].auth_user_id, E.auth_user_id);
  assert.equal(creatorRoster[0].role, 'owner');
  console.log('PASS create_workspace() creates the workspace and makes the caller its owner');

  await expectSqlFailure(
    'create_workspace rejects blank names',
    () => asRole(E.auth_user_id, (tx) => tx`SELECT public.create_workspace('   ')`),
    ['22023'],
  );
  await expectSqlFailure(
    'create_workspace rejects unauthenticated calls (no jwt subject)',
    () => asRole(null, (tx) => tx`SELECT public.create_workspace('Nope')`),
    ['28000'],
  );
  await expectSqlFailure(
    'anon cannot execute create_workspace()',
    () => asRole(null, (tx) => tx`SELECT public.create_workspace('Nope')`, 'anon'),
  );
  await expectSqlFailure(
    'authenticated Data API role cannot execute create_workspace()',
    () => asRole(E.auth_user_id, (tx) => tx`SELECT public.create_workspace('Nope')`, 'authenticated'),
  );
  await expectSqlFailure(
    'app_user cannot INSERT into workspaces directly',
    () => asRole(E.auth_user_id, (tx) => tx`INSERT INTO public.workspaces (name) VALUES ('Direct')`),
  );

  // Owner CRUD inside a workspace they own.
  const { goalE1, productE1, goalE2, productE2 } = await asRole(E.auth_user_id, async (tx) => {
    const [goal1] = await tx`
      INSERT INTO public.goals (owner_id, workspace_id, title, outcome)
      VALUES (${E.id}, ${wsWidget}, 'Widget Goal One', 'behavior suite')
      RETURNING id
    `;
    const [product1] = await tx`
      INSERT INTO public.products (goal_id, workspace_id, name, category, route)
      VALUES (${goal1.id}, ${wsWidget}, 'Widget Product One', 'Test', '/widget-one')
      RETURNING id
    `;
    const [goal2] = await tx`
      INSERT INTO public.goals (owner_id, workspace_id, title, outcome)
      VALUES (${E.id}, ${wsWidget}, 'Widget Goal Two', 'behavior suite')
      RETURNING id
    `;
    const [product2] = await tx`
      INSERT INTO public.products (goal_id, workspace_id, name, category, route)
      VALUES (${goal2.id}, ${wsWidget}, 'Widget Product Two', 'Test', '/widget-two')
      RETURNING id
    `;
    return { goalE1: goal1.id, productE1: product1.id, goalE2: goal2.id, productE2: product2.id };
  });
  console.log('PASS workspace owner can create goals and products inside their own workspace');

  await expectSqlFailure(
    'WITH CHECK blocks creating rows in a workspace the user does not belong to',
    () => asRole(E.auth_user_id, (tx) => tx`
      INSERT INTO public.goals (owner_id, workspace_id, title, outcome)
      VALUES (${E.id}, ${F.personal_ws}, 'infiltration', 'must fail')
    `),
  );

  // Cross-workspace denial: F and G see nothing of E's rows.
  const fSeesNothing = await asRole(F.auth_user_id, async (tx) => ({
    goals: await tx`SELECT id FROM public.goals WHERE id = ${goalE1}`,
    updates: await tx`UPDATE public.goals SET title = 'hijacked' WHERE id = ${goalE1} RETURNING id`,
    deletes: await tx`DELETE FROM public.goals WHERE id = ${goalE1} RETURNING id`,
  }));
  assert.equal(fSeesNothing.goals.length, 0);
  assert.equal(fSeesNothing.updates.length, 0);
  assert.equal(fSeesNothing.deletes.length, 0);
  const gSeesNothing = await asRole(G.auth_user_id, (tx) => tx`SELECT id FROM public.goals WHERE id = ${goalE1}`);
  assert.equal(gSeesNothing.length, 0);
  console.log('PASS non-members cannot read, update, or delete another workspace\'s rows');

  // Membership flow: only owners add members; members gain full CRUD in that
  // workspace (current documented policy behavior).
  await expectSqlFailure(
    'a non-member cannot add themselves to a workspace',
    () => asRole(F.auth_user_id, (tx) => tx`
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (${wsWidget}, ${F.id}, 'member')
    `),
  );
  await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (${wsWidget}, ${F.id}, 'member')
  `);
  const fReads = await asRole(F.auth_user_id, (tx) => tx`SELECT id FROM public.goals WHERE id = ${goalE1}`);
  assert.equal(fReads.length, 1);
  const fWrites = await asRole(F.auth_user_id, async (tx) => {
    const [renamed] = await tx`UPDATE public.goals SET title = 'Widget Goal One (member edit)' WHERE id = ${goalE1} RETURNING title`;
    const [product] = await tx`
      INSERT INTO public.products (goal_id, workspace_id, name, category, route)
      VALUES (${goalE1}, ${wsWidget}, 'Widget Product (by member)', 'Test', '/widget-member')
      RETURNING id
    `;
    return { renamed, product };
  });
  assert.equal(fWrites.renamed.title, 'Widget Goal One (member edit)');
  assert.ok(fWrites.product.id);
  console.log('PASS owner-added members gain full read/write access inside that workspace (current member semantics)');

  // Roster visibility.
  const roster = await asRole(E.auth_user_id, (tx) => tx`
    SELECT u.auth_user_id, m.role
      FROM public.workspace_members AS m
      JOIN public.users AS u ON u.id = m.user_id
     WHERE m.workspace_id = ${wsWidget}
     ORDER BY u.name
  `);
  assert.deepEqual(roster.map((row) => [row.auth_user_id, row.role]), [
    [E.auth_user_id, 'owner'],
    [F.auth_user_id, 'member'],
  ]);
  const gRoster = await asRole(G.auth_user_id, (tx) => tx`SELECT user_id FROM public.workspace_members WHERE workspace_id = ${wsWidget}`);
  assert.equal(gRoster.length, 0);
  console.log('PASS members see their workspace roster; strangers see nothing');

  // Only owners administer membership.
  await expectSqlFailure(
    'a member cannot add other members',
    () => asRole(F.auth_user_id, (tx) => tx`
      INSERT INTO public.workspace_members (workspace_id, user_id, role)
      VALUES (${wsWidget}, ${G.id}, 'member')
    `),
  );
  const fSelfPromotion = await asRole(F.auth_user_id, (tx) =>
    tx`UPDATE public.workspace_members SET role = 'owner' WHERE workspace_id = ${wsWidget} AND user_id = ${F.id} RETURNING user_id`,
  );
  assert.equal(fSelfPromotion.length, 0, 'member must not be able to promote themselves');
  const fRemovesOwner = await asRole(F.auth_user_id, (tx) =>
    tx`DELETE FROM public.workspace_members WHERE workspace_id = ${wsWidget} AND user_id = ${E.id} RETURNING user_id`,
  );
  assert.equal(fRemovesOwner.length, 0, 'member must not be able to remove the owner');
  const ownerRemovesMember = await asRole(E.auth_user_id, (tx) =>
    tx`DELETE FROM public.workspace_members WHERE workspace_id = ${wsWidget} AND user_id = ${F.id} RETURNING user_id`,
  );
  assert.equal(ownerRemovesMember.length, 1);
  await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (${wsWidget}, ${F.id}, 'member')
  `);
  console.log('PASS membership administration is owner-only: members cannot add, promote, or remove; owners manage the roster');

  // Self-leave is the one deletion a non-owner may perform (documented policy).
  const selfLeave = await asRole(F.auth_user_id, (tx) =>
    tx`DELETE FROM public.workspace_members WHERE workspace_id = ${wsWidget} AND user_id = ${F.id} RETURNING user_id`,
  );
  assert.equal(selfLeave.length, 1);
  await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (${wsWidget}, ${F.id}, 'member')
  `);
  console.log('PASS any member may remove themselves from a workspace (self-leave)');

  // users visibility: own row + workspace peers only; role metadata stays read-only.
  const peerVisibility = await asRole(F.auth_user_id, (tx) =>
    tx`SELECT id FROM public.users WHERE id = ${E.id}`,
  );
  assert.equal(peerVisibility.length, 1);
  const strangerVisibility = await asRole(G.auth_user_id, (tx) =>
    tx`SELECT id FROM public.users WHERE id = ${E.id}`,
  );
  assert.equal(strangerVisibility.length, 0);
  console.log('PASS users rows are visible to self and workspace peers only (users_own_rows + users_workspace_peers)');

  // workspaces: members read; owners rename/delete.
  const memberRename = await asRole(F.auth_user_id, (tx) =>
    tx`UPDATE public.workspaces SET name = 'Hijacked Lab' WHERE id = ${wsWidget} RETURNING id`,
  );
  assert.equal(memberRename.length, 0);
  const memberDelete = await asRole(F.auth_user_id, (tx) =>
    tx`DELETE FROM public.workspaces WHERE id = ${wsWidget} RETURNING id`,
  );
  assert.equal(memberDelete.length, 0);
  const [ownerRename] = await asRole(E.auth_user_id, (tx) =>
    tx`UPDATE public.workspaces SET name = 'Widget Lab' WHERE id = ${wsWidget} RETURNING name`,
  );
  assert.equal(ownerRename.name, 'Widget Lab');
  console.log('PASS workspace rename/delete is owner-only; members can only read');

  await expectSqlFailure(
    'workspace holding goals cannot be deleted (ON DELETE RESTRICT)',
    () => asRole(E.auth_user_id, (tx) => tx`DELETE FROM public.workspaces WHERE id = ${wsWidget} RETURNING id`),
    ['23503'],
  );
  const [scratch] = await asRole(E.auth_user_id, (tx) => tx`SELECT public.create_workspace('Scratch Space') AS ws_id`);
  const scratchDelete = await asRole(E.auth_user_id, (tx) =>
    tx`DELETE FROM public.workspaces WHERE id = ${scratch.ws_id} RETURNING id`,
  );
  assert.equal(scratchDelete.length, 1);
  console.log('PASS an empty workspace can be deleted by its owner');

  // Legacy users: the shared "Luma Foundry" workspace makes pre-existing rows
  // mutually visible (current backfill semantics; the data-sharing decision is
  // flagged for product review in the handoff — no semantics changed here).
  const bReadsGoal = await asRole(legacyUsers.B, (tx) =>
    tx`SELECT id FROM public.goals WHERE id = ${legacy.goal1}`,
  );
  assert.equal(bReadsGoal.length, 1, 'legacy users share one workspace, so formerly private rows are mutually visible');
  const bEditsGoal = await asRole(legacyUsers.B, (tx) =>
    tx`UPDATE public.goals SET title = 'Legacy Goal One (shared workspace)' WHERE id = ${legacy.goal1} RETURNING id`,
  );
  assert.equal(bEditsGoal.length, 1, "a default-workspace member can edit another legacy user's goal (current member semantics)");
  const bReadsEvidence = await asRole(legacyUsers.B, (tx) =>
    tx`SELECT id FROM public.evidence WHERE product_id = ${legacy.product1}`,
  );
  assert.equal(bReadsEvidence.length, 2);
  const bCannotSeeWidget = await asRole(legacyUsers.B, (tx) =>
    tx`SELECT id FROM public.goals WHERE id = ${goalE1}`,
  );
  assert.equal(bCannotSeeWidget.length, 0, 'shared-workspace membership does not leak into other workspaces');
  const dSeesNothing = await asRole(legacyUsers.D, async (tx) => ({
    goals: await tx`SELECT id FROM public.goals WHERE id = ${legacy.goal1}`,
    users: await tx`SELECT id FROM public.users WHERE id = ${internalA}`,
  }));
  assert.equal(dSeesNothing.goals.length, 0);
  assert.equal(dSeesNothing.users.length, 0);
  console.log('PASS legacy rows are mutually readable/editable inside "Luma Foundry" but invisible to users placed outside it (documented backfill semantics; data-sharing flagged for product review)');

  // Evidence + clearance inside a workspace (fail-closed trigger preserved).
  await asRole(E.auth_user_id, async (tx) => {
    for (const kind of evidenceKinds) {
      await tx`
        INSERT INTO public.evidence (product_id, workspace_id, kind, reference, note, recorded_by)
        VALUES (${productE1}, ${wsWidget}, ${kind}, 'test-reference', 'test evidence', 'operator_a')
      `;
    }
    await tx`UPDATE public.products SET status = 'cleared' WHERE id = ${productE1}`;
  });
  const cleared = await asRole(E.auth_user_id, (tx) =>
    tx`SELECT status FROM public.products WHERE id = ${productE1}`,
  );
  assert.equal(cleared[0]?.status, 'cleared');
  console.log("PASS clearance succeeds only after all eight required evidence kinds exist in the product's workspace");

  await expectSqlFailure(
    'direct clearance without evidence is rejected by the database trigger',
    () => asRole(E.auth_user_id, (tx) => tx`UPDATE public.products SET status = 'cleared' WHERE id = ${productE2}`),
    ['23514'],
  );

  const gEvidence = await asRole(G.auth_user_id, (tx) =>
    tx`SELECT id FROM public.evidence WHERE product_id = ${productE1}`,
  );
  assert.equal(gEvidence.length, 0);
  console.log('PASS strangers cannot read workspace evidence');

  // Same-goal composite FKs (drizzle 0001) still reject cross-goal references
  // inside one workspace, for both the database owner and the runtime role.
  await expectSqlFailure('composite work item foreign key rejects cross-goal references', () =>
    asDatabaseOwner((tx) => tx`
      INSERT INTO public.work_items (goal_id, product_id, workspace_id, type, assigned_to, title, detail)
      VALUES (${goalE1}, ${productE2}, ${wsWidget}, 'build', 'operator_a', 'bad link', 'must fail')
    `),
    ['23503'],
  );
  await expectSqlFailure('composite handoff foreign key rejects cross-goal references', () =>
    asDatabaseOwner((tx) => tx`
      INSERT INTO public.handoffs (goal_id, product_id, workspace_id, from_role, to_role, title, summary, asks)
      VALUES (${goalE1}, ${productE2}, ${wsWidget}, 'operator_a', 'operator_b', 'bad link', 'must fail', 'must fail')
    `),
    ['23503'],
  );
  await expectSqlFailure('composite decision foreign key rejects cross-goal references', () =>
    asDatabaseOwner((tx) => tx`
      INSERT INTO public.decisions (goal_id, product_id, workspace_id, title, context, decision, owner_id)
      VALUES (${goalE1}, ${productE2}, ${wsWidget}, 'bad link', 'must fail', 'must fail', ${E.id})
    `),
    ['23503'],
  );
  await expectSqlFailure('cross-goal work item reference is rejected for the runtime role', () =>
    asRole(E.auth_user_id, (tx) => tx`
      INSERT INTO public.work_items (goal_id, product_id, workspace_id, type, assigned_to, title, detail)
      VALUES (${goalE1}, ${productE2}, ${wsWidget}, 'build', 'operator_a', 'bad link', 'must fail')
    `),
    ['23503'],
  );
  await expectSqlFailure('cross-goal handoff reference is rejected for the runtime role', () =>
    asRole(E.auth_user_id, (tx) => tx`
      INSERT INTO public.handoffs (goal_id, product_id, workspace_id, from_role, to_role, title, summary, asks)
      VALUES (${goalE1}, ${productE2}, ${wsWidget}, 'operator_a', 'operator_b', 'bad link', 'must fail', 'must fail')
    `),
    ['23503'],
  );
  await expectSqlFailure('cross-goal decision reference is rejected for the runtime role', () =>
    asRole(E.auth_user_id, (tx) => tx`
      INSERT INTO public.decisions (goal_id, product_id, workspace_id, title, context, decision, owner_id)
      VALUES (${goalE1}, ${productE2}, ${wsWidget}, 'bad link', 'must fail', 'must fail', ${E.id})
    `),
    ['23503'],
  );
  await asRole(E.auth_user_id, async (tx) => {
    const [workItem] = await tx`
      INSERT INTO public.work_items (goal_id, product_id, workspace_id, type, assigned_to, title, detail)
      VALUES (${goalE1}, ${productE1}, ${wsWidget}, 'build', 'operator_a', 'valid work', 'valid')
      RETURNING id
    `;
    const [handoff] = await tx`
      INSERT INTO public.handoffs (goal_id, product_id, workspace_id, from_role, to_role, title, summary, asks)
      VALUES (${goalE1}, ${productE1}, ${wsWidget}, 'operator_a', 'operator_b', 'valid handoff', 'valid', 'review')
      RETURNING id
    `;
    const [decision] = await tx`
      INSERT INTO public.decisions (goal_id, product_id, workspace_id, title, context, decision, owner_id)
      VALUES (${goalE1}, ${productE1}, ${wsWidget}, 'valid decision', 'valid', 'approve', ${E.id})
      RETURNING id
    `;
    assert.ok(workItem?.id && handoff?.id && decision?.id);
  });
  console.log('PASS same-goal work item, handoff, and decision references are accepted inside one workspace');

  // The composite workspace FKs stop mixing rows across workspaces even for
  // the database owner (RLS WITH CHECK alone cannot do this for multi-workspace
  // users) — explicit 0007 design, tested as built.
  const [defaultWs] = await db`SELECT id FROM public.workspaces WHERE name = 'Luma Foundry'`;
  await expectSqlFailure(
    'composite workspace foreign key rejects a product pointing at a goal in another workspace',
    () => asDatabaseOwner((tx) => tx`
      INSERT INTO public.products (goal_id, workspace_id, name, category, route)
      VALUES (${goalE1}, ${defaultWs.id}, 'mixed workspace row', 'Test', '/mixed')
    `),
    ['23503'],
  );

  await expectSqlFailure(
    'anonymous Data API role has no direct workspace table grant',
    () => asRole(null, (tx) => tx`SELECT id FROM public.goals`, 'anon'),
  );
  await expectSqlFailure(
    'authenticated Data API role has no direct workspace table grant',
    () => asRole(E.auth_user_id, (tx) => tx`SELECT id FROM public.goals`, 'authenticated'),
  );
  await expectSqlFailure(
    'anonymous Data API role has no grant on the new workspace tables',
    () => asRole(null, (tx) => tx`SELECT id FROM public.workspaces`, 'anon'),
  );
  await expectSqlFailure(
    'authenticated Data API role has no grant on workspace_members',
    () => asRole(E.auth_user_id, (tx) => tx`SELECT user_id FROM public.workspace_members`, 'authenticated'),
  );
  await expectSqlFailure(
    'runtime app_user cannot mutate its users.role metadata',
    () => asRole(E.auth_user_id, (tx) => tx`UPDATE public.users SET role = 'operator_a' WHERE auth_user_id = ${E.auth_user_id}`),
  );
}

/**
 * UNRESOLVED GATE — last-owner protection.
 *
 * Migration 0007 enforces "every workspace must have at least one owner" only
 * while the migration runs ($verify$ block at the end of 0007). No runtime
 * guard exists in the policies or triggers, and no explicit product rule for
 * the last-owner case was found in the repository. These probes PIN the current
 * behavior so the suite documents reality; they do not endorse it and no
 * policy was altered. A design review decision is requested in the handoff.
 */
async function runLastOwnerGateProbes(signups) {
  const E = signups.E;

  // Probe 1: the sole owner leaves their own workspace.
  const [probe1] = await asRole(E.auth_user_id, (tx) =>
    tx`SELECT public.create_workspace('Gate Probe One') AS ws_id`,
  );
  const selfLeave = await asRole(E.auth_user_id, (tx) =>
    tx`DELETE FROM public.workspace_members WHERE workspace_id = ${probe1.ws_id} AND user_id = ${E.id} RETURNING user_id`,
  );
  assert.equal(selfLeave.length, 1, 'current behavior: a sole owner can self-leave (no runtime guard)');
  const probe1State = await db`
    SELECT count(*) AS members,
           count(*) FILTER (WHERE role = 'owner') AS owners
      FROM public.workspace_members
     WHERE workspace_id = ${probe1.ws_id}
  `;
  assert.equal(Number(probe1State[0].members), 0);
  assert.equal(Number(probe1State[0].owners), 0);
  await db`DELETE FROM public.workspaces WHERE id = ${probe1.ws_id}`;
  console.log('PASS current behavior (UNRESOLVED GATE): a sole owner can self-leave, leaving a workspace with no owner — flagged for design review, no policy change made');

  // Probe 2: the sole owner demotes themselves.
  const [probe2] = await asRole(E.auth_user_id, (tx) =>
    tx`SELECT public.create_workspace('Gate Probe Two') AS ws_id`,
  );
  const demotion = await asRole(E.auth_user_id, (tx) =>
    tx`UPDATE public.workspace_members SET role = 'member' WHERE workspace_id = ${probe2.ws_id} AND user_id = ${E.id} RETURNING role`,
  );
  assert.equal(demotion.length, 1, 'current behavior: a sole owner can demote themselves (no runtime guard)');
  assert.equal(demotion[0].role, 'member');
  const probe2State = await db`
    SELECT count(*) FILTER (WHERE role = 'owner') AS owners
      FROM public.workspace_members
     WHERE workspace_id = ${probe2.ws_id}
  `;
  assert.equal(Number(probe2State[0].owners), 0);
  await db`DELETE FROM public.workspaces WHERE id = ${probe2.ws_id}`;
  console.log('PASS current behavior (UNRESOLVED GATE): a sole owner can demote themselves, leaving a workspace with no owner — flagged for design review, no policy change made');
}

try {
  await bootstrap();
  const migration0007Path = await applyMigrationsThrough0006();
  const legacy = await seedLegacyFixtures();
  // 0007 runs its real backfill over the synthetic pre-0007 fixtures above.
  await applySqlFile(migration0007Path);
  await verifyWorkspaceBackfill(legacy);
  await verifyEvidenceChainIntegrity();
  await runStructuralSecurityAssertions();
  const signups = await seedSignupUsers();
  await runWorkspaceBehaviorSuite(signups, legacy);
  await runLastOwnerGateProbes(signups);
  console.log('\nRLS/database regression suite passed.');
} catch (error) {
  console.error('\nRLS/database regression suite failed:', error);
  process.exitCode = 1;
} finally {
  await db.end({ timeout: 5 });
}
