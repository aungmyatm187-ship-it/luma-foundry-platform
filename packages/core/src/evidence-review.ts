import { HUMAN_EVIDENCE_KINDS, MACHINE_EVIDENCE_KINDS } from './evidence.js';
import { evaluateClearance, REQUIRED_EVIDENCE } from './governance.js';
import type { Evidence, EvidenceKind, Product, ProductStatus } from './types.js';

export interface EvidenceReviewItem {
  readonly kind: EvidenceKind;
  /** Expected producer for this kind; this does not verify who actually supplied it. */
  readonly expectedProducer: 'human' | 'machine';
  readonly state: 'recorded' | 'missing';
  /** Evidence records currently returned by the repository, newest timestamp first. */
  readonly history: readonly Readonly<Evidence>[];
  /** Set only when one record has a uniquely newest timestamp. */
  readonly latest: Readonly<Evidence> | null;
  /** True when multiple records share the newest timestamp, so order is ambiguous. */
  readonly latestAmbiguous: boolean;
}

export interface EvidenceReviewPacket {
  readonly productId: string;
  readonly status: ProductStatus;
  /** All required evidence kinds have a stored record; this is not clearance authorization. */
  readonly requiredRecordsComplete: boolean;
  readonly ownerApproval: 'not_checked';
  readonly legalSufficiency: 'not_assessed';
  readonly recorderIdentity: 'not_verified';
  /** Coverage counts distinct requirement kinds, not duplicate records or evidence quality. */
  readonly coverage: Readonly<{
    recordedKinds: number;
    requiredKinds: number;
    percent: number;
    recordedHumanKinds: number;
    requiredHumanKinds: number;
    recordedMachineKinds: number;
    requiredMachineKinds: number;
  }>;
  readonly items: readonly EvidenceReviewItem[];
  readonly traceabilityOnly: readonly EvidenceKind[];
  readonly blockers: readonly string[];
  readonly caveat: string;
}

function timestampValue(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/**
 * Build an immutable, read-only view of records currently returned by the evidence
 * repository. It reports requirement coverage, not verified provenance, approval,
 * evidence validity, or legal sufficiency.
 */
export function buildEvidenceReviewPacket(
  product: Pick<Product, 'id' | 'status'>,
  evidence: readonly Evidence[],
): EvidenceReviewPacket {
  const clearance = evaluateClearance(product, evidence);
  const forProduct = evidence.filter((entry) => entry.productId === product.id);
  const items = REQUIRED_EVIDENCE.map((kind): EvidenceReviewItem => {
    const ordered = forProduct
      .filter((entry) => entry.kind === kind)
      .slice()
      .sort((a, b) => timestampValue(b.recordedAt) - timestampValue(a.recordedAt));
    const newestTime = ordered[0] ? timestampValue(ordered[0].recordedAt) : null;
    const newestCount = newestTime === null
      ? 0
      : ordered.filter((entry) => timestampValue(entry.recordedAt) === newestTime).length;
    const history = Object.freeze(ordered.map((entry) => Object.freeze({ ...entry })));
    const expectedProducer = (HUMAN_EVIDENCE_KINDS as readonly EvidenceKind[]).includes(kind)
      ? 'human'
      : 'machine';

    return Object.freeze({
      kind,
      expectedProducer,
      state: history.length ? 'recorded' : 'missing',
      history,
      latest: newestCount === 1 ? history[0] ?? null : null,
      latestAmbiguous: newestCount > 1,
    });
  });
  const recordedHumanKinds = items.filter(
    (item) => item.expectedProducer === 'human' && item.state === 'recorded',
  ).length;
  const recordedMachineKinds = items.filter(
    (item) => item.expectedProducer === 'machine' && item.state === 'recorded',
  ).length;
  const recordedKinds = recordedHumanKinds + recordedMachineKinds;

  return Object.freeze({
    productId: product.id,
    status: product.status,
    requiredRecordsComplete: clearance.clearable,
    ownerApproval: 'not_checked',
    legalSufficiency: 'not_assessed',
    recorderIdentity: 'not_verified',
    coverage: Object.freeze({
      recordedKinds,
      requiredKinds: REQUIRED_EVIDENCE.length,
      percent: Math.round((recordedKinds / REQUIRED_EVIDENCE.length) * 100),
      recordedHumanKinds,
      requiredHumanKinds: HUMAN_EVIDENCE_KINDS.length,
      recordedMachineKinds,
      requiredMachineKinds: MACHINE_EVIDENCE_KINDS.length,
    }),
    items: Object.freeze(items),
    traceabilityOnly: Object.freeze([...clearance.traceabilityOnly]),
    blockers: Object.freeze([...clearance.blockers]),
    caveat:
      'This packet lists records currently returned by the repository. Expected producer classes and stored recorder-role labels are not independently authenticated. Coverage only reflects required record-kind presence; it does not check owner approval or validate reference truth, scope, provenance, or legal sufficiency.',
  });
}
