import { describe, expect, it } from 'vitest';
import { EVIDENCE_KINDS } from '../src/types.js';
import { REQUIRED_EVIDENCE } from '../src/governance.js';
import {
  HUMAN_EVIDENCE_KINDS,
  MACHINE_EVIDENCE_KINDS,
  assertEvidencePartition,
  isHumanKind,
  isMachineKind,
} from '../src/evidence.js';

describe('evidence partition', () => {
  it('machine + human exactly partition the required evidence', () => {
    expect(assertEvidencePartition).not.toThrow();
  });

  it('has no overlap between machine and human kinds', () => {
    const overlap = MACHINE_EVIDENCE_KINDS.filter((k) =>
      (HUMAN_EVIDENCE_KINDS as readonly string[]).includes(k),
    );
    expect(overlap).toEqual([]);
  });

  it('covers all evidence kinds', () => {
    const covered = new Set([...MACHINE_EVIDENCE_KINDS, ...HUMAN_EVIDENCE_KINDS]);
    expect(EVIDENCE_KINDS.length).toBe(REQUIRED_EVIDENCE.length);
    for (const kind of EVIDENCE_KINDS) {
      expect(covered.has(kind), `kind not classified: ${kind}`).toBe(true);
    }
  });

  it('classifies each kind consistently', () => {
    expect(isMachineKind('source_commit')).toBe(true);
    expect(isMachineKind('dependency_sbom')).toBe(true);
    expect(isMachineKind('third_party_notices')).toBe(true);
    expect(isMachineKind('buyer_terms')).toBe(true);

    expect(isHumanKind('design_history')).toBe(true);
    expect(isHumanKind('asset_licence')).toBe(true);
    expect(isHumanKind('contributor_rights')).toBe(true);
    expect(isHumanKind('counsel_review')).toBe(true);

    expect(isMachineKind('counsel_review')).toBe(false);
    expect(isHumanKind('source_commit')).toBe(false);
  });
});
