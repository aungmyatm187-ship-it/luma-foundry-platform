import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, afterEach } from "vitest";
import {
  parseEmberSignalEvidence,
  readEmberSignalEvidence,
} from "./emberSignalEvidence";

const originalEvidencePath = process.env.EMBER_SIGNAL_EVIDENCE_FILE;

afterEach(() => {
  if (originalEvidencePath === undefined) delete process.env.EMBER_SIGNAL_EVIDENCE_FILE;
  else process.env.EMBER_SIGNAL_EVIDENCE_FILE = originalEvidencePath;
});

describe("Ember Signal local evidence", () => {
  it("parses a valid evidence document", () => {
    const document = parseEmberSignalEvidence(
      JSON.stringify({
        updatedAt: "2026-09-03T00:00:00Z",
        records: [
          {
            id: "evidence-001",
            title: "Audience language sample",
            source: "local research export",
            observedAt: "2026-09-03",
            status: "observed",
            summary: "A redacted observation for local development.",
          },
        ],
      }),
    );

    expect(document.records).toHaveLength(1);
    expect(document.records[0]?.status).toBe("observed");
  });

  it("returns unavailable when the configured local file does not exist", async () => {
    process.env.EMBER_SIGNAL_EVIDENCE_FILE = path.join(os.tmpdir(), "missing-ember-evidence.json");
    const result = await readEmberSignalEvidence();

    expect(result.status).toBe("unavailable");
    expect(result.records).toEqual([]);
  });

  it("rejects credential-like text before it can be rendered", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "ember-evidence-"));
    const filePath = path.join(directory, "evidence.json");
    process.env.EMBER_SIGNAL_EVIDENCE_FILE = filePath;
    await writeFile(
      filePath,
      JSON.stringify({
        updatedAt: "2026-09-03T00:00:00Z",
        records: [
          {
            id: "credential-leak",
            title: "Do not render",
            source: "local terminal",
            observedAt: "2026-09-03",
            status: "blocked",
            summary: "Authorization: Bearer this-must-never-render",
          },
        ],
      }),
    );

    const result = await readEmberSignalEvidence();
    await rm(directory, { recursive: true, force: true });

    expect(result.status).toBe("invalid");
    expect(result.records).toEqual([]);
  });
});
