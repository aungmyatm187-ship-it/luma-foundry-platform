import { Workspace } from './workspace.js';
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

/**
 * In-memory async repository: wraps the existing sync Workspace for a drop-in,
 * Promise-based dev/test repository. This avoids duplicating validation logic.
 */
export class InMemoryRepository implements WorkspaceRepository {
  private ws: Workspace;

  constructor() {
    this.ws = new Workspace();
  }

  createUser(name: string, role: Role): Promise<User> {
    return Promise.resolve(this.ws.createUser(name, role));
  }

  createGoal(input: {
    ownerId: string;
    title: string;
    outcome: string;
    priority?: Priority;
    targetDate?: string | null;
  }): Promise<Goal> {
    return Promise.resolve(this.ws.createGoal(input));
  }

  createProduct(input: { goalId: string; name: string; category: string; route: string }): Promise<Product> {
    return Promise.resolve(this.ws.createProduct(input));
  }

  hasProductForGoal(goalId: string, productId: string): Promise<boolean> {
    return Promise.resolve(
      this.ws.snapshot().products.some((product) => product.id === productId && product.goalId === goalId),
    );
  }

  createWorkItem(input: {
    goalId: string;
    productId?: string | null;
    type: string;
    assignedTo: Role;
    title: string;
    detail: string;
    priority?: Priority;
  }): Promise<WorkItem> {
    return Promise.resolve(this.ws.createWorkItem(input));
  }

  createHandoff(input: {
    goalId: string;
    productId?: string | null;
    fromRole: Role;
    toRole: Role;
    title: string;
    summary: string;
    asks: string;
  }): Promise<Handoff> {
    return Promise.resolve(this.ws.createHandoff(input));
  }

  createDecision(input: {
    goalId: string;
    productId?: string | null;
    title: string;
    context: string;
    decision: string;
    ownerId: string;
  }): Promise<Decision> {
    return Promise.resolve(this.ws.createDecision(input));
  }

  recordEvidence(input: {
    productId: string;
    kind: Evidence['kind'];
    reference: string;
    note: string;
    recordedBy: Role;
  }): Promise<Evidence> {
    return Promise.resolve(this.ws.recordEvidence(input));
  }

  updateProductStatus(productId: string, status: ProductStatus): Promise<Product> {
    return Promise.resolve(this.ws.updateProductStatus(productId, status));
  }

  updateWorkItemStatus(workItemId: string, status: WorkItemStatus): Promise<WorkItem> {
    return Promise.resolve(this.ws.updateWorkItemStatus(workItemId, status));
  }

  updateDecisionStatus(decisionId: string, status: DecisionStatus, decidedBy: Role | null): Promise<Decision> {
    return Promise.resolve(this.ws.updateDecisionStatus(decisionId, status, decidedBy));
  }

  updateHandoffStatus(handoffId: string, status: HandoffStatus): Promise<Handoff> {
    return Promise.resolve(this.ws.updateHandoffStatus(handoffId, status));
  }

  snapshot(): Promise<Snapshot> {
    return Promise.resolve(this.ws.snapshot());
  }

  evidenceFor(productId: string): Promise<Evidence[]> {
    return Promise.resolve(this.ws.evidenceFor(productId));
  }
}
