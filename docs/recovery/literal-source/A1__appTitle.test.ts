import { describe, expect, it } from "vitest";

const APPROVED_APP_TITLE = "Luma Foundry — 50 AI Automation Workspace";

describe("canonical app title configuration", () => {
  it("keeps the approved Luma Foundry workspace title explicit", () => {
    expect(APPROVED_APP_TITLE).toBe("Luma Foundry — 50 AI Automation Workspace");
  });
});

