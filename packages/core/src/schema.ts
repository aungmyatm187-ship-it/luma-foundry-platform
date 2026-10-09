/**
 * Drizzle schema for Luma Foundry.
 *
 * RLS is co-located with tables so policies ship in the same migration.
 * authUid is a SQL value in drizzle-orm/supabase, not a function.
 * Usage: sql`${authUid} = ${column}`.
 *
 * Evidence is append-only with a hash chain for tamper-evident provenance.
 */
import { relations, sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { authUid } from 'drizzle-orm/supabase';

// ── Enums ──────────────────────────────────────────────────────
export const roleEnum = pgEnum('role', ['owner', 'operator_a', 'operator_b']);
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'critical']);
export const productStatusEnum = pgEnum('product_status', [
  'concept', 'in_build', 'in_review', 'conditional', 'cleared', 'blocked',
]);
export const workItemStatusEnum = pgEnum('work_item_status', [
  'todo', 'in_progress', 'blocked', 'done',
]);
export const handoffStatusEnum = pgEnum('handoff_status', [
  'draft', 'sent', 'accepted', 'returned',
]);
export const decisionStatusEnum = pgEnum('decision_status', [
  'open', 'approved', 'declined', 'deferred',
]);
export const evidenceKindEnum = pgEnum('evidence_kind', [
  'source_commit', 'design_history', 'asset_licence', 'contributor_rights',
  'dependency_sbom', 'third_party_notices', 'counsel_review', 'buyer_terms',
]);

// ── Users ──────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  pgPolicy('users_own_rows', {
    as: 'permissive',
    for: 'select',
    to: 'public',
    using: sql`${authUid} = ${t.authUserId}`,
  }),
]).enableRLS();

// ── Goals ──────────────────────────────────────────────────────
export const goals = pgTable('goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  outcome: text('outcome').notNull(),
  priority: priorityEnum('priority').notNull().default('medium'),
  targetDate: timestamp('target_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('goals_owner_idx').on(t.ownerId),
  pgPolicy('goals_own_rows', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`exists (select 1 from users where users.id = ${t.ownerId} and ${authUid} = users.auth_user_id)`,
    withCheck: sql`exists (select 1 from users where users.id = ${t.ownerId} and ${authUid} = users.auth_user_id)`,
  }),
]).enableRLS();

// ── Products ───────────────────────────────────────────────────
export const products = pgTable('products', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  route: text('route').notNull(),
  status: productStatusEnum('status').notNull().default('concept'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('products_goal_idx').on(t.goalId),
  unique('products_id_goal_id_unique').on(t.id, t.goalId),
  pgPolicy('products_own_rows', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id)`,
    withCheck: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id)`,
  }),
]).enableRLS();

// ── Work Items ─────────────────────────────────────────────────
export const workItems = pgTable('work_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
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
  index('work_items_product_goal_idx').on(t.productId, t.goalId),
  foreignKey({
    name: 'work_items_product_goal_fk',
    columns: [t.productId, t.goalId],
    foreignColumns: [products.id, products.goalId],
  }).onDelete('cascade'),
  pgPolicy('work_items_own_rows', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id) and (${t.productId} is null or exists (select 1 from products where products.id = ${t.productId} and products.goal_id = ${t.goalId}))`,
    withCheck: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id) and (${t.productId} is null or exists (select 1 from products where products.id = ${t.productId} and products.goal_id = ${t.goalId}))`,
  }),
]).enableRLS();

// ── Handoffs ───────────────────────────────────────────────────
export const handoffs = pgTable('handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
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
  index('handoffs_product_goal_idx').on(t.productId, t.goalId),
  foreignKey({
    name: 'handoffs_product_goal_fk',
    columns: [t.productId, t.goalId],
    foreignColumns: [products.id, products.goalId],
  }).onDelete('cascade'),
  pgPolicy('handoffs_own_rows', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id) and (${t.productId} is null or exists (select 1 from products where products.id = ${t.productId} and products.goal_id = ${t.goalId}))`,
    withCheck: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id) and (${t.productId} is null or exists (select 1 from products where products.id = ${t.productId} and products.goal_id = ${t.goalId}))`,
  }),
]).enableRLS();

// ── Decisions ──────────────────────────────────────────────────
export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').notNull().references(() => goals.id, { onDelete: 'cascade' }),
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
  index('decisions_product_goal_idx').on(t.productId, t.goalId),
  foreignKey({
    name: 'decisions_product_goal_fk',
    columns: [t.productId, t.goalId],
    foreignColumns: [products.id, products.goalId],
  }).onDelete('cascade'),
  pgPolicy('decisions_own_rows', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id) and (${t.productId} is null or exists (select 1 from products where products.id = ${t.productId} and products.goal_id = ${t.goalId}))`,
    withCheck: sql`exists (select 1 from goals join users on users.id = goals.owner_id where goals.id = ${t.goalId} and ${authUid} = users.auth_user_id) and (${t.productId} is null or exists (select 1 from products where products.id = ${t.productId} and products.goal_id = ${t.goalId}))`,
  }),
]).enableRLS();

// ── Evidence (append-only, hash-chained) ───────────────────────
export const evidence = pgTable('evidence', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  kind: evidenceKindEnum('kind').notNull(),
  reference: text('reference').notNull(),
  note: text('note').notNull(),
  recordedBy: roleEnum('recorded_by').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  prevHash: text('prev_hash'),
  rowHash: text('row_hash'),
}, (t) => [
  index('evidence_product_idx').on(t.productId),
  pgPolicy('evidence_own_rows', {
    as: 'permissive',
    for: 'all',
    to: 'public',
    using: sql`exists (select 1 from products join goals on goals.id = products.goal_id join users on users.id = goals.owner_id where products.id = ${t.productId} and ${authUid} = users.auth_user_id)`,
    withCheck: sql`exists (select 1 from products join goals on goals.id = products.goal_id join users on users.id = goals.owner_id where products.id = ${t.productId} and ${authUid} = users.auth_user_id)`,
  }),
]).enableRLS();

// ── Relations ──────────────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  goals: many(goals),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  owner: one(users, { fields: [goals.ownerId], references: [users.id] }),
  products: many(products),
  workItems: many(workItems),
  handoffs: many(handoffs),
  decisions: many(decisions),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  goal: one(goals, { fields: [products.goalId], references: [goals.id] }),
  workItems: many(workItems),
  handoffs: many(handoffs),
  decisions: many(decisions),
  evidence: many(evidence),
}));
