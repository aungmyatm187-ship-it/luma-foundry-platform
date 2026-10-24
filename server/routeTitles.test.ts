import { describe, expect, it } from "vitest";
import { getDocumentTitle, OFFICIAL_PRODUCT_ROUTE_TITLES } from "../client/src/lib/routeTitles";

describe("official product document titles", () => {
  it("maps every official route to a unique product-specific title", () => {
    const routes = Object.keys(OFFICIAL_PRODUCT_ROUTE_TITLES);
    const titles = routes.map(getDocumentTitle);

    expect(routes).toHaveLength(50);
    expect(new Set(titles).size).toBe(50);
    expect(titles).not.toContain("Ember Signal — AI Marketing Intelligence");
  });

  it("keeps product titles and non-product fallback titles explicit", () => {
    expect(getDocumentTitle("/axiom-grid")).toBe("Axiom Grid — Luma Foundry");
    expect(getDocumentTitle("/ember-signal")).toBe("Ember Signal — AI Marketing Intelligence");
    expect(getDocumentTitle("/")).toBe("Luma Foundry — 50 AI Automation Workspace");
    expect(getDocumentTitle("/not-a-route")).toBe("Page Not Found — Luma Foundry");
  });
});
