import type { EmberSignalSourceRead } from "./emberSignalSource";

export type EmberSignalsPayload = {
  status: EmberSignalSourceRead["status"];
  source: EmberSignalSourceRead["source"];
  sourceUrl?: string;
  serviceId?: string;
  releaseCommit?: string;
  updatedAt: string | null;
  top_brands: EmberSignalSourceRead["topBrands"];
  evidence: EmberSignalSourceRead["records"];
  message?: string;
};

/**
 * Build the canonical public signals response after the source adapter has
 * validated and normalized the operational payload.
 */
export function buildEmberSignalsPayload(read: EmberSignalSourceRead): EmberSignalsPayload {
  return {
    status: read.status,
    source: read.source,
    ...(read.sourceUrl ? { sourceUrl: read.sourceUrl } : {}),
    ...(read.serviceId ? { serviceId: read.serviceId } : {}),
    ...(read.releaseCommit ? { releaseCommit: read.releaseCommit } : {}),
    updatedAt: read.updatedAt,
    top_brands: read.topBrands,
    evidence: read.records,
    ...(read.message ? { message: read.message } : {}),
  };
}
