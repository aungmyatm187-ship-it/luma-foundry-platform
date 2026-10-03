import { describe, expect, it } from "vitest";
import { buildEmberSignalsPayload } from "./emberSignalsApi";

const populated = {
  status: "ready" as const,
  source: "render" as const,
  sourceUrl: "https://ember-signal-web.onrender.com/api/signals",
  serviceId: "srv-dap9srff3r2c73ehf7g0",
  releaseCommit: "cf83370ea46c4fb795aeebfefb90df2acc5d8649",
  updatedAt: "2026-09-05T00:00:00Z",
  topBrands: [{ name: "Apple", region: "USA", value: 470.9 }],
  records: [
    {
      id: "real-record-001",
      title: "My First Evidence",
      source: "Local export",
      observedAt: "2026-09-05",
      status: "observed" as const,
      summary: "This is a test evidence record.",
      reference: "local-001",
    },
  ],
};

describe("Ember Signal public signals payload", () => {
  it("returns normalized Render metadata and evidence", () => {
    const payload = buildEmberSignalsPayload(populated);

    expect(payload.status).toBe("ready");
    expect(payload.source).toBe("render");
    expect(payload.serviceId).toBe("srv-dap9srff3r2c73ehf7g0");
    expect(payload.top_brands).toEqual([{ name: "Apple", region: "USA", value: 470.9 }]);
    expect(payload.evidence[0]?.title).toBe("My First Evidence");
  });

  it("preserves local fallback state and message", () => {
    const payload = buildEmberSignalsPayload({
      status: "unavailable",
      source: "local-file",
      updatedAt: null,
      records: [],
      topBrands: [],
      message: "Render source unavailable; using local evidence fallback.",
    });

    expect(payload.source).toBe("local-file");
    expect(payload.evidence).toEqual([]);
    expect(payload.message).toContain("local evidence fallback");
    expect(payload.top_brands).toEqual([]);
  });
});
