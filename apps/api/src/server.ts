/**
 * Minimal HTTP entrypoint for the workspace API.
 *
 * Uses tRPC's fetch adapter so it runs on Node, Vercel, Cloudflare Workers, or
 * Render without change. Swap the in-memory workspace for a Drizzle/Postgres
 * repository when persistence lands.
 */
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createServer } from 'node:http';

import { Workspace } from '@luma/core';
import { createRouter } from './router.js';

const workspace = new Workspace();
const router = createRouter(workspace);

const port = Number(process.env.PORT ?? 3000);
const basePath = '/api/trpc';

const server = createServer((req, res) => {
  const url = `http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;

  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, {
      method: req.method,
      headers: req.headers as Record<string, string>,
      body,
    });

    void fetchRequestHandler({ endpoint: basePath, req: request, router }).then(
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
});
