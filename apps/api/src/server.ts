/**
 * Minimal HTTP entrypoint for the workspace API.
 *
 * Uses tRPC's fetch adapter so it runs on Node, Vercel, Cloudflare Workers, or
 * Render without change. Every request builds its own context from the
 * Authorization header:
 *
 *   - Valid Supabase JWT   → AsyncWorkspace.fromDrizzle(authUserId)
 *   - Missing/invalid JWT  → AsyncWorkspace.fromInMemory(); protected
 *                            procedures reject with UNAUTHORIZED before
 *                            touching it.
 *
 * Also exposes GET /health for Render health checks.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createServer } from 'node:http';

import { appRouter } from './router.js';
import { createContext } from './trpc.js';

const port = Number(process.env.PORT ?? 3000);
const basePath = '/api/trpc';

const server = createServer((req, res) => {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;

  // Health check — no auth, no DB, always fast. Render pings this.
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/health')) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'luma-foundry-api' }));
    return;
  }

  // Sign-in page — minimal HTML form for phones that cannot reach *.supabase.co.
  if (req.method === 'GET' && req.url === '/signin') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Luma Foundry — Sign in</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;max-width:420px;margin:4rem auto;padding:1rem}
input{display:block;width:100%;padding:.75rem;margin:.5rem 0;font-size:1rem;border:1px solid #ccc;border-radius:8px}
button{padding:.75rem 1.25rem;font-size:1rem;border:0;border-radius:8px;background:#111;color:#fff}
pre{background:#f4f4f4;padding:1rem;border-radius:8px;overflow:auto;font-size:.75rem}</style>
<h1>Sign in</h1>
<form onsubmit="event.preventDefault();const f=event.target;
fetch('/auth/signin',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({email:f.email.value,password:f.password.value})})
.then(r=>r.json()).then(j=>{document.getElementById('out').textContent=JSON.stringify(j,null,2);});">
<input name="email" type="email" placeholder="email" required>
<input name="password" type="password" placeholder="password" required>
<button>Sign in</button></form>
<pre id="out">(response appears here)</pre>`);
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', async () => {
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    if (req.method === 'POST' && req.url === '/auth/signin') {
      const supabaseUrl = process.env.SUPABASE_URL;
      const anonKey = process.env.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Supabase not configured on this host' }));
        return;
      }
      try {
        const upstream = await fetch(
          `${supabaseUrl}/auth/v1/token?grant_type=password`,
          {
            method: 'POST',
            headers: { apikey: anonKey, 'Content-Type': 'application/json' },
            body,
          },
        );
        const text = await upstream.text();
        res.writeHead(upstream.status, { 'content-type': 'application/json' });
        res.end(text);
      } catch (e) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }

    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body,
    });

    void fetchRequestHandler({
      endpoint: basePath,
      req: request,
      router: appRouter,
      createContext,
    }).then(
      async (response) => {
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      },
      (error: unknown) => {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      },
    );
  });
});

server.listen(port, () => {
  console.error(`Luma workspace API listening on http://localhost:${port}${basePath}`);
  console.error(`Health check at http://localhost:${port}/health`);
});
