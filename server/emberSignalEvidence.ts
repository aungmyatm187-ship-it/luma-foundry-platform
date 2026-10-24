import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const evidenceStatus = z.enum(["observed", "verified", "pending", "blocked"]);

export const emberSignalEvidenceRecord = z.object({
  id: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(180),
  source: z.string().trim().min(1).max(240),
  observedAt: z.string().trim().min(1).max(80),
  status: evidenceStatus,
  summary: z.string().trim().min(1).max(1_200),
  reference: z.string().trim().max(500).optional(),
});

export const emberSignalEvidenceDocument = z.object({
  updatedAt: z.string().trim().min(1).max(80),
  records: z.array(emberSignalEvidenceRecord).max(500),
});

export type EmberSignalEvidenceRecord = z.infer<typeof emberSignalEvidenceRecord>;
export type EmberSignalEvidenceDocument = z.infer<typeof emberSignalEvidenceDocument>;

const DEFAULT_EVIDENCE_FILE = path.resolve(process.cwd(), "data/ember-signal-evidence.json");
const MAX_EVIDENCE_BYTES = 2 * 1024 * 1024;
const CREDENTIAL_PATTERN = /(bearer\s+|api[_-]?key\s*[:=]|secret\s*[:=]|token\s*[:=]|sk-[a-z0-9_-]{12,})/i;

const containsCredentialLikeText = (document: EmberSignalEvidenceDocument) =>
  document.records.some((record) =>
    [record.id, record.title, record.source, record.summary, record.reference ?? ""].some((value) =>
      CREDENTIAL_PATTERN.test(value),
    ),
  );

export const getEmberSignalEvidencePath = () =>
  process.env.EMBER_SIGNAL_EVIDENCE_FILE?.trim() || DEFAULT_EVIDENCE_FILE;

export const parseEmberSignalEvidence = (raw: string): EmberSignalEvidenceDocument => {
  const payload: unknown = JSON.parse(raw);
  return emberSignalEvidenceDocument.parse(payload);
};

export type EmberSignalEvidenceRead =
  | { status: "ready" | "empty"; source: "local-file"; updatedAt: string; records: EmberSignalEvidenceRecord[] }
  | { status: "unavailable" | "invalid"; source: "local-file"; updatedAt: null; records: []; message: string };

export async function readEmberSignalEvidence(): Promise<EmberSignalEvidenceRead> {
  const filePath = getEmberSignalEvidencePath();

  try {
    const file = await readFile(filePath);
    if (file.byteLength > MAX_EVIDENCE_BYTES) {
      return {
        status: "invalid",
        source: "local-file",
        updatedAt: null,
        records: [],
        message: "The local evidence file is larger than the 2 MB safety limit.",
      };
    }

    try {
      const document = parseEmberSignalEvidence(file.toString("utf8"));
      if (containsCredentialLikeText(document)) {
        return {
          status: "invalid",
          source: "local-file",
          updatedAt: null,
          records: [],
          message: "Evidence was rejected because it contains credential-like text. Redact keys and authorization headers before importing.",
        };
      }

      return {
        status: document.records.length > 0 ? "ready" : "empty",
        source: "local-file",
        updatedAt: document.updatedAt,
        records: document.records,
      };
    } catch {
      return {
        status: "invalid",
        source: "local-file",
        updatedAt: null,
        records: [],
        message: "The local evidence file is not valid Ember Signal JSON evidence.",
      };
    }
  } catch {
    return {
      status: "unavailable",
      source: "local-file",
      updatedAt: null,
      records: [],
      message: "No local evidence file is available yet.",
    };
  }
}
