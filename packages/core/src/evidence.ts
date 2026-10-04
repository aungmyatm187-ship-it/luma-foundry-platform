/**
 * The single source of truth for how release evidence is produced.
 *
 * The clearance gate (governance.ts) requires eight evidence kinds. They do
 * NOT all come from the same place, and confusing the two sources is the one
 * mistake that would let the platform claim clearance it has not earned.
 *
 *   - Machine kinds are deterministically generatable from the recovered
 *     source and catalogue. They prove an artefact *exists* and that its code
 *     dependencies are resale-safe. They are necessary but never sufficient.
 *   - Human kinds must be recorded by a person: the owner (or their counsel /
 *     contributors). They prove ownership, licence, and permission to sell.
 *     These are the only kinds that can actually justify clearance.
 *
 * This split is an invariant, not a comment: the test suite asserts that
 * MACHINE_KINDS and HUMAN_KINDS exactly partition REQUIRED_EVIDENCE, so a new
 * evidence kind cannot be added without deciding who produces it.
 */
import { EVIDENCE_KINDS, type EvidenceKind } from './types.js';
import { REQUIRED_EVIDENCE } from './governance.js';

/** Evidence kinds a machine can generate without human judgement. */
export const MACHINE_EVIDENCE_KINDS: readonly EvidenceKind[] = [
  'source_commit',
  'dependency_sbom',
  'third_party_notices',
  'buyer_terms',
] as const;

/** Evidence kinds that only a human can record. */
export const HUMAN_EVIDENCE_KINDS: readonly EvidenceKind[] = [
  'design_history',
  'asset_licence',
  'contributor_rights',
  'counsel_review',
] as const;

/** A product cannot be cleared on machine evidence alone. */
export function isMachineKind(kind: EvidenceKind): boolean {
  return (MACHINE_EVIDENCE_KINDS as readonly EvidenceKind[]).includes(kind);
}

/** A product cannot be cleared until every human kind is recorded. */
export function isHumanKind(kind: EvidenceKind): boolean {
  return (HUMAN_EVIDENCE_KINDS as readonly EvidenceKind[]).includes(kind);
}

/**
 * Verify the split partitions the required evidence. Pure and side-effect-free;
 * used both by tests and as a runtime safety net.
 */
export function assertEvidencePartition(): void {
  const required = [...REQUIRED_EVIDENCE];
  const machine = [...MACHINE_EVIDENCE_KINDS];
  const human = [...HUMAN_EVIDENCE_KINDS];

  const combined = [...machine, ...human].sort();
  const expected = [...required].sort();
  if (combined.length !== expected.length || combined.some((k, i) => k !== expected[i])) {
    throw new Error('Evidence partition does not match REQUIRED_EVIDENCE');
  }
  if (machine.some((k) => human.includes(k))) {
    throw new Error('Evidence kind classified as both machine and human');
  }
  if (EVIDENCE_KINDS.length !== required.length) {
    throw new Error('EVIDENCE_KINDS and REQUIRED_EVIDENCE disagree');
  }
}
