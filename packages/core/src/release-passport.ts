import { EVIDENCE_CATEGORIES, isMachineKind } from './evidence.js';
import { evaluateClearance, REQUIRED_EVIDENCE } from './governance.js';
import type { ClearanceReport } from './governance.js';
import type { Evidence, EvidenceKind, Product, Role } from './types.js';

/** Stable identifier for the portable release-evidence document. */
export const RELEASE_PASSPORT_FORMAT = 'luma.release-evidence-passport' as const;
export const RELEASE_PASSPORT_VERSION = 1 as const;

export interface ReleasePassportEvidence {
  id: string;
  kind: EvidenceKind;
  category: (typeof EVIDENCE_CATEGORIES)[EvidenceKind];
  producer: 'machine' | 'human';
  recordedBy: Role;
  recordedAt: string;
  /** Omitted by default because references can disclose private systems or documents. */
  reference?: string;
}

export interface ReleaseEvidencePassport {
  format: typeof RELEASE_PASSPORT_FORMAT;
  version: typeof RELEASE_PASSPORT_VERSION;
  generatedAt: string;
  product: Pick<Product, 'id' | 'name' | 'category' | 'route' | 'status'>;
  requiredEvidence: EvidenceKind[];
  clearance: ClearanceReport;
  evidence: ReleasePassportEvidence[];
  assurance: {
    cryptographicallySigned: false;
    referencesVerified: false;
    recorderIdentityVerified: false;
    ownerApprovalVerified: false;
    legalOpinion: false;
    notice: string;
  };
}

export interface ReleasePassportOptions {
  /** Caller-supplied timestamp keeps output reproducible in tests and pipelines. */
  generatedAt: string;
  /** Include evidence locations only when the caller intends an internal export. */
  includeReferences?: boolean;
}

/**
 * Build a portable, machine-readable summary of a product's recorded release evidence.
 * This is a snapshot, not a signature, legal opinion, reference verifier, or new
 * clearance rule. The existing governance evaluator remains authoritative.
 */
export function createReleaseEvidencePassport(
  product: Pick<Product, 'id' | 'name' | 'category' | 'route' | 'status'>,
  evidence: readonly Evidence[],
  options: ReleasePassportOptions,
): ReleaseEvidencePassport {
  const timestamp = new Date(options.generatedAt);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== options.generatedAt) {
    throw new Error('generatedAt must be a valid ISO timestamp');
  }

  const productEvidence = evidence
    .filter((item) => item.productId === product.id)
    .slice()
    .sort((a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.recordedAt.localeCompare(b.recordedAt) ||
      a.id.localeCompare(b.id),
    );
  const clearance = evaluateClearance(product, productEvidence);

  return {
    format: RELEASE_PASSPORT_FORMAT,
    version: RELEASE_PASSPORT_VERSION,
    generatedAt: options.generatedAt,
    product: {
      id: product.id,
      name: product.name,
      category: product.category,
      route: product.route,
      status: product.status,
    },
    requiredEvidence: [...REQUIRED_EVIDENCE],
    clearance: {
      ...clearance,
      present: [...clearance.present].sort(),
      missing: [...clearance.missing],
      traceabilityOnly: [...clearance.traceabilityOnly].sort(),
      blockers: [...clearance.blockers],
    },
    evidence: productEvidence.map((item) => ({
      id: item.id,
      kind: item.kind,
      category: EVIDENCE_CATEGORIES[item.kind],
      producer: isMachineKind(item.kind) ? 'machine' : 'human',
      recordedBy: item.recordedBy,
      recordedAt: item.recordedAt,
      ...(options.includeReferences ? { reference: item.reference } : {}),
    })),
    assurance: {
      cryptographicallySigned: false,
      referencesVerified: false,
      recorderIdentityVerified: false,
      ownerApprovalVerified: false,
      legalOpinion: false,
      notice:
        'Structured evidence snapshot only. Recorder roles and owner approval are not verified here, evidence references have not been independently verified, and this document is not a cryptographic attestation or legal opinion.',
    },
  };
}
