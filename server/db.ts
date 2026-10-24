import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  collaborationDecisions,
  collaborationGoals,
  collaborationHandoffs,
  collaborationProducts,
  collaborationWorkItems,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import type {
  createDecisionInput,
  createGoalInput,
  createHandoffInput,
  createProductInput,
  createWorkItemInput,
  updateDecisionStatusInput,
  updateWorkStatusInput,
} from "./workspaceSchemas";
import type { z } from "zod";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

type GoalInput = z.infer<typeof createGoalInput>;
type ProductInput = z.infer<typeof createProductInput>;
type WorkItemInput = z.infer<typeof createWorkItemInput>;
type HandoffInput = z.infer<typeof createHandoffInput>;
type DecisionInput = z.infer<typeof createDecisionInput>;
type WorkStatusInput = z.infer<typeof updateWorkStatusInput>;
type DecisionStatusInput = z.infer<typeof updateDecisionStatusInput>;

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new Error("The collaboration workspace database is unavailable.");
  return db;
}

async function assertGoalOwnership(ownerId: number, goalId: number) {
  const db = await requireDatabase();
  const match = await db.select({ id: collaborationGoals.id })
    .from(collaborationGoals)
    .where(and(eq(collaborationGoals.id, goalId), eq(collaborationGoals.ownerId, ownerId)))
    .limit(1);
  if (!match.length) throw new Error("That goal is unavailable for this workspace.");
  return db;
}

async function assertProductBelongsToGoal(productId: number | null | undefined, goalId: number, ownerId: number) {
  if (!productId) return;
  const db = await assertGoalOwnership(ownerId, goalId);
  const match = await db.select({ id: collaborationProducts.id })
    .from(collaborationProducts)
    .where(and(eq(collaborationProducts.id, productId), eq(collaborationProducts.goalId, goalId)))
    .limit(1);
  if (!match.length) throw new Error("That product does not belong to the selected goal.");
}

export async function getWorkspaceSnapshot(ownerId: number) {
  const db = await requireDatabase();
  const goals = await db.select().from(collaborationGoals)
    .where(eq(collaborationGoals.ownerId, ownerId))
    .orderBy(desc(collaborationGoals.updatedAt));
  const goalIds = goals.map((goal) => goal.id);
  if (!goalIds.length) return { goals, products: [], workItems: [], handoffs: [], decisions: [] };
  const [products, workItems, handoffs, decisions] = await Promise.all([
    db.select().from(collaborationProducts).where(inArray(collaborationProducts.goalId, goalIds)).orderBy(desc(collaborationProducts.updatedAt)),
    db.select().from(collaborationWorkItems).where(inArray(collaborationWorkItems.goalId, goalIds)).orderBy(desc(collaborationWorkItems.updatedAt)),
    db.select().from(collaborationHandoffs).where(inArray(collaborationHandoffs.goalId, goalIds)).orderBy(desc(collaborationHandoffs.updatedAt)),
    db.select().from(collaborationDecisions).where(inArray(collaborationDecisions.goalId, goalIds)).orderBy(desc(collaborationDecisions.createdAt)),
  ]);
  return { goals, products, workItems, handoffs, decisions };
}

export async function createGoal(ownerId: number, input: GoalInput) {
  const db = await requireDatabase();
  await db.insert(collaborationGoals).values({ ownerId, ...input });
  return { success: true };
}

export async function createProduct(ownerId: number, input: ProductInput) {
  const db = await assertGoalOwnership(ownerId, input.goalId);
  await db.insert(collaborationProducts).values({ ...input, route: input.route || null });
  return { success: true };
}

export async function createWorkItem(ownerId: number, input: WorkItemInput) {
  const db = await assertGoalOwnership(ownerId, input.goalId);
  await assertProductBelongsToGoal(input.productId, input.goalId, ownerId);
  await db.insert(collaborationWorkItems).values({ ...input, productId: input.productId ?? null, detail: input.detail || null });
  return { success: true };
}

export async function createHandoff(ownerId: number, input: HandoffInput) {
  const db = await assertGoalOwnership(ownerId, input.goalId);
  await assertProductBelongsToGoal(input.productId, input.goalId, ownerId);
  await db.insert(collaborationHandoffs).values({ ...input, productId: input.productId ?? null, asks: input.asks || null });
  return { success: true };
}

export async function createDecision(ownerId: number, input: DecisionInput) {
  const db = await assertGoalOwnership(ownerId, input.goalId);
  await assertProductBelongsToGoal(input.productId, input.goalId, ownerId);
  await db.insert(collaborationDecisions).values({ ...input, productId: input.productId ?? null });
  return { success: true };
}

export async function updateWorkItemStatus(ownerId: number, input: WorkStatusInput) {
  const db = await requireDatabase();
  const match = await db.select({ id: collaborationWorkItems.id }).from(collaborationWorkItems)
    .innerJoin(collaborationGoals, eq(collaborationWorkItems.goalId, collaborationGoals.id))
    .where(and(eq(collaborationWorkItems.id, input.id), eq(collaborationGoals.ownerId, ownerId))).limit(1);
  if (!match.length) throw new Error("That work item is unavailable for this workspace.");
  await db.update(collaborationWorkItems).set({ status: input.status }).where(eq(collaborationWorkItems.id, input.id));
  return { success: true };
}

export async function updateDecisionStatus(ownerId: number, input: DecisionStatusInput) {
  const db = await requireDatabase();
  const match = await db.select({ id: collaborationDecisions.id }).from(collaborationDecisions)
    .innerJoin(collaborationGoals, eq(collaborationDecisions.goalId, collaborationGoals.id))
    .where(and(eq(collaborationDecisions.id, input.id), eq(collaborationGoals.ownerId, ownerId))).limit(1);
  if (!match.length) throw new Error("That decision is unavailable for this workspace.");
  await db.update(collaborationDecisions).set({
    status: input.status,
    decision: input.decision || null,
    resolvedAt: input.status === "pending" ? null : new Date(),
  }).where(eq(collaborationDecisions.id, input.id));
  return { success: true };
}
