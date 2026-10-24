import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const app = readFileSync(resolve(root, "client/src/App.tsx"), "utf8");
const globalCss = readFileSync(resolve(root, "client/src/index.css"), "utf8");
const pages = readdirSync(resolve(root, "client/src/pages"))
  .filter(file => file.endsWith(".tsx") && !["Home.tsx", "NotFound.tsx", "CollaborationWorkspace.tsx"].includes(file))
  .map(file => readFileSync(resolve(root, "client/src/pages", file), "utf8"))
  .join("\n");

describe("full product collection QC safeguards", () => {
  it("registers all fifty official routes", () => {
    const routes = app.match(/<Route path=\{?"\/[^"]+"\}? component=/g) ?? [];
    expect(routes.length).toBeGreaterThanOrEqual(50);
  });

  it("keeps product pages structural, actionable, and free of common placeholder copy", () => {
    expect(pages).toContain("<main");
    expect(pages).toContain("<button");
    expect(pages).not.toMatch(/Lorem ipsum|\[TODO|\bTBD\b|Coming soon/);
  });

  it("provides visible keyboard focus, reduced-motion behavior, and 300ms motion normalization", () => {
    expect(globalCss).toContain("button:focus-visible,a:focus-visible");
    expect(globalCss).toContain("[data-batch-reveal] { transition-duration:300ms !important");
    expect(globalCss).toContain("prefers-reduced-motion:reduce");
  });
});
