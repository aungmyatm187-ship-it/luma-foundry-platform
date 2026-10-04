import { createHash } from 'node:crypto';

/**
 * Adapter for `ember-lite` evidence bundles.
 *
 * `ember-lite` (MIT) emits signed, verified "evidence bundles" — a perception
 * object of named observations plus a chain that has been signed and verified.
 * This module turns a raw bundle into deterministic, credential-safe evidence
 * records that Ember Signal (and the wider platform) can render.
 *
 * It is deliberately strict, for two reasons the recovered source already
 * encoded and which must not be lost in a port:
 *   1. Unsigned / unverified bundles are rejected, not silently accepted.
 *   2. Credential-like text (bearer tokens, API keys, secrets) is rejected
 *      before it can reach a rendered surface.
 */

export const EMBER_LITE_COMMIT = '2bb64e184c5618cf5d7fef2f4755975b6041b535';

export type EmberLiteObservationStatus = 'observed' | 'verified' | 'blocked';

export type EmberLiteEvidenceRecord = {
  id: string;
  title: string;
  source: string;
  observedAt: string;
  status: EmberLiteObservationStatus;
  summary: string;
  reference: string;
};

export type EmberLiteEvidenceRead = {
  updatedAt: string;
  records: EmberLiteEvidenceRecord[];
  sourceCommit: string;
};

type Bundle = Record<string, unknown>;

const credentialPattern =
  /(authorization\s*:\s*bearer|api[_ -]?key|secret|password|private[_ -]?key|token\s*[:=])/i;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stableId(value: string): string {
  return `ember-lite-${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
}

function readObservation(bundle: Bundle): Record<string, unknown> {
  const perception = bundle.perception;
  if (!perception || typeof perception !== 'object' || Array.isArray(perception)) {
    throw new Error('ember-lite bundle has no perception object');
  }
  const observations = (perception as Bundle).observations;
  if (!observations || typeof observations !== 'object' || Array.isArray(observations)) {
    throw new Error('ember-lite bundle has no observations object');
  }
  return observations as Record<string, unknown>;
}

function requireVerifiedChain(bundle: Bundle): void {
  const chain = bundle.chain;
  if (!chain || typeof chain !== 'object' || Array.isArray(chain)) {
    throw new Error('ember-lite bundle has no chain verification object');
  }
  const verified = (chain as Bundle).verified;
  const signed = (chain as Bundle).signed;
  if (verified !== true || signed !== true) {
    throw new Error('ember-lite bundle chain is unsigned or unverified');
  }
}

export function adaptEmberLiteEvidenceBundle(
  input: unknown,
  sourceCommit = EMBER_LITE_COMMIT,
): EmberLiteEvidenceRead {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('ember-lite bundle must be a JSON object');
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) {
    throw new Error('source commit must be a 40-character hexadecimal hash');
  }

  const bundle = input as Bundle;
  const serialized = JSON.stringify(bundle);
  if (credentialPattern.test(serialized)) {
    throw new Error('credential-like text is not renderable');
  }

  requireVerifiedChain(bundle);
  const observations = readObservation(bundle);
  const observedAt = text(bundle.perceived_at) || new Date(0).toISOString();
  const records = Object.entries(observations).flatMap(([key, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const observation = value as Bundle;
    const status = text(observation.status);
    const summary = text(observation.data) || text(observation.error);
    const safeSummary = summary || `Observed ${key} from ember-lite evidence bundle.`;
    if (credentialPattern.test(`${key} ${status} ${safeSummary}`)) {
      throw new Error(`credential-like observation rejected: ${key}`);
    }
    const record: EmberLiteEvidenceRecord = {
      id: stableId(`${sourceCommit}:${key}:${observedAt}`),
      title: `ember-lite ${key} observation`,
      source: 'ember-lite verified bundle',
      observedAt,
      status: status === 'error' ? 'blocked' : 'observed',
      summary: safeSummary.slice(0, 500),
      reference: `ember-lite:${sourceCommit}:${key}`,
    };
    return [record];
  });

  return { updatedAt: observedAt, records, sourceCommit };
}
