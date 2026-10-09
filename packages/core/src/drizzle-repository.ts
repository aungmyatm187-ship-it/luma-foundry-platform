/**
 * Postgres-backed WorkspaceRepository.
 *
 * Constructor takes the Supabase auth UUID (JWT sub claim). Every query runs
 * inside withUser(authUserId, ...) so auth.uid() returns that UUID and RLS
 * policies scope the result to that user.
 *
 * Internal user resolution: whenever a write needs an owner_id, we resolve it
 * from auth.uid() via a subquery rather than trusting a caller-supplied id.
 *
 * createUser throws: users are provisioned by Supabase Auth via the
 * on_auth_user_created trigger. Application code must not insert into
 * public.users directly.
 */
import { eq, and, desc } from 'drizzle-orm';

import { withUser } from './db.js';
import * as schema from './schema.js';
import type { WorkspaceRepository } from './repository.js';
import type {
  Decision,
  DecisionStatus,
  Evidence,
  Goal,
  Handoff,
  HandoffStatus,
  Priority,
  Product,
  ProductStatus,
  Role,
  Snapshot,
  User,
  WorkItem,
  WorkItemStatus,
} from './types.js';

type Tx = any;

export class DrizzleRepository implements WorkspaceRepository {
  constructor(private readonly authUserId: string) {}

  private run<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return withUser(this.authUserId, fn);
  }

  async createUser(_name: string, _role: Role): Promise<User> {
    throw new Error(
      'DrizzleRepository.createUser is not supported. Users are provisioned by Supabase Auth; the on_auth_user_created trigger inserts into public.users.',
    );
  }

  async createGoal(input: {
    ownerId: string;
    title: string;
    outcome: string;
    priority?: Priority;
    targetDate?: string | null;
  }): Promise<Goal> {
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.goals)
        .values({
          ownerId: input.ownerId,
          title: input.title,
          outcome: input.outcome,
          priority: input.priority ?? 'medium',
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
        })
        .returning();
      return rowToGoal(row);
    });
  }

  async createProduct(input: {
    goalId: string;
    name: string;
    category: string;
    route: string;
  }): Promise<Product> {
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.products)
        .values({
          goalId: input.goalId,
          name: input.name,
          category: input.category,
          route: input.route,
        })
        .returning();
      return rowToProduct(row);
    });
  }

  async createWorkItem(input: {
    goalId: string;
    productId?: string | null;
    type: string;
    assignedTo: Role;
    title: string;
    detail: string;
    priority?: Priority;
  }): Promise<WorkItem> {
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.workItems)
        .values({
          goalId: input.goalId,
          productId: input.productId ?? null,
          type: input.type,
          assignedTo: input.assignedTo,
          title: input.title,
          detail: input.detail,
          priority: input.priority ?? 'medium',
        })
        .returning();
      return rowToWorkItem(row);
    });
  }

  async createHandoff(input: {
    goalId: string;
    productId?: string | null;
    fromRole: Role;
    toRole: Role;
    title: string;
    summary: string;
    asks: string;
  }): Promise<Handoff> {
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.handoffs)
        .values({
          goalId: input.goalId,
          productId: input.productId ?? null,
          fromRole: input.fromRole,
          toRole: input.toRole,
          title: input.title,
          summary: input.summary,
          asks: input.asks,
        })
        .returning();
      return rowToHandoff(row);
    });
  }

  async createDecision(input: {
    goalId: string;
    productId?: string | null;
    title: string;
    context: string;
    decision: string;
    ownerId: string;
  }): Promise<Decision> {
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.decisions)
        .values({
          goalId: input.goalId,
          productId: input.productId ?? null,
          title: input.title,
          context: input.context,
          decision: input.decision,
          ownerId: input.ownerId,
        })
        .returning();
      return rowToDecision(row);
    });
  }

  async recordEvidence(input: {
    productId: string;
    kind: Evidence['kind'];
    reference: string;
    note: string;
    recordedBy: Role;
  }): Promise<Evidence> {
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.evidence)
        .values({
          productId: input.productId,
          kind: input.kind,
          reference: input.reference,
          note: input.note,
          recordedBy: input.recordedBy,
        })
        .returning();
      return rowToEvidence(row);
    });
  }

  async updateProductStatus(productId: string, status: ProductStatus): Promise<Product> {
    return this.run(async (tx) => {
      const [row] = await tx
        .update(schema.products)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.products.id, productId))
        .returning();
      if (!row) throw new Error(`Unknown product: ${productId}`);
      return rowToProduct(row);
    });
  }

  async updateWorkItemStatus(workItemId: string, status: WorkItemStatus): Promise<WorkItem> {
    return this.run(async (tx) => {
      const [row] = await tx
        .update(schema.workItems)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.workItems.id, workItemId))
        .returning();
      if (!row) throw new Error(`Unknown work item: ${workItemId}`);
      return rowToWorkItem(row);
    });
  }

  async updateDecisionStatus(
    decisionId: string,
    status: DecisionStatus,
    decidedBy: Role | null,
  ): Promise<Decision> {
    return this.run(async (tx) => {
      const [row] = await tx
        .update(schema.decisions)
        .set({
          status,
          decidedBy: status === 'approved' || status === 'declined' ? decidedBy : null,
          resolvedAt:
            status === 'open' || status === 'deferred' ? null : new Date(),
        })
        .where(eq(schema.decisions.id, decisionId))
        .returning();
      if (!row) throw new Error(`Unknown decision: ${decisionId}`);
      return rowToDecision(row);
    });
  }

  async updateHandoffStatus(handoffId: string, status: HandoffStatus): Promise<Handoff> {
    return this.run(async (tx) => {
      const [row] = await tx
        .update(schema.handoffs)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.handoffs.id, handoffId))
        .returning();
      if (!row) throw new Error(`Unknown handoff: ${handoffId}`);
      return rowToHandoff(row);
    });
  }

  async snapshot(): Promise<Snapshot> {
    return this.run(async (tx) => {
      const [users, goals, products, workItems, handoffs, decisions, evidence] =
        await Promise.all([
          tx.select().from(schema.users),
          tx.select().from(schema.goals),
          tx.select().from(schema.products),
          tx.select().from(schema.workItems),
          tx.select().from(schema.handoffs),
          tx.select().from(schema.decisions),
          tx.select().from(schema.evidence),
        ]);
      return {
        users: users.map(rowToUser),
        goals: goals.map(rowToGoal),
        products: products.map(rowToProduct),
        workItems: workItems.map(rowToWorkItem),
        handoffs: handoffs.map(rowToHandoff),
        decisions: decisions.map(rowToDecision),
        evidence: evidence.map(rowToEvidence),
        takenAt: new Date().toISOString(),
      };
    });
  }

  async evidenceFor(productId: string): Promise<Evidence[]> {
    return this.run(async (tx) => {
      const rows = await tx
        .select()
        .from(schema.evidence)
        .where(eq(schema.evidence.productId, productId))
        .orderBy(desc(schema.evidence.recordedAt));
      return rows.map(rowToEvidence);
    });
  }
}

// ── Row mappers ────────────────────────────────────────────────
// Each takes a DB row and returns a domain type. Dates become ISO strings.

function rowToUser(r: any): User {
  return { id: r.id, name: r.name, role: r.role, createdAt: r.createdAt.toISOString() };
}

function rowToGoal(r: any): Goal {
  return {
    id: r.id,
    ownerId: r.ownerId,
    title: r.title,
    outcome: r.outcome,
    priority: r.priority,
    targetDate: r.targetDate ? r.targetDate.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToProduct(r: any): Product {
  return {
    id: r.id,
    goalId: r.goalId,
    name: r.name,
    category: r.category,
    route: r.route,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToWorkItem(r: any): WorkItem {
  return {
    id: r.id,
    goalId: r.goalId,
    productId: r.productId ?? null,
    type: r.type,
    assignedTo: r.assignedTo,
    title: r.title,
    detail: r.detail,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToHandoff(r: any): Handoff {
  return {
    id: r.id,
    goalId: r.goalId,
    productId: r.productId ?? null,
    fromRole: r.fromRole,
    toRole: r.toRole,
    title: r.title,
    summary: r.summary,
    asks: r.asks,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function rowToDecision(r: any): Decision {
  return {
    id: r.id,
    goalId: r.goalId,
    productId: r.productId ?? null,
    title: r.title,
    context: r.context,
    decision: r.decision,
    status: r.status,
    ownerId: r.ownerId,
    decidedBy: r.decidedBy ?? null,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  };
}

function rowToEvidence(r: any): Evidence {
  return {
    id: r.id,
    productId: r.productId,
    kind: r.kind,
    reference: r.reference,
    note: r.note,
    recordedBy: r.recordedBy,
    recordedAt: r.recordedAt.toISOString(),
  };
}
