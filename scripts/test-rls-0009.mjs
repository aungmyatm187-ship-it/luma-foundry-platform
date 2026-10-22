import assert from 'node:assert/strict';
import postgres from 'postgres';

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function waitForLockWait(db, pid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rows = await db`
      SELECT wait_event_type
        FROM pg_catalog.pg_stat_activity
       WHERE pid = ${pid}
    `;
    if (rows.length === 0) return false;
    if (rows[0].wait_event_type === 'Lock') return true;
    await pause(20);
  }
  return false;
}

async function appTransaction(client, authUserId, callback) {
  return client.begin(async (tx) => {
    await tx.unsafe('SET LOCAL ROLE app_user');
    await tx`SELECT set_config(
      'request.jwt.claims',
      ${JSON.stringify({ sub: authUserId })},
      true
    )`;
    return callback(tx);
  });
}

async function seedArchivedWorkspaceInvitations({ db, asRole, legacyAuthUsers, signups, legacy }) {
  const [oldWorkspace] = await db`
    SELECT workspace_id
      FROM public.goals
     WHERE id = ${legacy.goal1}
  `;
  assert.ok(oldWorkspace?.workspace_id, 'the synthetic legacy goal must still be in its 0007 shared workspace');

  const users = await db`
    SELECT id, auth_user_id
      FROM public.users
     WHERE auth_user_id = ANY(${db.array([legacyAuthUsers.C, legacyAuthUsers.D, signups.G.auth_user_id])}::uuid[])
  `;
  const userByAuthId = Object.fromEntries(users.map((row) => [row.auth_user_id, row.id]));
  const internalC = userByAuthId[legacyAuthUsers.C];
  const internalD = userByAuthId[legacyAuthUsers.D];
  const internalG = userByAuthId[signups.G.auth_user_id];
  assert.ok(internalC && internalD && internalG, 'C, D, and G synthetic identities must be present');

  const [pending] = await asRole(legacyAuthUsers.A, (tx) => tx`
    SELECT public.create_invitation(${oldWorkspace.workspace_id}, ${internalG}::uuid) AS invitation_id
  `);
  const [accepted] = await asRole(legacyAuthUsers.A, (tx) => tx`
    SELECT public.create_invitation(${oldWorkspace.workspace_id}, ${internalD}::uuid) AS invitation_id
  `);
  await asRole(legacyAuthUsers.D, (tx) => tx`
    SELECT public.accept_invitation(${accepted.invitation_id}::uuid)
  `);

  const members = await db`
    SELECT user_id::text AS user_id
      FROM public.workspace_members
     WHERE workspace_id = ${oldWorkspace.workspace_id}
     ORDER BY user_id
  `;
  const evidenceBefore = await db`
    SELECT id::text AS id,
           row_hash,
           prev_hash,
           recorded_by::text AS recorded_by,
           recorded_by_user_id::text AS recorded_by_user_id,
           recorded_at::text AS recorded_at
      FROM public.evidence
     ORDER BY id
  `;

  return {
    workspaceId: oldWorkspace.workspace_id,
    pendingInvitationId: pending.invitation_id,
    acceptedInvitationId: accepted.invitation_id,
    oldMemberIds: members.map((row) => row.user_id),
    evidenceBefore,
    internalC,
    internalD,
  };
}

async function runMigrationPreflightProbes({
  db,
  migrationPath,
  ownerMap,
  apply0009WithOwnerMap,
  expectMigrationFailure,
}) {
  await db.unsafe('ALTER TABLE public.evidence DISABLE TRIGGER z90_evidence_hash_chain_trigger');
  try {
    await expectMigrationFailure(
      '0009 refuses a disabled 0008 evidence hash trigger',
      () => apply0009WithOwnerMap(migrationPath, ownerMap),
      '0009 requires the 0008 z90 evidence hash-chain trigger',
    );
  } finally {
    await db.unsafe('ALTER TABLE public.evidence ENABLE TRIGGER z90_evidence_hash_chain_trigger');
  }

  await expectMigrationFailure(
    '0009 refuses an incomplete owner map when goals exist',
    () => apply0009WithOwnerMap(migrationPath, []),
    'goal-owner map must contain exactly one row for every existing goal',
  );
  const archivedColumn = await db`
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'workspaces'
       AND column_name = 'archived_at'
  `;
  assert.equal(archivedColumn.length, 0, 'failed preflight transactions must leave the schema unchanged');
}

async function verify0009TriggerShapes(db) {
  const triggers = await db`
    SELECT c.relname AS table_name,
           t.tgname,
           t.tgtype,
           t.tgenabled,
           t.tgfoid = CASE t.tgname
             WHEN 'a10_goals_owner_attribution_trigger' THEN to_regprocedure('public.goals_owner_attribution()')
             WHEN 'a10_decisions_attribution_trigger' THEN to_regprocedure('public.decisions_attribution()')
             WHEN 'a10_evidence_attribution_trigger' THEN to_regprocedure('public.evidence_attribution()')
             WHEN 'z90_evidence_hash_chain_trigger' THEN to_regprocedure('public.evidence_hash_chain()')
           END AS function_binding_ok
      FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND t.tgname = ANY(${db.array([
         'a10_goals_owner_attribution_trigger',
         'a10_decisions_attribution_trigger',
         'a10_evidence_attribution_trigger',
         'z90_evidence_hash_chain_trigger',
       ])}::text[])
     ORDER BY t.tgname
  `;
  assert.deepEqual(
    triggers.map((row) => [row.table_name, row.tgname, Number(row.tgtype), row.tgenabled, row.function_binding_ok]),
    [
      ['decisions', 'a10_decisions_attribution_trigger', 23, 'O', true],
      ['evidence', 'a10_evidence_attribution_trigger', 7, 'O', true],
      ['goals', 'a10_goals_owner_attribution_trigger', 23, 'O', true],
      ['evidence', 'z90_evidence_hash_chain_trigger', 7, 'O', true],
    ],
    'attribution and evidence hash triggers must be enabled, correctly bound, and have the expected BEFORE row events',
  );
  console.log('PASS 0009 trigger shape: enabled BEFORE triggers are bound to the expected functions; evidence attribution precedes hash by name');
}

async function verify0009WorkspaceSplit({ db, asRole, legacyAuthUsers, signups, legacy, archiveFixtures, ownerMap }) {
  const goals = await db`
    SELECT id, owner_id, workspace_id
      FROM public.goals
     WHERE id = ANY(${db.array(ownerMap.map((entry) => entry.goal_id))}::uuid[])
  `;
  assert.equal(goals.length, ownerMap.length);
  const goalById = new Map(goals.map((row) => [row.id, row]));
  const goalA = goalById.get(legacy.goal1);
  const goalB = goalById.get(legacy.goal2);
  assert.equal(goalA.owner_id, legacy.internalA);
  assert.equal(goalB.owner_id, legacy.internalB);
  assert.notEqual(goalA.workspace_id, archiveFixtures.workspaceId);
  assert.notEqual(goalB.workspace_id, archiveFixtures.workspaceId);
  assert.notEqual(goalA.workspace_id, goalB.workspace_id, 'distinct mapped owners must receive distinct workspaces');

  const [oldWorkspace] = await db`
    SELECT archived_at
      FROM public.workspaces
     WHERE id = ${archiveFixtures.workspaceId}
  `;
  assert.ok(oldWorkspace?.archived_at, 'the prior shared goal workspace must be archived, not deleted');

  for (const goalId of [legacy.goal1, legacy.goal2]) {
    const [mismatch] = await db`
      SELECT
        (SELECT count(*) FROM public.products p WHERE p.goal_id = ${goalId} AND p.workspace_id <> g.workspace_id) AS products,
        (SELECT count(*) FROM public.work_items wi WHERE wi.goal_id = ${goalId} AND wi.workspace_id <> g.workspace_id) AS work_items,
        (SELECT count(*) FROM public.handoffs h WHERE h.goal_id = ${goalId} AND h.workspace_id <> g.workspace_id) AS handoffs,
        (SELECT count(*) FROM public.decisions d WHERE d.goal_id = ${goalId} AND d.workspace_id <> g.workspace_id) AS decisions,
        (SELECT count(*) FROM public.evidence e JOIN public.products p ON p.id = e.product_id WHERE p.goal_id = ${goalId} AND e.workspace_id <> g.workspace_id) AS evidence
        FROM public.goals g
       WHERE g.id = ${goalId}
    `;
    for (const [key, value] of Object.entries(mismatch)) {
      if (key !== 'g') assert.equal(Number(value), 0, `${key} children must follow the mapped goal workspace`);
    }
  }

  const archivedMembers = await db`
    SELECT user_id::text AS user_id
      FROM public.workspace_members
     WHERE workspace_id = ${archiveFixtures.workspaceId}
     ORDER BY user_id
  `;
  assert.deepEqual(
    archivedMembers.map((row) => row.user_id),
    archiveFixtures.oldMemberIds,
    'archiving must retain every existing workspace-membership row',
  );
  const [acceptedInvitation] = await db`
    SELECT accepted_at, accepted_by
      FROM public.workspace_invitations
     WHERE id = ${archiveFixtures.acceptedInvitationId}
  `;
  assert.ok(acceptedInvitation?.accepted_at, 'accepted invitation history must remain intact');
  assert.equal(acceptedInvitation.accepted_by, archiveFixtures.internalD);
  const [pendingInvitation] = await db`
    SELECT accepted_at, revoked_at
      FROM public.workspace_invitations
     WHERE id = ${archiveFixtures.pendingInvitationId}
  `;
  assert.equal(pendingInvitation.accepted_at, null);
  assert.ok(pendingInvitation.revoked_at, 'unaccepted invitations on archived workspaces must be revoked');

  const [cActiveWorkspace] = await db`
    SELECT w.id, m.role
      FROM public.workspace_members m
      JOIN public.workspaces w ON w.id = m.workspace_id
     WHERE m.user_id = ${archiveFixtures.internalC}
       AND w.archived_at IS NULL
  `;
  assert.ok(cActiveWorkspace?.id, 'a former shared-workspace member with no active workspace must receive a personal one');
  assert.equal(cActiveWorkspace.role, 'owner');

  const [archivedMembershipCheck] = await asRole(legacyAuthUsers.D, (tx) => tx`
    SELECT public.is_workspace_member(${archiveFixtures.workspaceId}) AS is_member
  `);
  assert.equal(archivedMembershipCheck.is_member, false, 'retained membership history must not grant active access to an archived workspace');
  const archivedGoalRead = await asRole(legacyAuthUsers.D, (tx) => tx`
    SELECT id FROM public.goals WHERE id = ${legacy.goal1}
  `);
  assert.equal(archivedGoalRead.length, 0, 'a former collaborator must not read the relocated goal through the archived workspace');
  await expectSqlFailure(
    'a revoked invitation on an archived workspace cannot be replayed',
    () => asRole(signups.G.auth_user_id, (tx) => tx`SELECT public.accept_invitation(${archiveFixtures.pendingInvitationId}::uuid)`),
    ['P0001'],
  );
  console.log('PASS 0009 split: explicit owners receive separate workspaces; children move; old memberships and accepted invite history remain archived; pending invites are revoked');
}

async function verify0009AttributionAndHash({ db, asRole, expectSqlFailure, legacy, signups }) {
  const E = signups.E;
  const [goal] = await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.goals (owner_id, workspace_id, title, outcome)
    VALUES (${legacy.internalA}, ${E.personal_ws}, '0009 actor-owned goal', 'attribution regression')
    RETURNING id, owner_id, workspace_id
  `);
  assert.equal(goal.owner_id, E.id, 'goal owner must be derived from auth.uid(), not forged input');
  assert.equal(goal.workspace_id, E.personal_ws);
  await expectSqlFailure(
    'ordinary UPDATE cannot rewrite goal ownership',
    () => asRole(E.auth_user_id, (tx) => tx`UPDATE public.goals SET owner_id = ${legacy.internalB} WHERE id = ${goal.id}`),
    ['42501'],
  );
  const [otherWorkspace] = await db`SELECT workspace_id FROM public.goals WHERE id = ${legacy.goal1}`;
  await expectSqlFailure(
    'ordinary UPDATE cannot move a goal to another workspace',
    () => asRole(E.auth_user_id, (tx) => tx`UPDATE public.goals SET workspace_id = ${otherWorkspace.workspace_id} WHERE id = ${goal.id}`),
    ['42501'],
  );

  const [product] = await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.products (goal_id, workspace_id, name, category, route)
    VALUES (${goal.id}, ${E.personal_ws}, '0009 attribution product', 'Test', '/0009-attribution')
    RETURNING id
  `);
  const [decision] = await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.decisions
      (goal_id, workspace_id, title, context, decision, owner_id, decided_by, decided_by_user_id)
    VALUES
      (${goal.id}, ${E.personal_ws}, '0009 forged decision actor', 'fixture', 'open', ${E.id}, 'owner', ${legacy.internalA})
    RETURNING id, decided_by, decided_by_user_id
  `);
  assert.equal(decision.decided_by, 'pending', 'pending global role must not be upgraded through a forged label');
  assert.equal(decision.decided_by_user_id, E.id, 'decision actor ID must be DB-derived');

  const [evidence] = await asRole(E.auth_user_id, (tx) => tx`
    INSERT INTO public.evidence
      (product_id, workspace_id, kind, reference, note, recorded_by, recorded_by_user_id, recorded_at)
    VALUES
      (${product.id}, ${E.personal_ws}, 'source_commit', '0009-forged-evidence-actor', 'fixture', 'owner', ${legacy.internalA}, now())
    RETURNING id
  `);
  const [evidenceRow] = await db`
    SELECT e.recorded_by,
           e.recorded_by_user_id,
           e.row_hash,
           encode(extensions.digest(
             coalesce(e.prev_hash, '') || '|' || e.product_id::text || '|' || e.kind::text || '|' ||
             e.reference || '|' || e.note || '|' || e.recorded_by::text || '|' ||
             e.recorded_by_user_id::text || '|' || e.recorded_at::text,
             'sha256'), 'hex') AS expected_hash
      FROM public.evidence e
     WHERE e.id = ${evidence.id}
  `;
  assert.equal(evidenceRow.recorded_by, 'pending', 'evidence role label must be derived from the authenticated actor');
  assert.equal(evidenceRow.recorded_by_user_id, E.id, 'evidence actor ID must be DB-derived');
  assert.equal(evidenceRow.row_hash, evidenceRow.expected_hash, 'the hash trigger must include final DB-derived identity and role');

  const hashChecks = await db`
    SELECT encode(extensions.digest(
             CASE WHEN e.recorded_by_user_id IS NULL THEN
               coalesce(e.prev_hash, '') || '|' || e.product_id::text || '|' || e.kind::text || '|' ||
               e.reference || '|' || e.note || '|' || e.recorded_by::text || '|' || e.recorded_at::text
             ELSE
               coalesce(e.prev_hash, '') || '|' || e.product_id::text || '|' || e.kind::text || '|' ||
               e.reference || '|' || e.note || '|' || e.recorded_by::text || '|' ||
               e.recorded_by_user_id::text || '|' || e.recorded_at::text
             END,
             'sha256'), 'hex') = e.row_hash AS hash_ok
      FROM public.evidence e
  `;
  assert.ok(hashChecks.every((row) => row.hash_ok), 'legacy and attributed evidence must both verify after 0009');
  const [linkage] = await db`
    SELECT count(*)::int AS violations
      FROM (
        SELECT e.prev_hash,
               lag(e.row_hash) OVER (PARTITION BY e.product_id ORDER BY e.recorded_at, e.id) AS expected_prev
          FROM public.evidence e
      ) links
     WHERE coalesce(links.prev_hash, '') IS DISTINCT FROM coalesce(links.expected_prev, '')
  `;
  assert.equal(linkage.violations, 0, 'evidence hash-chain linkage must remain valid across the migration');
  console.log('PASS 0009 attribution: forged goal/decision/evidence labels are overwritten, pending stays pending, and old/new hash payloads verify');
}

async function runConcurrentRoleChangeAndRemoval({ db, databaseUrl, asRole, signups }) {
  const E = signups.E;
  const F = signups.F;
  const G = signups.G;
  const [created] = await asRole(E.auth_user_id, (tx) => tx`SELECT public.create_workspace('0009 RPC race') AS ws_id`);
  const wsId = created.ws_id;
  for (const invitee of [F, G]) {
    const [invitation] = await asRole(E.auth_user_id, (tx) => tx`
      SELECT public.create_invitation(${wsId}, ${invitee.id}::uuid) AS invitation_id
    `);
    await asRole(invitee.auth_user_id, (tx) => tx`SELECT public.accept_invitation(${invitation.invitation_id}::uuid)`);
  }
  await asRole(E.auth_user_id, (tx) => tx`SELECT public.set_workspace_member_role(${wsId}, ${F.id}::uuid, 'owner')`);

  const blocker = postgres(databaseUrl, { max: 1, prepare: false });
  const actor = postgres(databaseUrl, { max: 1, prepare: false });
  const remover = postgres(databaseUrl, { max: 1, prepare: false });
  const blockerReady = deferred();
  const releaseBlocker = deferred();
  const actorPidReady = deferred();
  const removerPidReady = deferred();
  let blockerTask;
  let actorTask;
  let removerTask;
  let actorBlocked = false;
  let removerBlocked = false;

  try {
    blockerTask = blocker.begin(async (tx) => {
      await tx`
        SELECT user_id
          FROM public.workspace_members
         WHERE workspace_id = ${wsId} AND user_id = ${G.id}
         FOR UPDATE
      `;
      blockerReady.resolve();
      await releaseBlocker.promise;
    });
    blockerTask.catch(() => {});
    await blockerReady.promise;

    actorTask = appTransaction(actor, E.auth_user_id, async (tx) => {
      const [pid] = await tx`SELECT pg_backend_pid() AS pid`;
      actorPidReady.resolve(Number(pid.pid));
      await tx`SELECT public.set_workspace_member_role(${wsId}, ${G.id}::uuid, 'owner')`;
    });
    actorTask.catch(() => {});
    const actorPid = await actorPidReady.promise;
    actorBlocked = await waitForLockWait(db, actorPid);

    removerTask = appTransaction(remover, F.auth_user_id, async (tx) => {
      const [pid] = await tx`SELECT pg_backend_pid() AS pid`;
      removerPidReady.resolve(Number(pid.pid));
      const removed = await tx`
        DELETE FROM public.workspace_members
         WHERE workspace_id = ${wsId} AND user_id = ${E.id}
         RETURNING user_id
      `;
      return removed.length;
    });
    removerTask.catch(() => {});
    const removerPid = await removerPidReady.promise;
    removerBlocked = await waitForLockWait(db, removerPid);
  } finally {
    releaseBlocker.resolve();
  }

  const roleRaceResults = await Promise.allSettled([blockerTask, actorTask, removerTask]);
  await Promise.all([blocker.end(), actor.end(), remover.end()]);
  assert.equal(actorBlocked, true, 'the role RPC should wait for the locked target membership after acquiring the workspace lock');
  assert.equal(removerBlocked, true, 'concurrent removal of the RPC caller must wait behind the workspace lock');
  assert.equal(roleRaceResults[1].status, 'fulfilled', 'the owner-authorized role change should complete first');
  assert.equal(roleRaceResults[2].status, 'fulfilled', 'the other owner should then be able to remove the former caller');
  assert.equal(roleRaceResults[2].value, 1);
  const postRaceOwners = await db`
    SELECT user_id, role
      FROM public.workspace_members
     WHERE workspace_id = ${wsId} AND role = 'owner'
     ORDER BY user_id
  `;
  assert.deepEqual(postRaceOwners.map((row) => row.user_id), [F.id, G.id].sort());
  console.log('PASS 0009 role-RPC race: workspace lock serializes role authorization before concurrent caller removal');
}

async function runConcurrentLastOwnerRemoval({ db, databaseUrl, asRole, signups }) {
  const F = signups.F;
  const G = signups.G;
  const [created] = await asRole(F.auth_user_id, (tx) => tx`SELECT public.create_workspace('0009 last-owner race') AS ws_id`);
  const wsId = created.ws_id;
  const [invitation] = await asRole(F.auth_user_id, (tx) => tx`
    SELECT public.create_invitation(${wsId}, ${G.id}::uuid) AS invitation_id
  `);
  await asRole(G.auth_user_id, (tx) => tx`SELECT public.accept_invitation(${invitation.invitation_id}::uuid)`);
  await asRole(F.auth_user_id, (tx) => tx`SELECT public.set_workspace_member_role(${wsId}, ${G.id}::uuid, 'owner')`);

  const blocker = postgres(databaseUrl, { max: 1, prepare: false });
  const removerA = postgres(databaseUrl, { max: 1, prepare: false });
  const removerB = postgres(databaseUrl, { max: 1, prepare: false });
  const blockerReady = deferred();
  const releaseBlocker = deferred();
  const pidAReady = deferred();
  const pidBReady = deferred();
  let blockerTask;
  let removeATask;
  let removeBTask;
  let bothBlocked = false;

  try {
    blockerTask = blocker.begin(async (tx) => {
      await tx`SELECT id FROM public.workspaces WHERE id = ${wsId} FOR UPDATE`;
      blockerReady.resolve();
      await releaseBlocker.promise;
    });
    blockerTask.catch(() => {});
    await blockerReady.promise;

    removeATask = appTransaction(removerA, F.auth_user_id, async (tx) => {
      const [pid] = await tx`SELECT pg_backend_pid() AS pid`;
      pidAReady.resolve(Number(pid.pid));
      const rows = await tx`
        DELETE FROM public.workspace_members
         WHERE workspace_id = ${wsId} AND user_id = ${F.id}
         RETURNING user_id
      `;
      return rows.length;
    });
    removeATask.catch(() => {});
    removeBTask = appTransaction(removerB, G.auth_user_id, async (tx) => {
      const [pid] = await tx`SELECT pg_backend_pid() AS pid`;
      pidBReady.resolve(Number(pid.pid));
      const rows = await tx`
        DELETE FROM public.workspace_members
         WHERE workspace_id = ${wsId} AND user_id = ${G.id}
         RETURNING user_id
      `;
      return rows.length;
    });
    removeBTask.catch(() => {});
    const [pidA, pidB] = await Promise.all([pidAReady.promise, pidBReady.promise]);
    const waitStates = await Promise.all([waitForLockWait(db, pidA), waitForLockWait(db, pidB)]);
    bothBlocked = waitStates.every(Boolean);
  } finally {
    releaseBlocker.resolve();
  }

  const results = await Promise.allSettled([blockerTask, removeATask, removeBTask]);
  await Promise.all([blocker.end(), removerA.end(), removerB.end()]);
  assert.equal(bothBlocked, true, 'both owner-removal statements must queue behind the workspace serialization lock');
  const removals = results.slice(1);
  assert.equal(removals.filter((result) => result.status === 'fulfilled').length, 1, 'exactly one simultaneous last-owner removal may commit');
  const rejected = removals.find((result) => result.status === 'rejected');
  assert.ok(rejected, 'the competing last-owner removal must be rejected');
  assert.equal(rejected.reason.code, '23514');
  const [remaining] = await db`
    SELECT count(*)::int AS owners
      FROM public.workspace_members
     WHERE workspace_id = ${wsId} AND role = 'owner'
  `;
  assert.equal(remaining.owners, 1, 'the surviving workspace must retain exactly one owner');
  console.log('PASS 0009 last-owner concurrency: serialized concurrent removals cannot orphan the workspace');
}

export async function run0009Suite({
  db,
  databaseUrl,
  asRole,
  expectSqlFailure,
  expectMigrationFailure,
  apply0009WithOwnerMap,
  migrationPath,
  legacy,
  signups,
  widgetFixtures,
  inviteLab,
  legacyAuthUsers,
}) {
  const ownerMap = [
    { goal_id: legacy.goal1, owner_id: legacy.internalA },
    { goal_id: legacy.goal2, owner_id: legacy.internalB },
    { goal_id: widgetFixtures.goalE1, owner_id: signups.E.id },
    { goal_id: widgetFixtures.goalE2, owner_id: signups.E.id },
    { goal_id: inviteLab.goalIL, owner_id: signups.E.id },
  ];
  const existingGoals = await db`SELECT id FROM public.goals`;
  assert.equal(existingGoals.length, ownerMap.length, 'the synthetic map must explicitly cover every existing goal exactly once');

  const archiveFixtures = await seedArchivedWorkspaceInvitations({ db, asRole, legacyAuthUsers, signups, legacy });
  await runMigrationPreflightProbes({
    db,
    migrationPath,
    ownerMap,
    apply0009WithOwnerMap,
    expectMigrationFailure,
  });
  await apply0009WithOwnerMap(migrationPath, ownerMap);
  await verify0009TriggerShapes(db);
  await verify0009WorkspaceSplit({ db, asRole, legacyAuthUsers, signups, legacy, archiveFixtures, ownerMap });

  const evidenceAfter = await db`
    SELECT id::text AS id,
           row_hash,
           prev_hash,
           recorded_by::text AS recorded_by,
           recorded_by_user_id::text AS recorded_by_user_id,
           recorded_at::text AS recorded_at
      FROM public.evidence
     ORDER BY id
  `;
  assert.deepEqual(evidenceAfter, archiveFixtures.evidenceBefore, '0009 must preserve all pre-existing evidence IDs, attribution, timestamps, and hash-chain fields byte-for-byte');

  await verify0009AttributionAndHash({ db, asRole, expectSqlFailure, legacy, signups });
  await runConcurrentRoleChangeAndRemoval({ db, databaseUrl, asRole, signups });
  await runConcurrentRemovalWinsRoleRace({ db, databaseUrl, asRole, signups });
  await runConcurrentLastOwnerRemoval({ db, databaseUrl, asRole, signups });
}


async function runConcurrentRemovalWinsRoleRace({ db, databaseUrl, asRole, signups }) {
  const E = signups.E;
  const F = signups.F;
  const G = signups.G;
  const [created] = await asRole(E.auth_user_id, (tx) => tx`SELECT public.create_workspace('0009 RPC revoke race') AS ws_id`);
  const wsId = created.ws_id;
  for (const invitee of [F, G]) {
    const [invitation] = await asRole(E.auth_user_id, (tx) => tx`
      SELECT public.create_invitation(${wsId}, ${invitee.id}::uuid) AS invitation_id
    `);
    await asRole(invitee.auth_user_id, (tx) => tx`SELECT public.accept_invitation(${invitation.invitation_id}::uuid)`);
  }
  await asRole(E.auth_user_id, (tx) => tx`SELECT public.set_workspace_member_role(${wsId}, ${F.id}::uuid, 'owner')`);

  const blocker = postgres(databaseUrl, { max: 1, prepare: false });
  const remover = postgres(databaseUrl, { max: 1, prepare: false });
  const actor = postgres(databaseUrl, { max: 1, prepare: false });
  const blockerReady = deferred();
  const releaseBlocker = deferred();
  const removerPidReady = deferred();
  const actorPidReady = deferred();
  let blockerTask;
  let removerTask;
  let actorTask;
  let removerBlocked = false;
  let actorBlocked = false;

  try {
    blockerTask = blocker.begin(async (tx) => {
      await tx`SELECT id FROM public.workspaces WHERE id = ${wsId} FOR UPDATE`;
      blockerReady.resolve();
      await releaseBlocker.promise;
    });
    blockerTask.catch(() => {});
    await blockerReady.promise;

    removerTask = appTransaction(remover, F.auth_user_id, async (tx) => {
      const [pid] = await tx`SELECT pg_backend_pid() AS pid`;
      removerPidReady.resolve(Number(pid.pid));
      const rows = await tx`
        DELETE FROM public.workspace_members
         WHERE workspace_id = ${wsId} AND user_id = ${E.id}
         RETURNING user_id
      `;
      return rows.length;
    });
    removerTask.catch(() => {});
    const removerPid = await removerPidReady.promise;
    removerBlocked = await waitForLockWait(db, removerPid);

    actorTask = appTransaction(actor, E.auth_user_id, async (tx) => {
      const [pid] = await tx`SELECT pg_backend_pid() AS pid`;
      actorPidReady.resolve(Number(pid.pid));
      await tx`SELECT public.set_workspace_member_role(${wsId}, ${G.id}::uuid, 'owner')`;
    });
    actorTask.catch(() => {});
    const actorPid = await actorPidReady.promise;
    actorBlocked = await waitForLockWait(db, actorPid);
  } finally {
    releaseBlocker.resolve();
  }

  const results = await Promise.allSettled([blockerTask, removerTask, actorTask]);
  await Promise.all([blocker.end(), remover.end(), actor.end()]);
  assert.equal(removerBlocked, true, 'the caller-removal transaction must queue first on the workspace lock');
  assert.equal(actorBlocked, true, 'the RPC must wait behind a concurrent caller-removal transaction');
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(results[1].value, 1);
  assert.equal(results[2].status, 'rejected', 'the removed caller must not complete a later role change');
  assert.equal(results[2].reason.code, '42501', 'the post-lock owner recheck must reject the former owner');
  const [target] = await db`
    SELECT role
      FROM public.workspace_members
     WHERE workspace_id = ${wsId} AND user_id = ${G.id}
  `;
  assert.equal(target.role, 'member', 'the concurrent RPC must not promote a target after its caller was removed');
  console.log('PASS 0009 revoke-wins race: role RPC rechecks fresh owner membership after waiting for workspace serialization');
}
