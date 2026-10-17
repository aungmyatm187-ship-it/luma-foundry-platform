import { relations, sql } from 'drizzle-orm';
import {
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
  pgPolicy('workspace_members_insert_owners', {
    as: 'permissive', for: 'insert', to: 'public',
    withCheck: sql`public.is_workspace_owner(${t.workspaceId})`,
  }),
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
}));

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  goals: many(goals),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, { fields: [workspaceMembers.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
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
