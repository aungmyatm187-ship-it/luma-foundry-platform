import { afterEach, describe, expect, it, vi } from "vitest";
import { readCanonicalEmberSignalSource } from "./emberSignalSource";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.EMBER_SIGNAL_RENDER_SIGNALS_URL;
const originalEvidencePath = process.env.EMBER_SIGNAL_EVIDENCE_FILE;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EMBER_SIGNAL_RENDER_SIGNALS_URL;
  else process.env.EMBER_SIGNAL_RENDER_SIGNALS_URL = originalUrl;
  if (originalEvidencePath === undefined) delete process.env.EMBER_SIGNAL_EVIDENCE_FILE;
  else process.env.EMBER_SIGNAL_EVIDENCE_FILE = originalEvidencePath;
  vi.restoreAllMocks();
});

describe("Ember Signal canonical source adapter", () => {
  it("normalizes the Render response and attaches release identity", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      evidence: {
        updatedAt: "2026-09-05T00:00:00Z",
        records: [{
          id: "real-record-001",
          title: "My First Evidence",
          source: "Local export",
          observedAt: "2026-09-05",
          status: "observed",
          summary: "This is a test evidence record.",
          reference: "local-001",
        }],
      },
      top_brands: [["Apple", "USA", 470.9]],
    }), { status: 200, headers: { "content-type": "application/json" } }));

    const result = await readCanonicalEmberSignalSource();

    expect(result.source).toBe("render");
    expect(result.serviceId).toBe("srv-dap9srff3r2c73ehf7g0");
    expect(result.releaseCommit).toBe("cf83370ea46c4fb795aeebfefb90df2acc5d8649");
    expect(result.topBrands).toEqual([{ name: "Apple", region: "USA", value: 470.9 }]);
    expect(result.records[0]?.title).toBe("My First Evidence");
  });

  it("falls back to the local evidence file when Render is unavailable", async () => {
    process.env.EMBER_SIGNAL_EVIDENCE_FILE = "/path/that/does/not/exist.json";
    globalThis.fetch = vi.fn(async () => { throw new Error("network unavailable"); });

    const result = await readCanonicalEmberSignalSource();

    expect(result.source).toBe("local-file");
    expect(result.message).toContain("Render source unavailable");
  });
});
