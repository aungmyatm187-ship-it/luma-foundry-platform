import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const appSource = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const luxurySource = readFileSync(resolve(root, "client/src/pages/LuxuryBatchThree.tsx"), "utf8");
const stylesSource = readFileSync(resolve(root, "client/src/pages/luxury-batch-03.css"), "utf8");

const batchThree = [
  ["/noor-vale", "NoorVale", "noor3"],
  ["/aster-alder", "AsterAlder", "aster3"],
  ["/elan-method", "ElanMethod", "elan3"],
  ["/vela-maison", "VelaMaison", "vela3"],
  ["/sardis-parfums", "SardisParfums", "sardis3"],
];

describe("Batch 03 luxury collection", () => {
  it("registers the five catalogue routes as independent public destinations", () => {
    for (const [route, component] of batchThree) {
      expect(appSource).toContain(`path={"${route}"} component={${component}}`);
      expect(luxurySource).toContain(`export function ${component}`);
    }
  });

  it("preserves five visual-system namespaces and accessible motion fallback", () => {
    for (const [, , namespace] of batchThree) {
      expect(luxurySource).toContain(`className="${namespace}"`);
      expect(stylesSource).toContain(`.${namespace}`);
    }
    expect(luxurySource).toContain("useBatchReveal()");
    expect(stylesSource).toContain("@media(prefers-reduced-motion:reduce)");
  });
});
