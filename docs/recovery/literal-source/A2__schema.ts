import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

const collaboratorRoles = ["owner", "operator_a", "operator_b"] as const;

export const collaborationGoals = mysqlTable("collaborationGoals", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  outcome: text("outcome").notNull(),
  priority: mysqlEnum("priority", ["focus", "next", "later"]).default("focus").notNull(),
  status: mysqlEnum("goalStatus", ["active", "paused", "complete"]).default("active").notNull(),
  targetDate: timestamp("targetDate"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("collaborationGoals_ownerId_idx").on(table.ownerId)]);

export const collaborationProducts = mysqlTable("collaborationProducts", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull().references(() => collaborationGoals.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  category: varchar("category", { length: 120 }).notNull(),
  route: varchar("route", { length: 255 }),
  status: mysqlEnum("productStatus", ["concept", "in_progress", "review", "live", "packaged"]).default("concept").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("collaborationProducts_goalId_idx").on(table.goalId)]);

export const collaborationWorkItems = mysqlTable("collaborationWorkItems", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull().references(() => collaborationGoals.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => collaborationProducts.id, { onDelete: "set null" }),
  type: mysqlEnum("workItemType", ["task", "support"]).default("task").notNull(),
  assignedTo: mysqlEnum("assignedTo", collaboratorRoles).default("owner").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  detail: text("detail"),
  priority: mysqlEnum("workItemPriority", ["high", "medium", "low"]).default("medium").notNull(),
  status: mysqlEnum("workItemStatus", ["backlog", "ready", "in_progress", "blocked", "review", "done"]).default("ready").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index("collaborationWorkItems_goalId_idx").on(table.goalId),
  index("collaborationWorkItems_assignedTo_idx").on(table.assignedTo),
]);

export const collaborationHandoffs = mysqlTable("collaborationHandoffs", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull().references(() => collaborationGoals.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => collaborationProducts.id, { onDelete: "set null" }),
  fromRole: mysqlEnum("fromRole", collaboratorRoles).notNull(),
  toRole: mysqlEnum("toRole", collaboratorRoles).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  summary: text("summary").notNull(),
  asks: text("asks"),
  status: mysqlEnum("handoffStatus", ["open", "acknowledged", "resolved"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => [index("collaborationHandoffs_goalId_idx").on(table.goalId)]);

export const collaborationDecisions = mysqlTable("collaborationDecisions", {
  id: int("id").autoincrement().primaryKey(),
  goalId: int("goalId").notNull().references(() => collaborationGoals.id, { onDelete: "cascade" }),
  productId: int("productId").references(() => collaborationProducts.id, { onDelete: "set null" }),
  title: varchar("title", { length: 180 }).notNull(),
  context: text("context").notNull(),
  decision: text("decision"),
  status: mysqlEnum("decisionStatus", ["pending", "approved", "declined"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
}, (table) => [index("collaborationDecisions_goalId_idx").on(table.goalId)]);

export type CollaborationGoal = typeof collaborationGoals.$inferSelect;
export type CollaborationProduct = typeof collaborationProducts.$inferSelect;
export type CollaborationWorkItem = typeof collaborationWorkItems.$inferSelect;
export type CollaborationHandoff = typeof collaborationHandoffs.$inferSelect;
export type CollaborationDecision = typeof collaborationDecisions.$inferSelect;
