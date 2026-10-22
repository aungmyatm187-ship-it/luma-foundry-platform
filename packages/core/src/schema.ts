import { relations, sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ── Enums ──────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['owner', 'operator_a', 'operator_b', 'pending']);
export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'member']);
export const productStatusEnum = pgEnum('product_status', ['concept', 'in_build', 'in_review', 'conditional', 'cleared', 'blocked']);
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'critical']);
export const workItemStatusEnum = pgEnum('work_item_status', ['todo', 'in_progress', 'blocked', 'done']);
export const handoffStatusEnum = pgEnum('handoff_status', ['draft', 'sent', 'accepted', 'returned']);
export const decisionStatusEnum = pgEnum('decision_status', ['open', 'approved', 'declined', 'deferred']);
export const evidenceKindEnum = pgEnum('evidence_kind', [
  'source_commit', 'design_history', 'asset_licence', 'contributor_rights',
  'dependency_sbom', 'third_party_notices', 'counsel_review', 'buyer_terms',
]);

// ── Tables ─────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  pgPolicy('users_own_rows', {
    as: 'permissive', for: 'select', to: 'public',
    using: sql`auth.uid() = ${t.authUserId}`,
  }),
  pgPolicy('users_workspace_peers', {
    as: 'permissive', for: 'select', to: 'public',
    using: sql`public.shares_workspace_with(${t.id})`,
  }),
]).enableRLS();

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  pgPolicy('workspaces_select_members', {
    as: 'permissive', for: 'select', to: 'public',
    using: sql`public.is_workspace_member(${t.id})`,
  }),
  pgPolicy('workspaces_update_owners', {
    as: 'permissive', for: 'update', to: 'public',
    using: sql`public.is_workspace_owner(${t.id})`,
    withCheck: sql`public.is_workspace_owner(${t.id})`,
  }),
  pgPolicy('workspaces_delete_owners', {
    as: 'permissive', for: 'delete', to: 'public',
    using: sql`public.is_workspace_owner(${t.id})`,
  }),
]).enableRLS();

export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: workspaceRoleEnum('role').notNull().default('member'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  primaryKey({ name: 'workspace_members_pkey', columns: [t.workspaceId, t.userId] }),
  index('workspace_members_user_idx').on(t.userId),
  pgPolicy('workspace_members_select', {
    as: 'permissive', for: 'select', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
  // No INSERT policy on purpose (migration 0008, locked decision #2): membership
  // rows are created only by the SECURITY DEFINER function accept_invitation()
  // when an invitee accepts. With RLS enabled and app_user NOBYPASSRLS, even a
  // workspace owner cannot insert members directly — owner action alone is not
  // consent. 0008 additionally revokes the INSERT grant and guards UPDATE from
  // changing user_id/workspace_id, closing the consent bypass.
  pgPolicy('workspace_members_update_owners', {
    as: 'permissive', for: 'update', to: 'public',
    using: sql`public.is_workspace_owner(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_owner(${t.workspaceId})`,
  }),
  pgPolicy('workspace_members_delete_owner_or_self', {
    as: 'permissive', for: 'delete', to: 'public',
    using: sql`public.is_workspace_owner(${t.workspaceId}) or ${t.userId} = public.current_user_id()`,
  }),
]).enableRLS();

/**
 * Membership invitations (migration 0008, locked decisions #1–#2). Membership
 * is consent-based: an owner invites an existing registered user, and only
 * that user's acceptance creates the workspace_members row.
 *
 * Rows are written ONLY by the SECURITY DEFINER database functions
 * create_invitation / accept_invitation / revoke_invitation, which enforce:
 *   - create: caller owns the workspace; invitee is not already a member;
 *     re-inviting the same user revokes the outstanding invitation and
 *     issues a replacement; seven-day expiry is set by the function itself,
 *     never by the client;
 *   - accept: caller is the invitee; invitation is not expired, revoked,
 *     or already accepted (single-use, atomic with the membership insert);
 *   - revoke: caller owns the workspace at call time.
 *
 * RLS therefore declares NO INSERT/UPDATE/DELETE policy: with RLS enabled and
 * app_user NOBYPASSRLS, direct writes to this table are impossible even if a
 * table grant existed. Reading is limited to the two parties of an invitation
 * (the invitee and the workspace owners).
 */
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  inviteeUserId: uuid('invitee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedBy: uuid('invited_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  invitedAt: timestamp('invited_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'restrict' }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (t) => [
  check('workspace_invitations_expiry_check', sql`${t.expiresAt} > ${t.invitedAt}`),
  check('workspace_invitations_accept_pair_check', sql`(${t.acceptedAt} is null) = (${t.acceptedBy} is null)`),
  check('workspace_invitations_revoked_not_accepted_check', sql`not (${t.revokedAt} is not null and ${t.acceptedAt} is not null)`),
  index('workspace_invitations_invitee_pending_idx')
    .on(t.inviteeUserId, t.expiresAt)
    .where(sql`accepted_at is null and revoked_at is null`),
  index('workspace_invitations_workspace_pending_idx')
    .on(t.workspaceId, t.expiresAt)
    .where(sql`accepted_at is null and revoked_at is null`),
  pgPolicy('workspace_invitations_select_parties', {
    as: 'permissive', for: 'select', to: 'public',
    using: sql`${t.inviteeUserId} = public.current_user_id() or public.is_workspace_owner(${t.workspaceId})`,
  }),
]).enableRLS();

export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'restrict' }),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  outcome: text('outcome').notNull(),
  priority: priorityEnum('priority').notNull().default('medium'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('goals_owner_idx').on(t.ownerId),
  index('goals_workspace_idx').on(t.workspaceId),
  unique('goals_id_workspace_id_unique').on(t.id, t.workspaceId),
  pgPolicy('goals_workspace_members', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
]).enableRLS();

export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  goalId: uuid('goal_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  route: text('route').notNull(),
  status: productStatusEnum('status').notNull().default('concept'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('products_goal_idx').on(t.goalId),
  index('products_workspace_idx').on(t.workspaceId),
  unique('products_id_workspace_id_unique').on(t.id, t.workspaceId),
  foreignKey({
    name: 'products_goal_workspace_fk',
    columns: [t.goalId, t.workspaceId],
    foreignColumns: [goals.id, goals.workspaceId],
  }).onDelete('cascade'),
  pgPolicy('products_workspace_members', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
]).enableRLS();

export const workItems = pgTable('work_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  goalId: uuid('goal_id').notNull(),
  productId: uuid('product_id'),
  type: text('type').notNull(),
  assignedTo: roleEnum('assigned_to').notNull(),
  title: text('title').notNull(),
  detail: text('detail').notNull(),
  priority: priorityEnum('priority').notNull().default('medium'),
  status: workItemStatusEnum('status').notNull().default('todo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('work_items_goal_idx').on(t.goalId),
  index('work_items_product_idx').on(t.productId),
  index('work_items_workspace_idx').on(t.workspaceId),
  foreignKey({
    name: 'work_items_goal_workspace_fk',
    columns: [t.goalId, t.workspaceId],
    foreignColumns: [goals.id, goals.workspaceId],
  }).onDelete('cascade'),
  pgPolicy('work_items_workspace_members', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
]).enableRLS();

export const handoffs = pgTable('handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  goalId: uuid('goal_id').notNull(),
  productId: uuid('product_id'),
  fromRole: roleEnum('from_role').notNull(),
  toRole: roleEnum('to_role').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  asks: text('asks').notNull(),
  status: handoffStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('handoffs_goal_idx').on(t.goalId),
  index('handoffs_product_idx').on(t.productId),
  index('handoffs_workspace_idx').on(t.workspaceId),
  foreignKey({
    name: 'handoffs_goal_workspace_fk',
    columns: [t.goalId, t.workspaceId],
    foreignColumns: [goals.id, goals.workspaceId],
  }).onDelete('cascade'),
  pgPolicy('handoffs_workspace_members', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
]).enableRLS();

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  goalId: uuid('goal_id').notNull(),
  productId: uuid('product_id'),
  title: text('title').notNull(),
  context: text('context').notNull(),
  decision: text('decision').notNull(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  decidedBy: roleEnum('decided_by'),
  /**
   * Database-derived identity of the authenticated actor who recorded the
   * decision state (migration 0008 BEFORE trigger). Never a trusted client
   * input: input schemas and the repository leave it unset, and the trigger
   * derives it from auth.uid() on every INSERT/update. Nullable while rows
   * written before 0008 keep their historical NULL.
   */
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  status: decisionStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [
  index('decisions_goal_idx').on(t.goalId),
  index('decisions_product_idx').on(t.productId),
  index('decisions_workspace_idx').on(t.workspaceId),
  foreignKey({
    name: 'decisions_goal_workspace_fk',
    columns: [t.goalId, t.workspaceId],
    foreignColumns: [goals.id, goals.workspaceId],
  }).onDelete('cascade'),
  pgPolicy('decisions_workspace_members', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
]).enableRLS();

export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  productId: uuid('product_id').notNull(),
  kind: evidenceKindEnum('kind').notNull(),
  reference: text('reference').notNull(),
  note: text('note').notNull(),
  recordedBy: roleEnum('recorded_by').notNull(),
  /**
   * Database-derived identity of the authenticated actor who recorded this
   * evidence (migration 0008). The 0008 attribution trigger runs before the
   * 0001 hash-chain trigger (a10_… before z90_…), so the DB-derived actor is
   * what the row hash commits to. Never a trusted client input: input schemas
   * and the repository leave it unset. Nullable while rows written before
   * 0008 keep their historical NULL — historical rows are never backfilled
   * with guessed identities.
   */
  recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, { onDelete: 'restrict' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  prevHash: text('prev_hash'),
  rowHash: text('row_hash'),
}, (t) => [
  index('evidence_product_idx').on(t.productId),
  index('evidence_workspace_idx').on(t.workspaceId),
  foreignKey({
    name: 'evidence_product_workspace_fk',
    columns: [t.productId, t.workspaceId],
    foreignColumns: [products.id, products.workspaceId],
  }).onDelete('cascade'),
  pgPolicy('evidence_workspace_members', {
    as: 'permissive', for: 'all', to: 'public',
    using: sql`public.is_workspace_member(${t.workspaceId})`,
    withCheck: sql`public.is_workspace_member(${t.workspaceId})`,
  }),
]).enableRLS();

// ── Relations ──────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  ownedGoals: many(goals),
  memberships: many(workspaceMembers),
  invitationsReceived: many(workspaceInvitations, { relationName: 'invitations_invitee' }),
  invitationsSent: many(workspaceInvitations, { relationName: 'invitations_inviter' }),
  invitationsAccepted: many(workspaceInvitations, { relationName: 'invitations_accepted_by' }),
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  goals: many(goals),
  invitations: many(workspaceInvitations),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceInvitations.workspaceId], references: [workspaces.id] }),
  invitee: one(users, {
    fields: [workspaceInvitations.inviteeUserId],
    references: [users.id],
    relationName: 'invitations_invitee',
  }),
  inviter: one(users, {
    fields: [workspaceInvitations.invitedBy],
    references: [users.id],
    relationName: 'invitations_inviter',
  }),
  acceptedByUser: one(users, {
    fields: [workspaceInvitations.acceptedBy],
    references: [users.id],
    relationName: 'invitations_accepted_by',
  }),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [goals.workspaceId], references: [workspaces.id] }),
  owner: one(users, { fields: [goals.ownerId], references: [users.id] }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  goal: one(goals, { fields: [products.goalId], references: [goals.id] }),
  workItems: many(workItems),
}));
