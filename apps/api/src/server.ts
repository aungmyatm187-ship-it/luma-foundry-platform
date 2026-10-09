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

  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
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
