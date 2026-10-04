/**
 * Storefront smoke test — starts the server on an ephemeral port, asserts the
 * health route, the enquiry intake (valid + invalid), the licence surface, and
 * that all 50 products are present in the generated catalogue.
 */
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const PORT = 4317;
const server = spawn("node", ["server.mjs"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

function get(path, opts) {
  return fetch(`http://127.0.0.1:${PORT}${path}`, opts);
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await wait(800);

  const health = await get("/api/health").then((r) => r.json());
  assert(health.ok === true, "health ok");

  const root = await get("/", { redirect: "manual" });
  assert(root.status === 302 && root.headers.get("location") === "/shop.html", "root redirects to shop");

  const shopStatus = (await get("/shop.html")).status;
  assert(shopStatus === 200, "shop served");

  const valid = await get("/api/enquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: "prd-axiom-grid", name: "T", email: "t@e.com", message: "hi" }),
  }).then((r) => r.json());
  assert(valid.ok === true, "valid enquiry accepted");

  const invalid = await get("/api/enquiry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: "prd-axiom-grid" }),
  }).then((r) => r.json());
  assert(invalid.ok === false, "invalid enquiry rejected");

  const licenceStatus = (await get("/licence.html")).status;
  assert(licenceStatus === 200, "licence surface served");

  const catalogue = await readFile(new URL("../catalogue.js", import.meta.url), "utf8");
  const count = (catalogue.match(/"id": "prd-/g) || []).length;
  assert(count === 50, `catalogue has 50 products (got ${count})`);

  console.log("smoke-test: PASS (health, redirect, shop, enquiry valid/invalid, licence, 50-product catalogue)");
}

function assert(cond, label) {
  if (!cond) throw new Error(`smoke-test FAIL: ${label}`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => server.kill());
