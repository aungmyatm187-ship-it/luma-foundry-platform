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
}
