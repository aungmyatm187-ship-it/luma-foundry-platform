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
  WorkspaceInvitation,
} from './types.js';

/**
 * Storage-agnostic repository interface for the Workspace domain layer.
 * Implementations must return domain types and must NOT expose DB/Drizzle types.
 */
export interface WorkspaceRepository {
  /**
   * The authenticated user for this session, or null when no users row can be
   * resolved (unprovisioned identity, or an in-memory store with no session).
   *
   * This is the single trusted source of actor identity. Role is read from
   * users.role, never from the JWT or from client input, so a caller can
   * describe a role but cannot claim one.
   */
  getCurrentUser(): Promise<User | null>;
  createUser(name: string, role: Role): Promise<User>;
  createGoal(input: {
    workspaceId: string;
    ownerId: string;
    title: string;
    outcome: string;
    priority?: Priority;
    targetDate?: string | null;
  }): Promise<Goal>;
  createProduct(input: {
    goalId: string;
    name: string;
    category: string;
    route: string;
  }): Promise<Product>;
  hasProductForGoal(goalId: string, productId: string): Promise<boolean>;
  createWorkItem(input: {
    goalId: string;
    productId?: string | null;
    type: string;
    assignedTo: Role;
    title: string;
    detail: string;
    priority?: Priority;
  }): Promise<WorkItem>;
  createHandoff(input: {
    goalId: string;
    productId?: string | null;
    fromRole: Role;
    toRole: Role;
    title: string;
    summary: string;
    asks: string;
  }): Promise<Handoff>;
  createDecision(input: {
    goalId: string;
    productId?: string | null;
    title: string;
    context: string;
    decision: string;
    ownerId: string;
  }): Promise<Decision>;
  recordEvidence(input: {
    productId: string;
    kind: Evidence['kind'];
    reference: string;
    note: string;
    recordedBy: Role;
  }): Promise<Evidence>;
  updateProductStatus(productId: string, status: ProductStatus): Promise<Product>;
  updateWorkItemStatus(workItemId: string, status: WorkItemStatus): Promise<WorkItem>;
  updateDecisionStatus(
    decisionId: string,
    status: DecisionStatus,
    decidedBy: Role | null,
  ): Promise<Decision>;
  updateHandoffStatus(handoffId: string, status: HandoffStatus): Promise<Handoff>;
  snapshot(): Promise<Snapshot>;
  evidenceFor(productId: string): Promise<Evidence[]>;

  // ── Invitations (migration 0008) ─────────────────────────────
  /**
   * Membership is consent-based: there is deliberately no method on this
   * interface that inserts workspace_members. All four operations delegate to
   * the SECURITY DEFINER database functions, which are the single authority
   * for who may invite (workspace owner), who may accept (the invitee, before
   * expiry, once), and what happens on duplicate invites (revoke + replace).
   */

  /**
   * Owner issues an invitation. The database function verifies the caller
   * owns the workspace and rejects users who are already members. Seven-day
   * expiry is applied inside the function; it is never a client argument.
   */
  inviteUser(input: { workspaceId: string; inviteeUserId: string }): Promise<WorkspaceInvitation>;

  /**
   * Invitee accepts. The database function re-checks identity, expiry,
   * revocation and single-use inside the same transaction and creates the
   * membership row itself. Returns the workspace that was joined.
   */
  acceptInvite(invitationId: string): Promise<{ workspaceId: string }>;

  /**
   * Workspace owner revokes an outstanding invitation. The database function
   * verifies the caller owns the workspace at call time.
   */
  revokeInvite(invitationId: string): Promise<void>;

  /**
   * Invitations addressed to the current user that are still actionable:
   * not accepted, not revoked, not expired. Backed by list_my_invitations().
   */
  listMyInvites(): Promise<WorkspaceInvitation[]>;
}
