import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const routesSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const stylesSource = readFileSync(resolve(root, "client/src/pages/batch-02.css"), "utf8");

const products = [
  ["/stilla-care-systems", "StillaCareSystems", "stilla-page"],
  ["/morrow-compute", "MorrowCompute", "morrow-page"],
  ["/vanta-proof", "VantaProof", "vanta-page"],
  ["/helio-relay", "HelioRelay", "helio-page"],
  ["/folio-forms", "FolioForms", "folio-page"],
];

describe("Batch 02 product collection", () => {
  it("registers five independent public product routes", () => {
    for (const [route, component] of products) {
      expect(routesSource).toContain(`path={"${route}"} component={${component}}`);
    }
  });

  it("keeps every Batch 02 product attached to its own visual-system namespace", () => {
    for (const [, component, namespace] of products) {
      const source = readFileSync(resolve(root, `client/src/pages/${component}.tsx`), "utf8");
      expect(source).toContain(`className="${namespace}"`);
      expect(source).toContain("useBatchReveal()");
      expect(source).toContain("batch-02.css?raw");
    }
    expect(stylesSource).toContain("@media (prefers-reduced-motion:reduce)");
  });
});
