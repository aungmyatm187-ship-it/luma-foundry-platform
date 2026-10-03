import { z } from "zod";
import { readEmberSignalEvidence, emberSignalEvidenceRecord, type EmberSignalEvidenceRecord, type EmberSignalEvidenceRead } from "./emberSignalEvidence";

const DEFAULT_RENDER_SIGNALS_URL = "https://ember-signal-web.onrender.com/api/signals";
const DEFAULT_RENDER_SERVICE_ID = "srv-dap9srff3r2c73ehf7g0";
const DEFAULT_RENDER_RELEASE_COMMIT = "cf83370ea46c4fb795aeebfefb90df2acc5d8649";
const REMOTE_TIMEOUT_MS = 5_000;

const remoteBrandTuple = z.tuple([z.string().trim().min(1).max(120), z.string().trim().min(1).max(120), z.number().finite()]);
const remoteBrandObject = z.object({ name: z.string().trim().min(1).max(120), count: z.number().finite() });
const remoteResponse = z.object({
  status: z.string().trim().min(1).max(40).optional(),
  updatedAt: z.string().trim().max(80).nullable().optional(),
  evidence: z.union([
    z.array(emberSignalEvidenceRecord),
    z.object({ updatedAt: z.string().trim().max(80).nullable().optional(), records: z.array(emberSignalEvidenceRecord) }),
  ]),
  top_brands: z.array(z.union([remoteBrandTuple, remoteBrandObject])).optional().default([]),
});

export type EmberSignalSource = "render" | "local-file";
export type EmberSignalSourceRead = {
  status: "ready" | "empty" | "unavailable" | "invalid";
  source: EmberSignalSource;
  sourceUrl?: string;
  serviceId?: string;
  releaseCommit?: string;
  updatedAt: string | null;
  records: EmberSignalEvidenceRecord[];
  topBrands: Array<{ name: string; region: string; value: number }>;
  message?: string;
};

const renderSignalsUrl = () => process.env.EMBER_SIGNAL_RENDER_SIGNALS_URL?.trim() || DEFAULT_RENDER_SIGNALS_URL;
const renderServiceId = () => process.env.EMBER_SIGNAL_RENDER_SERVICE_ID?.trim() || DEFAULT_RENDER_SERVICE_ID;
const renderReleaseCommit = () => process.env.EMBER_SIGNAL_RENDER_RELEASE_COMMIT?.trim() || DEFAULT_RENDER_RELEASE_COMMIT;

function normaliseBrands(input: Array<z.infer<typeof remoteBrandTuple> | z.infer<typeof remoteBrandObject>>) {
  return input.map((brand) => Array.isArray(brand)
    ? { name: brand[0], region: brand[1], value: brand[2] }
    : { name: brand.name, region: "unknown", value: brand.count });
}

function normaliseEvidence(evidence: z.infer<typeof remoteResponse>["evidence"]) {
  return Array.isArray(evidence) ? evidence : evidence.records;
}

async function readRenderSource(): Promise<EmberSignalSourceRead> {
  const sourceUrl = renderSignalsUrl();
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(REMOTE_TIMEOUT_MS), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Render source returned HTTP ${response.status}`);
  const parsed = remoteResponse.parse(await response.json());
  const records = normaliseEvidence(parsed.evidence);
  return {
    status: records.length ? "ready" : "empty",
    source: "render",
    sourceUrl,
    serviceId: renderServiceId(),
    releaseCommit: renderReleaseCommit(),
    updatedAt: Array.isArray(parsed.evidence) ? parsed.updatedAt ?? null : parsed.evidence.updatedAt ?? parsed.updatedAt ?? null,
    records,
    topBrands: normaliseBrands(parsed.top_brands),
  };
}

function localSource(local: EmberSignalEvidenceRead, message?: string): EmberSignalSourceRead {
  return {
    status: local.status,
    source: "local-file",
    updatedAt: local.updatedAt,
    records: local.records,
    topBrands: [],
    ...(message ? { message } : {}),
  };
}

export async function readCanonicalEmberSignalSource(): Promise<EmberSignalSourceRead> {
  const local = await readEmberSignalEvidence();
  try {
    return await readRenderSource();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown Render source error";
    return localSource(local, `Render source unavailable; using local evidence fallback. ${reason}`);
  }
}

export function assertSafeEvidenceRecords(records: EmberSignalEvidenceRecord[]) {
  return records.filter((record): record is EmberSignalEvidenceRecord => emberSignalEvidenceRecord.safeParse(record).success);
}
