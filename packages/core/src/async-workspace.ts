import { assertTransitionAllowed } from './governance.js';
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
import type { WorkspaceRepository } from './repository.js';
import { InMemoryRepository } from './inmemory-repository.js';
import { DrizzleRepository } from './drizzle-repository.js';

/**
 * AsyncWorkspace delegates persistence to a WorkspaceRepository but retains
 * the domain rule enforcement (assertTransitionAllowed).
 */
export class AsyncWorkspace {
  constructor(private repo: WorkspaceRepository) {}

  static fromInMemory(): AsyncWorkspace {
    return new AsyncWorkspace(new InMemoryRepository());
  }

  static fromDrizzle(authUserId: string): AsyncWorkspace {
    return new AsyncWorkspace(new DrizzleRepository(authUserId));
  }

  private async assertProductBelongsToGoal(
    goalId: string,
    productId: string | null | undefined,
  ): Promise<void> {
    if (!productId) return;
    if (!(await this.repo.hasProductForGoal(goalId, productId))) {
      throw new Error('That product does not belong to the selected goal.');
    }
  }

  // Session identity
  /**
   * Pass-through on purpose: AsyncWorkspace does not interpret the role. The
   * API edge builds its actor from this call and enforces role policy there.
   */
  async getCurrentUser(): Promise<User | null> {
    return this.repo.getCurrentUser();
  }

  // Users
  async createUser(name: string, role: Role): Promise<User> {
    return this.repo.createUser(name, role);
  }

  // Goals
  async createGoal(input: {
    workspaceId: string;
    ownerId: string;
    title: string;
    outcome: string;
    priority?: Priority;
    targetDate?: string | null;
  }): Promise<Goal> {
    return this.repo.createGoal(input);
  }

  // Products
  async createProduct(input: { goalId: string; name: string; category: string; route: string }): Promise<Product> {
    return this.repo.createProduct(input);
  }

  // Work items
  async createWorkItem(input: {
    goalId: string;
    productId?: string | null;
    type: string;
    assignedTo: Role;
    title: string;
    detail: string;
    priority?: Priority;
  }): Promise<WorkItem> {
    await this.assertProductBelongsToGoal(input.goalId, input.productId);
    return this.repo.createWorkItem(input);
  }

  // Handoffs
  async createHandoff(input: {
    goalId: string;
    productId?: string | null;
    fromRole: Role;
    toRole: Role;
    title: string;
    summary: string;
    asks: string;
  }): Promise<Handoff> {
    await this.assertProductBelongsToGoal(input.goalId, input.productId);
    return this.repo.createHandoff(input);
  }

  // Decisions
  async createDecision(input: {
    goalId: string;
    productId?: string | null;
    title: string;
    context: string;
    decision: string;
    ownerId: string;
  }): Promise<Decision> {
    await this.assertProductBelongsToGoal(input.goalId, input.productId);
    return this.repo.createDecision(input);
  }

  // Evidence
  async recordEvidence(input: {
    productId: string;
    kind: Evidence['kind'];
    reference: string;
    note: string;
    recordedBy: Role;
  }): Promise<Evidence> {
    return this.repo.recordEvidence(input);
  }

  // Status updates
  async updateProductStatus(productId: string, status: ProductStatus): Promise<Product> {
    const snap = await this.repo.snapshot();
    const product = snap.products.find((p) => p.id === productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);

    const evidence = await this.repo.evidenceFor(productId);
    assertTransitionAllowed({ id: product.id, status: product.status }, status, evidence);

    return this.repo.updateProductStatus(productId, status);
  }

  async updateWorkItemStatus(workItemId: string, status: WorkItemStatus): Promise<WorkItem> {
    return this.repo.updateWorkItemStatus(workItemId, status);
  }

  async updateDecisionStatus(
    decisionId: string,
    status: DecisionStatus,
    decidedBy: Role | null,
  ): Promise<Decision> {
    return this.repo.updateDecisionStatus(decisionId, status, decidedBy);
  }

  async updateHandoffStatus(handoffId: string, status: HandoffStatus): Promise<Handoff> {
    return this.repo.updateHandoffStatus(handoffId, status);
  }

  // Reads
  async snapshot(): Promise<Snapshot> {
    return this.repo.snapshot();
  }

  async evidenceFor(productId: string): Promise<Evidence[]> {
    return this.repo.evidenceFor(productId);
  }

  // Invitations (migration 0008)
  /**
   * Pure pass-throughs on purpose, like getCurrentUser: the authorization
   * rules for membership (owner-only invite, invitee-only accept, expiry,
   * single-use, revoke-and-replace) live inside the SECURITY DEFINER database
   * functions, which are the single authority. AsyncWorkspace neither repeats
   * nor weakens them — and offers no method that inserts workspace_members.
   */
  async inviteUser(input: { workspaceId: string; inviteeUserId: string }): Promise<WorkspaceInvitation> {
    return this.repo.inviteUser(input);
  }

  async acceptInvite(invitationId: string): Promise<{ workspaceId: string }> {
    return this.repo.acceptInvite(invitationId);
  }

  async revokeInvite(invitationId: string): Promise<void> {
    return this.repo.revokeInvite(invitationId);
  }

  async listMyInvites(): Promise<WorkspaceInvitation[]> {
    return this.repo.listMyInvites();
  }
}
