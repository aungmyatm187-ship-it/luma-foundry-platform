import { describe, expect, it } from 'vitest';
import { adaptEmberLiteEvidenceBundle } from '../src/emberLiteEvidenceAdapter.js';

const validBundle = {
  perceived_at: '2026-09-18T10:56:23.267528Z',
  chain: { signed: true, verified: true },
  perception: {
    observations: {
      backend: {
        status: 'healthy',
        data: 'status_code=200; evidence=41',
      },
      repo: {
        status: 'healthy',
        data: 'release identity observed',
      },
    },
  },
};

describe('ember-lite evidence adapter', () => {
  it('maps safe observations to deterministic Ember Signal records', () => {
    const result = adaptEmberLiteEvidenceBundle(validBundle);
    expect(result.records).toHaveLength(2);
    expect(result.records[0]?.source).toBe('ember-lite verified bundle');
    expect(result.records[0]?.reference).toContain('2bb64e184c5618cf5d7fef2f4755975b6041b535');
    expect(result.records[0]?.id).toMatch(/^ember-lite-[0-9a-f]{16}$/);
    expect(adaptEmberLiteEvidenceBundle(validBundle).records[0]?.id).toBe(result.records[0]?.id);
  });

  it('rejects malformed bundles and invalid source commits', () => {
    expect(() => adaptEmberLiteEvidenceBundle({})).toThrow('no chain verification object');
    expect(() => adaptEmberLiteEvidenceBundle(validBundle, 'not-a-commit')).toThrow(
      '40-character hexadecimal hash',
    );
  });

  it('rejects unsigned or unverified bundles', () => {
    expect(() =>
      adaptEmberLiteEvidenceBundle({ ...validBundle, chain: { signed: true, verified: false } }),
    ).toThrow('unsigned or unverified');
  });

  it('rejects credential-like text before it can be rendered', () => {
    expect(() =>
      adaptEmberLiteEvidenceBundle({
        ...validBundle,
        perception: {
          observations: {
            backend: { status: 'healthy', data: 'Authorization: Bearer do-not-render' },
          },
        },
      }),
    ).toThrow('credential-like text');
  });
});
