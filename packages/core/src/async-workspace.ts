import { assertTransitionAllowed, resolveRecordedRole } from './governance.js';
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
import type { WorkspaceRepository } from './repository.js';
import { InMemoryRepository } from './inmemory-repository.js';
import { DrizzleRepository } from './drizzle-repository.js';
import type { Workspace } from './workspace.js';

/**
 * AsyncWorkspace delegates persistence to a WorkspaceRepository but retains
 * the domain rule enforcement (assertTransitionAllowed, role resolution).
 */
export class AsyncWorkspace {
  private cachedActor: User | null | undefined;

  constructor(private repo: WorkspaceRepository) {}

  static fromInMemory(ws?: Workspace, actor?: User | null): AsyncWorkspace {
    return new AsyncWorkspace(new InMemoryRepository(ws, actor ?? null));
  }

  static fromDrizzle(authUserId: string): AsyncWorkspace {
    return new AsyncWorkspace(new DrizzleRepository(authUserId));
  }

  /**
   * The server-derived session actor, or null when the workspace is unbound
   * (in-memory standalone use such as tests and the stdio MCP client). Cached:
   * the actor cannot change within a request.
   */
  async currentUser(): Promise<User | null> {
    if (this.cachedActor === undefined) {
      this.cachedActor = await this.repo.currentUser();
    }
    return this.cachedActor;
  }

  /**
   * Resolve the role to record for a write against the session actor.
   * When unbound, the caller-supplied label is kept so standalone behaviour is
   * unchanged; when bound, the server role is authoritative.
   */
  private async attributedRole(claimed?: Role): Promise<Role | undefined> {
    const actor = await this.currentUser();
    if (!actor) return claimed;
    return resolveRecordedRole(actor.role, claimed);
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

  // Users
  async createUser(name: string, role: Role): Promise<User> {
    return this.repo.createUser(name, role);
  }

  // Goals
  async createGoal(input: {
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
    const assignedTo = (await this.attributedRole(input.assignedTo)) ?? input.assignedTo;
    return this.repo.createWorkItem({ ...input, assignedTo });
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
    const fromRole = (await this.attributedRole(input.fromRole)) ?? input.fromRole;
    return this.repo.createHandoff({ ...input, fromRole });
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
    const recordedBy = (await this.attributedRole(input.recordedBy)) ?? input.recordedBy;
    return this.repo.recordEvidence({ ...input, recordedBy });
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
    const resolved = (await this.attributedRole(decidedBy ?? undefined)) ?? null;
    return this.repo.updateDecisionStatus(decisionId, status, resolved);
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
}
