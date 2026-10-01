/**
 * Governance rules.
 *
 * These encode the review discipline the two operators were already applying by
 * hand. The central rule: a product may not be marked `cleared` unless every
 * required evidence kind is present AND a qualified counsel review is recorded.
 *
 * Technical traceability (a source commit, a passing build, a live URL) is never
 * sufficient on its own. It proves the artefact exists, not that it may be sold.
 */
import type { Evidence, EvidenceKind, Product, ProductStatus } from './types.js';

/**
 * Evidence required before a product can be commercially cleared.
 * Derived from the Axiom Grid evidence register.
 */
export const REQUIRED_EVIDENCE: readonly EvidenceKind[] = [
  'source_commit',
  'design_history',
  'asset_licence',
  'contributor_rights',
  'dependency_sbom',
  'third_party_notices',
  'counsel_review',
  'buyer_terms',
] as const;

/** Evidence that is traceability only and can never imply clearance. */
export const TRACEABILITY_ONLY: readonly EvidenceKind[] = [
  'source_commit',
  'dependency_sbom',
] as const;

export interface ClearanceReport {
  productId: string;
  status: ProductStatus;
  /** True only when every required evidence kind is present. */
  clearable: boolean;
  present: EvidenceKind[];
  missing: EvidenceKind[];
  /** Evidence supplied that is traceability-only. */
  traceabilityOnly: EvidenceKind[];
  /** Human-readable reasons a product is not clearable. */
  blockers: string[];
}

function uniq<T>(xs: readonly T[]): T[] {
  return [...new Set(xs)];
}

/**
 * Evaluate whether a product has the evidence needed to be called cleared.
 * Pure function — no I/O, so it is safe to call from any surface (MCP, API, CI).
 */
export function evaluateClearance(
  product: Pick<Product, 'id' | 'status'>,
  evidence: readonly Evidence[],
): ClearanceReport {
  const forProduct = evidence.filter((e) => e.productId === product.id);
  const present = uniq(forProduct.map((e) => e.kind));
  const missing = REQUIRED_EVIDENCE.filter((k) => !present.includes(k));
  const traceabilityOnly = present.filter((k) =>
    (TRACEABILITY_ONLY as readonly EvidenceKind[]).includes(k),
  );

  const blockers = missing.map((k) => `Missing required evidence: ${k}`);
  if (present.length > 0 && present.length === traceabilityOnly.length) {
    blockers.push(
      'Only traceability evidence supplied (source commit / SBOM). ' +
        'Traceability never proves ownership, licence, or commercial permission.',
    );
  }

  return {
    productId: product.id,
    status: product.status,
    clearable: missing.length === 0,
    present,
    missing,
    traceabilityOnly,
    blockers,
  };
}

export class GovernanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GovernanceError';
  }
}

/**
 * Guard a status transition. Throws when a caller tries to clear a product that
 * has not earned it. Every surface must go through this — it is the single place
 * where the "no clearance without evidence" rule is enforced.
 */
export function assertTransitionAllowed(
  product: Pick<Product, 'id' | 'status'>,
  next: ProductStatus,
  evidence: readonly Evidence[],
): void {
  if (next !== 'cleared') return;

  const report = evaluateClearance(product, evidence);
  if (!report.clearable) {
    throw new GovernanceError(
      `Product ${product.id} cannot be marked 'cleared'. ${report.blockers.join(' ')}`,
    );
  }
}
