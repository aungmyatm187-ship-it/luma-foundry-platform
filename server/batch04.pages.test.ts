import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const pages = readFileSync(resolve(root, "client/src/pages/LuxuryBatchFour.tsx"), "utf8");
const styles = readFileSync(resolve(root, "client/src/pages/luxury-batch-04.css"), "utf8");
const products = [["/ruth-ibarra-botanics","RuthIbarraBotanics","ruth4"],["/tempo-atelier","TempoAtelier","tempo4"],["/peregrine-editions","PeregrineEditions","peregrine4"],["/caldera-optical","CalderaOptical","caldera4"],["/mare-house","MareHouse","mare4"]];

describe("Batch 04 luxury and wellness collection", () => {
  it("registers five public, catalogue-aligned product routes", () => {
    products.forEach(([route, component]) => {
      expect(app).toContain(`path={"${route}"} component={${component}}`);
      expect(pages).toContain(`export function ${component}`);
    });
  });

  it("uses separate visual namespaces and retains reduced-motion support", () => {
    products.forEach(([, , namespace]) => expect(styles).toContain(`.${namespace}`));
    expect(pages).toContain("useBatchReveal()");
    expect(styles).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
