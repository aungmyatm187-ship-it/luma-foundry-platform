/**
 * Unit tests for the Premium Edge Bridge worker (B1).
 * Runs under plain vitest — no miniflare needed: fetch, cache and clock are
 * injected via the FetchDeps parameter of handleRequest().
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRequest, corsHeaders, backoffDelayMs, WORKER_VERSION } from '../src/worker.js';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

class FakeCache {
  store = new Map<string, Response>();
  async match(req: Request): Promise<Response | undefined> {
    return this.store.get(req.url);
  }
  async put(req: Request, res: Response): Promise<void> {
    this.store.set(req.url, res.clone());
  }
  async delete(req: Request): Promise<boolean> {
    return this.store.delete(req.url);
  }
}

function makeCtx() {
  const waited: Promise<unknown>[] = [];
  return {
    ctx: { waitUntil: (p: Promise<unknown>) => { waited.push(p); } } as ExecutionContext,
    waited,
  };
}

const UPSTREAM_JSON = JSON.stringify({
  top_brands: [
    { name: 'STI Myanmar College', country: 'Yangon', brand_value: 7 },
    { name: 'BUC', country: 'Yangon', brand_value: 6 },
  ],
  evidence: { updatedAt: '2026-10-23T01:58:56Z', records: [] },
});

function upstreamOk(body = UPSTREAM_JSON) {
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const ENV = {
  UPSTREAM_URL: 'https://ember-signal-web.onrender.com/api/signals',
  ALLOWED_ORIGIN: 'https://lumafoundry.live',
  RENDER_SERVICE_ID: 'srv-dap9srff3r2c73ehf7g0',
  BACKOFF_BASE_MS: '1',
  BACKOFF_MAX_MS: '4',
  UPSTREAM_TIMEOUT_MS: '1000',
};

function get(path: string, origin?: string, method = 'GET'): Request {
  const headers = new Headers();
  if (origin) headers.set('Origin', origin);
  return new Request(`https://bridge.example${path}`, { method, headers });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('corsHeaders — exact match only', () => {
  it('echoes the allowed origin verbatim', () => {
    const h = corsHeaders('https://lumafoundry.live', 'https://lumafoundry.live');
    expect(h['Access-Control-Allow-Origin']).toBe('https://lumafoundry.live');
  });

  it('gives a trailing-slash origin NO ACAO header', () => {
    const h = corsHeaders('https://lumafoundry.live/', 'https://lumafoundry.live');
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('gives foreign origins NO ACAO header', () => {
    const h = corsHeaders('https://evil.example', 'https://lumafoundry.live');
    expect(h['Access-Control-Allow-Origin']).toBeUndefined();
    expect(h['Vary']).toBe('Origin');
  });
});

describe('backoffDelayMs — exponential with cap', () => {
  it('grows exponentially and respects the cap', () => {
    for (let i = 0; i < 50; i++) {
      expect(backoffDelayMs(1, 200, 1600)).toBeLessThanOrEqual(300); // 200 + jitter(<=100)
      expect(backoffDelayMs(2, 200, 1600)).toBeLessThanOrEqual(600); // 400 + jitter
      expect(backoffDelayMs(5, 200, 1600)).toBeLessThanOrEqual(1600); // capped
      expect(backoffDelayMs(1, 200, 1600)).toBeGreaterThanOrEqual(200);
    }
  });
});

describe('handleRequest — routing', () => {
  it('404s unknown paths', async () => {
    const { ctx } = makeCtx();
    const res = await handleRequest(get('/nope'), ENV, ctx, { cache: null, fetchImpl: async () => upstreamOk(), now: () => 0 });
    expect(res.status).toBe(404);
  });

  it('answers CORS preflight with 204 and fixed methods', async () => {
    const { ctx } = makeCtx();
    const res = await handleRequest(get('/api/signals', 'https://lumafoundry.live', 'OPTIONS'), ENV, ctx, {
      cache: null, fetchImpl: async () => upstreamOk(), now: () => 0,
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://lumafoundry.live');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('healthz reports version and cache state without calling upstream', async () => {
    const { ctx } = makeCtx();
    const fetchImpl = vi.fn(async () => upstreamOk());
    const res = await handleRequest(get('/healthz'), ENV, ctx, { cache: null, fetchImpl, now: () => 0 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['ok']).toBe(true);
    expect(body['version']).toBe(WORKER_VERSION);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('handleRequest — cache lifecycle', () => {
  it('MISS: fetches upstream, adds honest bridge meta, caches', async () => {
    const cache = new FakeCache();
    const { ctx, waited } = makeCtx();
    let time = 1_000_000;
    const res = await handleRequest(get('/api/signals', 'https://lumafoundry.live'), ENV, ctx, {
      cache, fetchImpl: async () => upstreamOk(), now: () => time,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body['top_brands'].length).toBe(2);
    expect(body['bridge']['cache']).toBe('MISS');
    expect(body['bridge']['fetchedAt']).toBe(new Date(time).toISOString());
    expect(body['bridge']['signature']).toBe('skipped');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://lumafoundry.live');
    await Promise.all(waited); // let the cache write finish
    expect(cache.store.size).toBe(1);
  });

  it('HIT: serves from cache without touching upstream', async () => {
    const cache = new FakeCache();
    const fetchImpl = vi.fn(async () => upstreamOk());
    let time = 1_000_000;
    const first = await handleRequest(get('/api/signals'), ENV, makeCtx().ctx, { cache, fetchImpl, now: () => time });
    await first?.text?.();
    // Simulate the waitUntil cache write completing:
    await cache.put(new Request('https://luma-bridge.internal/api/signals'), new Response(JSON.stringify({
      upstreamStatus: 200, fetchedAtMs: time, fetchMs: 5, signature: 'skipped', body: UPSTREAM_JSON,
    })));
    time += 10_000; // 10 seconds later, still inside the 60 s fresh window
    const { ctx } = makeCtx();
    const res = await handleRequest(get('/api/signals'), ENV, ctx, { cache, fetchImpl, now: () => time });
    const body = (await res.json()) as Record<string, any>;
    expect(body['bridge']['cache']).toBe('HIT');
    expect(body['bridge']['ageSeconds']).toBe(10);
    expect(fetchImpl).toHaveBeenCalledTimes(1); // only the MISS call
  });

  it('STALE: serves stale payload immediately and revalidates in background', async () => {
    const cache = new FakeCache();
    await cache.put(new Request('https://luma-bridge.internal/api/signals'), new Response(JSON.stringify({
      upstreamStatus: 200, fetchedAtMs: 1_000_000, fetchMs: 5, signature: 'skipped', body: UPSTREAM_JSON,
    })));
    const NEW_JSON = JSON.stringify({ top_brands: [{ name: 'AUSTON', country: 'Mandalay', brand_value: 4 }], evidence: { records: [] } });
    const fetchImpl = vi.fn(async () => upstreamOk(NEW_JSON));
    const { ctx, waited } = makeCtx();
    let time = 1_000_000 + 120_000; // 2 minutes later -> beyond fresh TTL
    const res = await handleRequest(get('/api/signals'), ENV, ctx, { cache, fetchImpl, now: () => time });
    const body = (await res.json()) as Record<string, any>;
    // Serves the OLD payload instantly (stale-while-revalidate)...
    expect(body['bridge']['cache']).toBe('STALE');
    expect(body['top_brands'][0]['name']).toBe('STI Myanmar College');
    // ...while the refresh runs in the background.
    await Promise.all(waited);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const refreshed = await cache.match(new Request('https://luma-bridge.internal/api/signals'));
    const envelope = (await refreshed!.json()) as Record<string, unknown>;
    expect((envelope['body'] as string)).toBe(NEW_JSON);
  });

  it('upstream failure with empty cache -> honest 503, no fabricated data', async () => {
    const { ctx } = makeCtx();
    const fetchImpl = vi.fn(async () => new Response('Service Unavailable', { status: 503 }));
    const res = await handleRequest(get('/api/signals'), ENV, ctx, { cache: null, fetchImpl, now: () => 0 });
    expect(res.status).toBe(503);
    const body = (await res.json()) as Record<string, any>;
    expect(body['error']).toBe('upstream_unreachable');
    expect(body['top_brands']).toBeUndefined();
    // 3 attempts with backoff (backoff capped at 4 ms in ENV)
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('4xx from upstream is NOT retried', async () => {
    const { ctx } = makeCtx();
    const fetchImpl = vi.fn(async () => new Response('{"error":"not_found"}', { status: 404 }));
    const res = await handleRequest(get('/api/signals'), ENV, ctx, { cache: null, fetchImpl, now: () => 0 });
    expect(res.status).toBe(503);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps serving the cached payload when the upstream dies (resilience window)', async () => {
    const cache = new FakeCache();
    await cache.put(new Request('https://luma-bridge.internal/api/signals'), new Response(JSON.stringify({
      upstreamStatus: 200, fetchedAtMs: 1_000_000, fetchMs: 5, signature: 'skipped', body: UPSTREAM_JSON,
    })));
    const fetchImpl = vi.fn(async () => new Response('Service Unavailable', { status: 503 }));
    const { ctx, waited } = makeCtx();
    const time = 1_000_000 + 3_600_000; // 1 h later: stale but inside 24 h window
    const res = await handleRequest(get('/api/signals'), ENV, ctx, { cache, fetchImpl, now: () => time });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body['bridge']['cache']).toBe('STALE');
    await Promise.all(waited); // revalidation attempted but upstream still down
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    // Cache entry untouched by the failed revalidation.
    const still = await cache.match(new Request('https://luma-bridge.internal/api/signals'));
    expect(still).toBeDefined();
  });
});

describe('handleRequest — signed purge', () => {
  it('401 without signature headers when ADMIN_PUBLIC_KEY is configured', async () => {
    const { ctx } = makeCtx();
    const env = { ...ENV, ADMIN_PUBLIC_KEY: 'k' };
    const res = await handleRequest(new Request('https://bridge.example/api/signals/purge', { method: 'POST' }), env, ctx, {
      cache: null, fetchImpl: async () => upstreamOk(), now: () => 0,
    });
    expect(res.status).toBe(401);
  });

  it('501 when purge is not configured', async () => {
    const { ctx } = makeCtx();
    const res = await handleRequest(new Request('https://bridge.example/api/signals/purge', { method: 'POST' }), ENV, ctx, {
      cache: null, fetchImpl: async () => upstreamOk(), now: () => 0,
    });
    expect(res.status).toBe(501);
  });
});
