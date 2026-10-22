import { eq, desc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { withUser } from './db.js';
import * as schema from './schema.js';
import type { WorkspaceRepository } from './repository.js';
import type {
  Decision, DecisionStatus, Evidence, Goal, Handoff, HandoffStatus,
  Priority, Product, ProductStatus, Role, Snapshot, User, WorkItem,
  WorkItemStatus, WorkspaceInvitation, WorkspaceRecord, WorkspaceMember
} from './types.js';

export class DrizzleRepository implements WorkspaceRepository {
  constructor(private readonly authUserId: string) {}

  private run<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return withUser(this.authUserId, fn);
  }

  async getCurrentUser(): Promise<User | null> {
    return this.run(async (tx) => {
      const [row] = await tx.select().from(schema.users).limit(1);
      return row ? rowToUser(row) : null;
    });
  }

  async createUser(_name: string, _role: Role): Promise<User> {
    throw new Error('DrizzleRepository.createUser is not supported. Users are provisioned by Supabase Auth.');
  }

  async createGoal(input: {
    workspaceId: string;
    ownerId: string;
    title: string;
    outcome: string;
    priority?: Priority;
    targetDate?: string | null;
  }): Promise<Goal> {
    // RLS on the goals INSERT verifies that the caller is a member of
    // input.workspaceId (goals_workspace_members, WITH CHECK). A non-member
    // receives 42501, which the router maps to FORBIDDEN. No client-chosen
    // workspace can bypass that.
    return this.run(async (tx) => {
      const [row] = await tx
        .insert(schema.goals)
        .values({
          workspaceId: input.workspaceId,
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

  async createProduct(input: { goalId: string; name: string; category: string; route: string }): Promise<Product> {
    return this.run(async (tx) => {
      const [goal] = await tx.select().from(schema.goals).where(eq(schema.goals.id, input.goalId)).limit(1);
      if (!goal) throw new Error(`Unknown goal: ${input.goalId}`);

      const [row] = await tx
        .insert(schema.products)
        .values({
          workspaceId: goal.workspaceId,
          goalId: input.goalId,
          name: input.name,
          category: input.category,
          route: input.route,
        })
        .returning();
      return rowToProduct(row);
    });
  }

  async hasProductForGoal(goalId: string, productId: string): Promise<boolean> {
    return this.run(async (tx) => {
      const [row] = await tx
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(eq(schema.products.id, productId))
        .limit(1);
      return Boolean(row && row.id === productId);
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
      const [goal] = await tx.select().from(schema.goals).where(eq(schema.goals.id, input.goalId)).limit(1);
      if (!goal) throw new Error(`Unknown goal: ${input.goalId}`);

      const [row] = await tx
        .insert(schema.workItems)
        .values({
          workspaceId: goal.workspaceId,
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
      const [goal] = await tx.select().from(schema.goals).where(eq(schema.goals.id, input.goalId)).limit(1);
      if (!goal) throw new Error(`Unknown goal: ${input.goalId}`);

      const [row] = await tx
        .insert(schema.handoffs)
        .values({
          workspaceId: goal.workspaceId,
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
      const [goal] = await tx.select().from(schema.goals).where(eq(schema.goals.id, input.goalId)).limit(1);
      if (!goal) throw new Error(`Unknown goal: ${input.goalId}`);

      const [row] = await tx
        .insert(schema.decisions)
        .values({
          workspaceId: goal.workspaceId,
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
      const [product] = await tx.select().from(schema.products).where(eq(schema.products.id, input.productId)).limit(1);
      if (!product) throw new Error(`Unknown product: ${input.productId}`);

      const [row] = await tx
        .insert(schema.evidence)
        .values({
          workspaceId: product.workspaceId,
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

  async updateDecisionStatus(decisionId: string, status: DecisionStatus, decidedBy: Role | null): Promise<Decision> {
    return this.run(async (tx) => {
      const [row] = await tx
        .update(schema.decisions)
        .set({
          status,
          decidedBy: status === 'approved' || status === 'declined' ? decidedBy : null,
          resolvedAt: status === 'open' || status === 'deferred' ? null : new Date(),
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
      const [users, workspaces, workspaceMembers, goals, products, workItems, handoffs, decisions, evidence] =
        await Promise.all([
          tx.select().from(schema.users),
          tx.select().from(schema.workspaces),
          tx.select().from(schema.workspaceMembers),
          tx.select().from(schema.goals),
          tx.select().from(schema.products),
          tx.select().from(schema.workItems),
          tx.select().from(schema.handoffs),
          tx.select().from(schema.decisions),
          tx.select().from(schema.evidence),
        ]);
      return {
        users: users.map(rowToUser),
        workspaces: workspaces.map(rowToWorkspace),
        workspaceMembers: workspaceMembers.map(rowToWorkspaceMember),
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

  // ── Invitations (migration 0008) ────────────────────────────────
  // All four operations call the SECURITY DEFINER database functions — there
  // is deliberately no INSERT into workspace_members anywhere in this file.
  // The functions own the rules: owner-only create/revoke, invitee-only
  // accept, seven-day expiry, revoke-and-replace on duplicate invites, and
  // single-use atomic acceptance.

  async inviteUser(input: { workspaceId: string; inviteeUserId: string }): Promise<WorkspaceInvitation> {
    return this.run(async (tx) => {
      // Assumed 0008 contract (to be confirmed against the applied SQL):
      //   public.create_invitation(p_workspace_id uuid, p_invitee_user_id uuid)
      //     returns uuid — the new invitation id.
      // The seven-day expiry is set inside the function; it is deliberately
      // not a client argument. If the applied function takes an explicit
      // expiry instead, only this call site changes — the API surface does not.
      const result: unknown = await tx.execute(sql`
        select public.create_invitation(
          ${input.workspaceId}::uuid,
          ${input.inviteeUserId}::uuid
        ) as id
      `);
      const created = (Array.isArray(result)
        ? result
        : (result as { rows?: Array<{ id: string }> }).rows ?? []) as Array<{ id: string }>;
      const id = created[0]?.id;
      if (!id) throw new Error('create_invitation returned no invitation id');

      // Read back the stored truth through RLS (the owner-read policy), so the
      // response reflects what the database recorded. If the row is somehow
      // unreadable the transaction rolls back — an invitation that cannot be
      // verified is not created silently.
      const [row] = await tx
        .select()
        .from(schema.workspaceInvitations)
        .where(eq(schema.workspaceInvitations.id, id))
        .limit(1);
      if (!row) throw new Error('Invitation row is not readable after creation');
      return rowToInvitation(row);
    });
  }

  async acceptInvite(invitationId: string): Promise<{ workspaceId: string }> {
    return this.run(async (tx) => {
      // Reading first gives the invitee a clean not-found signal (P0002) and
      // lets us echo the workspace joined. accept_invitation() remains the sole
      // authority: inside the same transaction it re-checks that the caller is
      // the invitee, that the invitation is not expired, revoked or already
      // accepted, and inserts the workspace_members row itself.
      const [row] = await tx
        .select()
        .from(schema.workspaceInvitations)
        .where(eq(schema.workspaceInvitations.id, invitationId))
        .limit(1);
      if (!row) {
        throw Object.assign(new Error('Invitation not found.'), { code: 'P0002' });
      }
      await tx.execute(sql`select public.accept_invitation(${invitationId}::uuid)`);
      return { workspaceId: row.workspaceId };
    });
  }

  async revokeInvite(invitationId: string): Promise<void> {
    return this.run(async (tx) => {
      // revoke_invitation() verifies the caller owns the workspace at call
      // time and refuses to touch accepted invitations.
      await tx.execute(sql`select public.revoke_invitation(${invitationId}::uuid)`);
    });
  }

  async listMyInvites(): Promise<WorkspaceInvitation[]> {
    return this.run(async (tx) => {
      // Assumed 0008 contract: public.list_my_invitations() returns the
      // current user's still-actionable invitations (not accepted, not
      // revoked, not expired), shaped like workspace_invitations rows.
      const result = await tx.execute(sql`select * from public.list_my_invitations()`);
      const rows = (Array.isArray(result)
        ? result
        : (result as { rows?: Array<Record<string, unknown>> }).rows ?? []) as Array<Record<string, unknown>>;
      return rows.map((r) => ({
        id: String(r.id),
        workspaceId: String(r.workspace_id),
        inviteeUserId: String(r.invitee_user_id),
        invitedBy: String(r.invited_by),
        invitedAt: new Date(String(r.invited_at)).toISOString(),
        expiresAt: new Date(String(r.expires_at)).toISOString(),
        acceptedAt: r.accepted_at ? new Date(String(r.accepted_at)).toISOString() : null,
        acceptedBy: r.accepted_by ? String(r.accepted_by) : null,
        revokedAt: r.revoked_at ? new Date(String(r.revoked_at)).toISOString() : null,
      }));
    });
  }
}

// ── Row mappers ────────────────────────────────────────────────
function rowToUser(r: any): User {
  return { id: r.id, name: r.name, role: r.role, createdAt: r.createdAt.toISOString() };
}

function rowToWorkspace(r: any): WorkspaceRecord {
  return { id: r.id, name: r.name, createdAt: r.createdAt.toISOString() };
}

function rowToWorkspaceMember(r: any): WorkspaceMember {
  return { workspaceId: r.workspaceId, userId: r.userId, role: r.role, createdAt: r.createdAt.toISOString() };
}

function rowToGoal(r: any): Goal {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
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
    workspaceId: r.workspaceId,
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
    workspaceId: r.workspaceId,
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
    workspaceId: r.workspaceId,
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
    workspaceId: r.workspaceId,
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
    workspaceId: r.workspaceId,
    productId: r.productId,
    kind: r.kind,
    reference: r.reference,
    note: r.note,
    recordedBy: r.recordedBy,
    recordedAt: r.recordedAt.toISOString(),
    prevHash: r.prevHash ?? null,
    rowHash: r.rowHash ?? null,
  };
}

function rowToInvitation(r: any): WorkspaceInvitation {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    inviteeUserId: r.inviteeUserId,
    invitedBy: r.invitedBy,
    invitedAt: r.invitedAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    acceptedAt: r.acceptedAt ? r.acceptedAt.toISOString() : null,
    acceptedBy: r.acceptedBy ?? null,
    revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
  };
}
