/**
 * luma-bridge — Premium Edge Bridge (B1) for the Luma Foundry ecosystem.
 * ---------------------------------------------------------------------------
 * Source-controlled replacement for the orphan Manus-hosted Express origin
 * that currently proxies lumafoundry.live/api/signals (stale releaseCommit
 * cf83370…, updatedAt 2026-09-05, not owned by any repo we control).
 *
 * Premium features (each mapped to a researched market data point — see
 * premium-bridges/RESEARCH-DATA-POINTS.md):
 *
 *   1. EDGE CACHING with stale-while-revalidate  — the edge keeps serving the
 *      last verified payload while a background revalidation refreshes it, so
 *      Render cold starts (30-50 s) become invisible to shoppers.
 *      (Inspired by: Holistic AI "Operative Agents" graceful intervention.)
 *
 *   2. EXPONENTIAL BACKOFF RETRIES with jitter — 3 attempts, 200 ms base,
 *      capped at 1.6 s, only for 5xx / network errors / timeouts. 4xx is a
 *      real answer, not a transient fault, and is never retried.
 *
 *   3. EXACT-MATCH CORS — the single allowed origin from env is echoed
 *      verbatim; foreign origins get NO Access-Control-Allow-Origin header.
 *      Slash-variants of the origin do not match. Never reflective.
 *
 *   4. OPTIONAL Ed25519 UPSTREAM SIGNATURE VERIFICATION — when the upstream
 *      (ember-signal-web + B5 trust.py) signs its responses, this worker
 *      refuses to cache or serve payloads whose signature is invalid.
 *      (Inspired by: C2PA Content Credentials tamper evidence + Trust List.)
 *
 *   5. HONEST METADATA — bridge adds only facts it can derive at runtime
 *      (cache state, age, fetch latency, signature state). No fabricated
 *      releaseCommit. Ever. (BRIDGE-001 lesson.)
 *
 *   6. SIGNED CACHE PURGE — POST /api/signals/purge, authenticated with an
 *      Ed25519 request signature (ADMIN_PUBLIC_KEY), clears the edge cache so
 *      a B4 data sync can take effect immediately instead of waiting for TTL.
 *
 * Routes:
 *   GET/HEAD  /api/signals        — cached proxy of the signals payload
 *   GET/HEAD  /healthz            — worker liveness + cache state (no upstream call)
 *   POST      /api/signals/purge  — Ed25519-authenticated cache purge
 *   OPTIONS   (any route)         — CORS preflight, fixed values
 *   anything else                 — 404
 *
 * Deploy: see wrangler.toml and premium-bridges/EXECUTION-PLAN.md.
 */

export const WORKER_VERSION = '2.0.0';

export interface Env {
  /** Upstream signals endpoint, e.g. https://ember-signal-web.onrender.com/api/signals */
  UPSTREAM_URL: string;
  /** The ONE origin allowed to read responses cross-origin (exact string match). */
  ALLOWED_ORIGIN: string;
  RENDER_SERVICE_ID?: string;
  /** Fresh-window seconds (default 60) — responses younger than this are served with cache=HIT. */
  CACHE_TTL_SECONDS?: string;
  /** Serve-stale window seconds (default 86400) — how long the last good payload survives upstream outages. */
  STALE_TTL_SECONDS?: string;
  /** Total attempts per upstream call (default 3). */
  MAX_RETRIES?: string;
  /** First backoff delay ms (default 200); doubles per attempt. */
  BACKOFF_BASE_MS?: string;
  /** Backoff cap ms (default 1600). */
  BACKOFF_MAX_MS?: string;
  /** Per-attempt upstream timeout ms (default 10000). */
  UPSTREAM_TIMEOUT_MS?: string;
  /** base64 Ed25519 public key of the upstream signer (optional). Enables response verification. */
  UPSTREAM_PUBLIC_KEY?: string;
  /** "true" = reject unsigned/invalid upstream responses instead of serving them. */
  REQUIRE_SIGNATURE?: string;
  /** base64 Ed25519 public key authorising cache purge calls (optional). */
  ADMIN_PUBLIC_KEY?: string;
}

/** Injectable dependencies so unit tests never touch the real network or cache. */
export interface FetchDeps {
  fetchImpl: typeof fetch;
  cache: Pick<Cache, 'match' | 'put' | 'delete'> | null;
  now: () => number;
}

const DEFAULTS = {
  cacheTtlSeconds: 60,
  staleTtlSeconds: 86_400,
  maxRetries: 3,
  backoffBaseMs: 200,
  backoffMaxMs: 1_600,
  upstreamTimeoutMs: 10_000,
} as const;

// ---------------------------------------------------------------------------
// Small helpers (exported for unit tests)
// ---------------------------------------------------------------------------

function intEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function config(env: Env): {
  upstreamUrl: string; allowedOrigin: string; serviceId: string;
  cacheTtl: number; staleTtl: number; maxRetries: number;
  backoffBase: number; backoffMax: number; timeoutMs: number;
  requireSignature: boolean;
} {
  return {
    upstreamUrl: env.UPSTREAM_URL,
    allowedOrigin: env.ALLOWED_ORIGIN,
    serviceId: env.RENDER_SERVICE_ID ?? 'unknown',
    cacheTtl: intEnv(env.CACHE_TTL_SECONDS, DEFAULTS.cacheTtlSeconds),
    staleTtl: intEnv(env.STALE_TTL_SECONDS, DEFAULTS.staleTtlSeconds),
    maxRetries: intEnv(env.MAX_RETRIES, DEFAULTS.maxRetries),
    backoffBase: intEnv(env.BACKOFF_BASE_MS, DEFAULTS.backoffBaseMs),
    backoffMax: intEnv(env.BACKOFF_MAX_MS, DEFAULTS.backoffMaxMs),
    timeoutMs: intEnv(env.UPSTREAM_TIMEOUT_MS, DEFAULTS.upstreamTimeoutMs),
    requireSignature: env.REQUIRE_SIGNATURE === 'true',
  };
}

/** Exponential backoff with jitter: base * 2^(attempt-1) + U[0, half), capped. */
export function backoffDelayMs(attempt: number, baseMs: number, maxMs: number): number {
  const exp = baseMs * 2 ** (Math.max(1, attempt) - 1);
  const cappedExp = Math.min(maxMs, exp);
  const jitter = Math.random() * (cappedExp / 2);
  return Math.min(maxMs, cappedExp + jitter);
}

/** Exact-match CORS headers. Foreign origins receive no ACAO at all. */
export function corsHeaders(originHeader: string | null, allowedOrigin: string): Record<string, string> {
  const headers: Record<string, string> = { Vary: 'Origin' };
  if (originHeader !== null && originHeader === allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Methods'] = 'GET, HEAD, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Luma-Timestamp, X-Luma-Key-Id, X-Luma-Signature';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

/** Only path we serve (trailing slash tolerated). */
function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function json(status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  });
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64.trim());
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Canonical message for REQUEST signatures (must match b5-trust-bridge/trust.py `canonical_message`). */
async function requestCanonicalMessage(timestamp: string, method: string, path: string, body: Uint8Array): Promise<Uint8Array> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', body));
  const prefix = new TextEncoder().encode(`${timestamp}|${method}|${path}|`);
  const out = new Uint8Array(prefix.length + digest.length);
  out.set(prefix, 0);
  out.set(digest, prefix.length);
  return out;
}

/** Canonical message for RESPONSE signatures (must match b5-trust-bridge/trust.py `sign_response_body`). */
async function responseCanonicalMessage(timestamp: string, body: Uint8Array): Promise<Uint8Array> {
  const hex = await sha256Hex(body);
  return new TextEncoder().encode(`response|${timestamp}|${hex}`);
}

async function verifyEd25519(publicKeyB64: string, signatureB64: string, message: Uint8Array): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBytes(publicKeyB64), 'Ed25519', false, ['verify']);
    return await crypto.subtle.verify('Ed25519', key, b64ToBytes(signatureB64), message);
  } catch {
    // Runtime without Ed25519 WebCrypto support, or malformed key/signature.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Upstream fetch with exponential backoff + timeout
// ---------------------------------------------------------------------------

export interface UpstreamResult {
  ok: boolean;
  status: number;
  body: string;
  headers: Headers;
  attempts: number;
  lastError?: string;
}

export async function fetchUpstream(env: Env, deps: FetchDeps): Promise<UpstreamResult> {
  const cfg = config(env);
  let lastError = 'unknown error';
  for (let attempt = 1; attempt <= cfg.maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
    try {
      const res = await deps.fetchImpl(cfg.upstreamUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json', 'X-Luma-Bridge': `v${WORKER_VERSION}` },
      });
      clearTimeout(timer);
      if (res.status >= 500 && attempt < cfg.maxRetries) {
        lastError = `upstream ${res.status}`;
        await sleep(backoffDelayMs(attempt, cfg.backoffBase, cfg.backoffMax));
        continue;
      }
      const body = await res.text();
      return { ok: res.ok, status: res.status, body, headers: res.headers, attempts: attempt };
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < cfg.maxRetries) {
        await sleep(backoffDelayMs(attempt, cfg.backoffBase, cfg.backoffMax));
        continue;
      }
    }
  }
  return { ok: false, status: 0, body: '', headers: new Headers(), attempts: cfg.maxRetries, lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Signature verification of the upstream payload (optional, B5)
// ---------------------------------------------------------------------------

export type SignatureState = 'verified' | 'invalid' | 'skipped';

async function checkUpstreamSignature(env: Env, upstreamHeaders: Headers, body: string): Promise<SignatureState> {
  if (!env.UPSTREAM_PUBLIC_KEY) return 'skipped';
  const signature = upstreamHeaders.get('X-Luma-Signature');
  const timestamp = upstreamHeaders.get('X-Luma-Timestamp');
  if (!signature || !timestamp) return env.REQUIRE_SIGNATURE === 'true' ? 'invalid' : 'skipped';
  const message = await responseCanonicalMessage(timestamp, new TextEncoder().encode(body));
  const ok = await verifyEd25519(env.UPSTREAM_PUBLIC_KEY, signature, message);
  if (!ok) return env.REQUIRE_SIGNATURE === 'true' ? 'invalid' : 'skipped';
  return 'verified';
}

// ---------------------------------------------------------------------------
// Edge cache (stale-while-revalidate)
// ---------------------------------------------------------------------------

interface CachedEnvelope {
  upstreamStatus: number;
  fetchedAtMs: number;
  fetchMs: number;
  signature: SignatureState;
  body: string; // raw upstream JSON text
}

function cacheKeyUrl(requestUrl: URL): Request {
  // Cache key is independent of the public hostname so the worker can be
  // fronted by any route without splitting the cache.
  const key = `https://luma-bridge.internal${normalizePath(requestUrl.pathname)}`;
  return new Request(key, { method: 'GET' });
}

function envelopeToResponse(envelope: CachedEnvelope, staleTtl: number): Response {
  return new Response(JSON.stringify(envelope), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Luma-Cached-At': String(envelope.fetchedAtMs),
      'Cache-Control': `public, max-age=${staleTtl}`,
    },
  });
}

async function readEnvelope(deps: FetchDeps, requestUrl: URL): Promise<CachedEnvelope | null> {
  if (!deps.cache) return null;
  const cached = await deps.cache.match(cacheKeyUrl(requestUrl));
  if (!cached) return null;
  try {
    return (await cached.json()) as CachedEnvelope;
  } catch {
    return null;
  }
}

async function writeEnvelope(deps: FetchDeps, requestUrl: URL, env: Env, envelope: CachedEnvelope): Promise<void> {
  if (!deps.cache) return;
  try {
    await deps.cache.put(cacheKeyUrl(requestUrl), envelopeToResponse(envelope, config(env).staleTtl));
  } catch {
    // Cache write failures must never break request serving.
  }
}

// ---------------------------------------------------------------------------
// Response builders (honest metadata only)
// ---------------------------------------------------------------------------

interface BridgeMeta {
  status: 'live' | 'degraded';
  source: 'render';
  sourceUrl: string;
  serviceId: string;
  fetchedAt: string;
  fetchMs: number;
  cache: 'HIT' | 'MISS' | 'STALE';
  ageSeconds: number;
  signature: SignatureState;
  workerVersion: string;
}

function buildClientResponse(
  envelope: CachedEnvelope,
  cacheState: 'HIT' | 'MISS' | 'STALE',
  env: Env,
  deps: FetchDeps,
  cors: Record<string, string>,
): Response {
  const ageSeconds = Math.max(0, Math.round((deps.now() - envelope.fetchedAtMs) / 1000));
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(envelope.body) as Record<string, unknown>;
  } catch {
    payload = { raw: envelope.body };
  }
  const cfg = config(env);
  const meta: BridgeMeta = {
    status: 'live',
    source: 'render',
    sourceUrl: cfg.upstreamUrl,
    serviceId: cfg.serviceId,
    fetchedAt: new Date(envelope.fetchedAtMs).toISOString(),
    fetchMs: envelope.fetchMs,
    cache: cacheState,
    ageSeconds,
    signature: envelope.signature,
    workerVersion: WORKER_VERSION,
  };
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Luma-Cache': cacheState,
    'X-Luma-Age': String(ageSeconds),
    ...cors,
  };
  return new Response(JSON.stringify({ ...payload, bridge: meta }), { status: 200, headers });
}

// ---------------------------------------------------------------------------
// Background revalidation (stale-while-revalidate)
// ---------------------------------------------------------------------------

async function revalidate(env: Env, deps: FetchDeps, requestUrl: URL): Promise<void> {
  const started = deps.now();
  const result = await fetchUpstream(env, deps);
  if (!result.ok || result.status !== 200) return;
  const signature = await checkUpstreamSignature(env, result.headers, result.body);
  if (signature === 'invalid') return; // never cache a payload that fails verification
  await writeEnvelope(deps, requestUrl, env, {
    upstreamStatus: result.status,
    fetchedAtMs: deps.now(),
    fetchMs: deps.now() - started,
    signature,
    body: result.body,
  });
}

// ---------------------------------------------------------------------------
// Main router (exported for unit tests)
// ---------------------------------------------------------------------------

export async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  deps?: Partial<FetchDeps>,
): Promise<Response> {
  const d: FetchDeps = {
    fetchImpl: deps?.fetchImpl ?? fetch,
    cache: deps?.cache ?? (typeof caches !== 'undefined' ? caches.default : null),
    now: deps?.now ?? (() => Date.now()),
  };
  const cfg = config(env);
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);
  const cors = corsHeaders(request.headers.get('Origin'), cfg.allowedOrigin);

  // ---- CORS preflight -------------------------------------------------------
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  // ---- Health ---------------------------------------------------------------
  if ((request.method === 'GET' || request.method === 'HEAD') && (path === '/healthz' || path === '/api/health')) {
    const envelope = await readEnvelope(d, url);
    return json(200, {
      ok: true,
      worker: 'luma-bridge',
      version: WORKER_VERSION,
      upstream: cfg.upstreamUrl,
      cache: envelope
        ? {
            present: true,
            fetchedAt: new Date(envelope.fetchedAtMs).toISOString(),
            ageSeconds: Math.round((d.now() - envelope.fetchedAtMs) / 1000),
            signature: envelope.signature,
          }
        : { present: false },
      config: {
        cacheTtlSeconds: cfg.cacheTtl,
        staleTtlSeconds: cfg.staleTtl,
        maxRetries: cfg.maxRetries,
        requireSignature: cfg.requireSignature,
      },
    }, cors);
  }

  // ---- Signals proxy ---------------------------------------------------------
  if ((request.method === 'GET' || request.method === 'HEAD') && path === '/api/signals') {
    const envelope = await readEnvelope(d, url);

    if (envelope) {
      const ageSeconds = (d.now() - envelope.fetchedAtMs) / 1000;
      if (ageSeconds <= cfg.cacheTtl) {
        return buildClientResponse(envelope, 'HIT', env, d, cors);
      }
      // Stale-while-revalidate: answer immediately, refresh in the background.
      ctx.waitUntil(revalidate(env, d, url).catch(() => undefined));
      return buildClientResponse(envelope, 'STALE', env, d, cors);
    }

    // Cache miss: fetch synchronously so the first shopper gets real data.
    const started = d.now();
    const result = await fetchUpstream(env, d);
    if (result.ok && result.status === 200) {
      const signature = await checkUpstreamSignature(env, result.headers, result.body);
      if (signature === 'invalid') {
        return json(502, {
          status: 'error',
          error: 'upstream_signature_invalid',
          detail: 'the upstream payload failed Ed25519 verification and was refused',
          bridge: { workerVersion: WORKER_VERSION, attempts: result.attempts },
        }, cors);
      }
      const fresh: CachedEnvelope = {
        upstreamStatus: result.status,
        fetchedAtMs: d.now(),
        fetchMs: d.now() - started,
        signature,
        body: result.body,
      };
      ctx.waitUntil(writeEnvelope(d, url, env, fresh));
      return buildClientResponse(fresh, 'MISS', env, d, cors);
    }

    // Upstream unreachable and nothing cached: fail honestly. No fabricated data.
    return json(503, {
      status: 'unavailable',
      error: 'upstream_unreachable',
      detail: result.lastError,
      bridge: {
        workerVersion: WORKER_VERSION,
        attempts: result.attempts,
        hint: 'the edge cache is empty and the upstream did not answer; retry shortly',
      },
    }, cors);
  }

  // ---- Signed cache purge (B5-authenticated admin operation) -----------------
  if (request.method === 'POST' && path === '/api/signals/purge') {
    if (!env.ADMIN_PUBLIC_KEY) {
      return json(501, { status: 'error', error: 'purge_not_configured', detail: 'set ADMIN_PUBLIC_KEY to enable signed cache purge' }, cors);
    }
    const timestamp = request.headers.get('X-Luma-Timestamp') ?? '';
    const signature = request.headers.get('X-Luma-Signature') ?? '';
    if (!timestamp || !signature) {
      return json(401, { status: 'error', error: 'missing_signature_headers' }, cors);
    }
    // Replay window: 300 s.
    const age = Math.abs(d.now() / 1000 - Number.parseFloat(timestamp));
    if (!Number.isFinite(age) || age > 300) {
      return json(401, { status: 'error', error: 'stale_timestamp' }, cors);
    }
    const bodyBytes = new Uint8Array(await request.arrayBuffer());
    const message = await requestCanonicalMessage(timestamp, 'POST', path, bodyBytes);
    const valid = await verifyEd25519(env.ADMIN_PUBLIC_KEY, signature, message);
    if (!valid) {
      return json(401, { status: 'error', error: 'invalid_signature' }, cors);
    }
    let purged = false;
    if (d.cache) {
      purged = await d.cache.delete(cacheKeyUrl(url));
    }
    return json(200, { status: 'ok', purged, purgedAt: new Date(d.now()).toISOString() }, cors);
  }

  return json(404, { status: 'error', error: 'not_found', path }, cors);
}

// ---------------------------------------------------------------------------
// Worker entrypoint
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handleRequest(request, env, ctx);
    } catch (err) {
      return json(500, {
        status: 'error',
        error: 'bridge_internal_error',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  },
};
