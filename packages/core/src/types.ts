/**
 * Luma Foundry domain types.
 *
 * The model mirrors the shipped `/workspace` collaboration app:
 *   Goal -> Product -> Work Item -> Handoff -> Decision
 *
 * Governance vocabulary (statuses, evidence kinds, roles) is taken from the
 * Operator A / Operator B review record so the platform encodes the same rules
 * the operators were already following by hand.
 */

/** Lifecycle of a product. `cleared` is gated — see governance.ts. */
export const PRODUCT_STATUSES = [
  'concept',
  'in_build',
  'in_review',
  'conditional',
  'cleared',
  'blocked',
] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

/**
 * Evidence a product must supply before it can be called commercially cleared.
 * A source commit alone is traceability, never proof of ownership.
 */
export const EVIDENCE_KINDS = [
  'source_commit',
  'design_history',
  'asset_licence',
  'contributor_rights',
  'dependency_sbom',
  'third_party_notices',
  'counsel_review',
  'buyer_terms',
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const WORK_ITEM_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const DECISION_STATUSES = ['open', 'approved', 'declined', 'deferred'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const HANDOFF_STATUSES = ['draft', 'sent', 'accepted', 'returned'] as const;
export type HandoffStatus = (typeof HANDOFF_STATUSES)[number];

export const PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * The two-operator model. Operator A builds; Operator B reviews and gates.
 * Operator B never edits product code — evidence and data handoff only.
 * `pending` is for new signups before they are assigned an operator role.
 */
export const ROLES = ['owner', 'operator_a', 'operator_b', 'pending'] as const;
export type Role = (typeof ROLES)[number];

export const WORKSPACE_ROLES = ['owner', 'member'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export interface User {
  id: string;
  name: string;
  role: Role;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
}

/**
 * One membership invitation (migration 0008). Rows are created, accepted and
 * revoked exclusively by the SECURITY DEFINER database functions
 * create_invitation / accept_invitation / revoke_invitation — never by an API
 * insert — so the shape below is a read model of database-owned state.
 *
 * Seven-day expiry is database policy, not a client argument: expiresAt is
 * computed inside create_invitation, which also revokes any outstanding
 * invitation for the same invitee when a replacement is issued.
 */
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  /** The public.users id this invitation was issued to. */
  inviteeUserId: string;
  /** The public.users id of the workspace owner who issued it. */
  invitedBy: string;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedBy: string | null;
  revokedAt: string | null;
}

export interface Goal {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  outcome: string;
  priority: Priority;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  workspaceId: string;
  goalId: string;
  name: string;
  category: string;
  /** Public route, e.g. `/axiom-grid`. */
  route: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  workspaceId: string;
  goalId: string;
  productId: string | null;
  type: string;
  assignedTo: Role;
  title: string;
  detail: string;
  priority: Priority;
  status: WorkItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Handoff {
  id: string;
  workspaceId: string;
  goalId: string;
  productId: string | null;
  fromRole: Role;
  toRole: Role;
  title: string;
  summary: string;
  asks: string;
  status: HandoffStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  workspaceId: string;
  goalId: string;
  productId: string | null;
  title: string;
  context: string;
  decision: string;
  status: DecisionStatus;
  ownerId: string;
  decidedBy: Role | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** One piece of release evidence attached to a product. */
export interface Evidence {
  id: string;
  workspaceId: string;
  productId: string;
  kind: EvidenceKind;
  /** Where the evidence lives (URL, commit, file reference). */
  reference: string;
  note: string;
  recordedBy: Role;
  recordedAt: string;
  prevHash: string | null;
  rowHash: string | null;
}

/** Everything a workspace holds. */
export interface Snapshot {
  users: User[];
  workspaces: WorkspaceRecord[];
  workspaceMembers: WorkspaceMember[];
  goals: Goal[];
  products: Product[];
  workItems: WorkItem[];
  handoffs: Handoff[];
  decisions: Decision[];
  evidence: Evidence[];
  takenAt: string;
}
