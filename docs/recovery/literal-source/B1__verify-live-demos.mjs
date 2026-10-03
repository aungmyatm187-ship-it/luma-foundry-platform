import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { products } from "../catalogue.js";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, "data/live-demo-audit.json");

async function verify(product) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(product.previewUrl, { method: "HEAD", redirect: "follow", signal: controller.signal });
    return { id: product.id, name: product.name, url: product.previewUrl, status: response.status, ok: response.ok };
  } catch (error) {
    return { id: product.id, name: product.name, url: product.previewUrl, status: null, ok: false, error: String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const results = [];
for (let index = 0; index < products.length; index += 10) {
  results.push(...(await Promise.all(products.slice(index, index + 10).map(verify))));
}

const audit = {
  checked_at_utc: new Date().toISOString(),
  source: "catalogue.js read-only current snapshot",
  total: results.length,
  passing: results.filter((result) => result.ok).length,
  failing: results.filter((result) => !result.ok).length,
  results,
};

await writeFile(outputPath, JSON.stringify(audit, null, 2), "utf8");
console.log(`Live demo audit: ${audit.passing}/${audit.total} passed; ${audit.failing} failed. Saved ${outputPath}`);
if (audit.failing > 0) process.exitCode = 1;
