import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url);
const out = new URL("../dist", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const entry of ["index.html", "shop.html", "template.html", "styles.css", "app.js", "shop.js", "template.js", "catalogue.js"]) {
  const source = new URL(`../${entry}`, import.meta.url);
  if (!existsSync(source)) throw new Error(`Required build input missing: ${entry}`);
  cpSync(source, new URL(`../dist/${entry}`, import.meta.url));
}

console.log(`Built static Luma Foundry master shop to ${join(root.pathname, "dist")}`);
