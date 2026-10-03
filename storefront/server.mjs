import http from "node:http";
import { readFile, appendFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

/**
 * Enquiry intake — replaces the previous dead-end toast stubs with a real lead
 * endpoint. Append-only JSONL ledger (enquiries.jsonl), self-contained (no
 * third-party email/CRM assumed). Checkout/order path hooks in separately once
 * the merchant-of-record is activated (see docs/recovery webhook source).
 */
const ENQUIRY_LOG = join(root, "enquiries.jsonl");

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("payload too large"));
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

async function handleEnquiry(req, res) {
  try {
    const body = JSON.parse(await readBody(req));
    const productId = String(body.product_id ?? "").slice(0, 200);
    const name = String(body.name ?? "").slice(0, 200);
    const email = String(body.email ?? "").slice(0, 320);
    const message = String(body.message ?? "").slice(0, 4000);

    if (!productId || !email || !email.includes("@")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "product_id and a valid email are required" }));
      return;
    }

    const record = { ts: new Date().toISOString(), productId, name, email, message };
    await appendFile(ENQUIRY_LOG, JSON.stringify(record) + "\n", "utf8");

    res.writeHead(201, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, received: true }));
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "invalid JSON body" }));
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");

  if (req.method === "POST" && url.pathname === "/api/enquiry") {
    await handleEnquiry(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "luma-foundry-storefront" }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/licence.html") {
    res.writeHead(200, { "Content-Type": mime[".html"] });
    res.end(await readFile(join(root, "licence.html"), "utf8"));
    return;
  }

  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const safe = normalize(rel).replace(/^\.\.(\/|\\|$)/, "");
  try {
    const data = await readFile(join(root, safe));
    res.writeHead(200, { "Content-Type": mime[extname(safe)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(process.env.PORT || 4178, "0.0.0.0");
