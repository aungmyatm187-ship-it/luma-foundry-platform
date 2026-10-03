import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = "/home/ubuntu/aurelia-atelier";
const assetRoot = "/home/ubuntu/webdev-static-assets";
const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const isAsset = url.pathname.startsWith("/manus-storage/");
  const rel = isAsset ? url.pathname.replace("/manus-storage/", "") : (url.pathname === "/" ? "index.html" : url.pathname.slice(1));
  const base = isAsset ? assetRoot : root;
  const safe = normalize(rel).replace(/^\.\.(\/|\\|$)/, "");
  try {
    const data = await readFile(join(base, safe));
    res.writeHead(200, { "Content-Type": mime[extname(safe)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}).listen(process.env.PORT || 4178, "0.0.0.0");
