/**
 * In-memory workspace store.
 *
 * Deliberately storage-agnostic: the domain and governance layers never touch a
 * database. Swap this for a Drizzle/Postgres repository later without changing
 * the rules. All writes go through the same validation.
 */
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
} from './types.js';

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString().padStart(4, '0')}`;
}

function now(): string {
  return new Date().toISOString();
}

export class Workspace {
  private users: User[] = [];
  private goals: Goal[] = [];
  private products: Product[] = [];
  private workItems: WorkItem[] = [];
  private handoffs: Handoff[] = [];
  private decisions: Decision[] = [];
  private evidence: Evidence[] = [];

  createUser(name: string, role: Role): User {
    const user: User = { id: id('usr'), name, role, createdAt: now() };
    this.users.push(user);
    return user;
  }

  createGoal(input: {
    ownerId: string;
    title: string;
    outcome: string;
    priority?: Priority;
    targetDate?: string | null;
  }): Goal {
    if (!this.users.some((u) => u.id === input.ownerId)) {
      throw new Error(`Unknown owner: ${input.ownerId}`);
    }
    const goal: Goal = {
      id: id('goal'),
      ownerId: input.ownerId,
      title: input.title,
      outcome: input.outcome,
      priority: input.priority ?? 'medium',
      targetDate: input.targetDate ?? null,
      createdAt: now(),
      updatedAt: now(),
    };
    this.goals.push(goal);
    return goal;
  }

  createProduct(input: {
    goalId: string;
    name: string;
    category: string;
    route: string;
  }): Product {
    this.requireGoal(input.goalId);
    const product: Product = {
      id: id('prd'),
      goalId: input.goalId,
      name: input.name,
      category: input.category,
      route: input.route,
      status: 'concept',
      createdAt: now(),
      updatedAt: now(),
    };
    this.products.push(product);
    return product;
  }

  createWorkItem(input: {
    goalId: string;
    productId?: string | null;
    type: string;
    assignedTo: Role;
    title: string;
    detail: string;
    priority?: Priority;
  }): WorkItem {
    this.requireGoal(input.goalId);
    if (input.productId) this.requireProduct(input.productId);
    const item: WorkItem = {
      id: id('wi'),
      goalId: input.goalId,
      productId: input.productId ?? null,
      type: input.type,
      assignedTo: input.assignedTo,
      title: input.title,
      detail: input.detail,
      priority: input.priority ?? 'medium',
      status: 'todo',
      createdAt: now(),
      updatedAt: now(),
    };
    this.workItems.push(item);
    return item;
  }

  createHandoff(input: {
    goalId: string;
    productId?: string | null;
    fromRole: Role;
    toRole: Role;
    title: string;
    summary: string;
    asks: string;
  }): Handoff {
    this.requireGoal(input.goalId);
    if (input.productId) this.requireProduct(input.productId);
    const handoff: Handoff = {
      id: id('hof'),
      goalId: input.goalId,
      productId: input.productId ?? null,
      fromRole: input.fromRole,
      toRole: input.toRole,
      title: input.title,
      summary: input.summary,
      asks: input.asks,
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
    };
    this.handoffs.push(handoff);
    return handoff;
  }

  createDecision(input: {
    goalId: string;
    productId?: string | null;
    title: string;
    context: string;
    decision: string;
    ownerId: string;
  }): Decision {
    this.requireGoal(input.goalId);
    if (input.productId) this.requireProduct(input.productId);
    const decision: Decision = {
      id: id('dec'),
      goalId: input.goalId,
      productId: input.productId ?? null,
      title: input.title,
      context: input.context,
      decision: input.decision,
      status: 'open',
      ownerId: input.ownerId,
      createdAt: now(),
      resolvedAt: null,
    };
    this.decisions.push(decision);
    return decision;
  }

  recordEvidence(input: {
    productId: string;
    kind: Evidence['kind'];
    reference: string;
    note: string;
    recordedBy: Role;
  }): Evidence {
    this.requireProduct(input.productId);
    const record: Evidence = {
      id: id('ev'),
      productId: input.productId,
      kind: input.kind,
      reference: input.reference,
      note: input.note,
      recordedBy: input.recordedBy,
      recordedAt: now(),
    };
    this.evidence.push(record);
    return record;
  }

  /** Status changes are guarded — clearing a product requires full evidence. */
  updateProductStatus(productId: string, status: ProductStatus): Product {
    const product = this.requireProduct(productId);
    assertTransitionAllowed(product, status, this.evidence);
    product.status = status;
    product.updatedAt = now();
    return product;
  }

  updateWorkItemStatus(workItemId: string, status: WorkItemStatus): WorkItem {
    const item = this.workItems.find((w) => w.id === workItemId);
    if (!item) throw new Error(`Unknown work item: ${workItemId}`);
    item.status = status;
    item.updatedAt = now();
    return item;
  }

  updateDecisionStatus(decisionId: string, status: DecisionStatus): Decision {
    const decision = this.decisions.find((d) => d.id === decisionId);
    if (!decision) throw new Error(`Unknown decision: ${decisionId}`);
    decision.status = status;
    decision.resolvedAt = status === 'open' || status === 'deferred' ? null : now();
    return decision;
  }

  updateHandoffStatus(handoffId: string, status: HandoffStatus): Handoff {
    const handoff = this.handoffs.find((h) => h.id === handoffId);
    if (!handoff) throw new Error(`Unknown handoff: ${handoffId}`);
    handoff.status = status;
    handoff.updatedAt = now();
    return handoff;
  }

  snapshot(): Snapshot {
    return {
      users: [...this.users],
      goals: [...this.goals],
      products: [...this.products],
      workItems: [...this.workItems],
      handoffs: [...this.handoffs],
      decisions: [...this.decisions],
      evidence: [...this.evidence],
      takenAt: now(),
    };
  }

  evidenceFor(productId: string): Evidence[] {
    return this.evidence.filter((e) => e.productId === productId);
  }

  private requireGoal(goalId: string): Goal {
    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) throw new Error(`Unknown goal: ${goalId}`);
    return goal;
  }

  private requireProduct(productId: string): Product {
    const product = this.products.find((p) => p.id === productId);
    if (!product) throw new Error(`Unknown product: ${productId}`);
    return product;
  }
}
