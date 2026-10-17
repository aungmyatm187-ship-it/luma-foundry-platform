/**
 * tRPC context and auth-aware procedures.
 *
 * Verifies Supabase JWTs locally against the project's JWKS endpoint. No
 * per-request network call — the JWKS is fetched once and cached by jose.
 *
 * The JWT `sub` claim is the Supabase auth UUID. That UUID is what
 * DrizzleRepository takes in its constructor, and what RLS policies compare
 * against users.auth_user_id.
 *
 * The JWT proves who the caller is, not what they may do. Their role lives in
 * users.role, so createContext resolves it server-side once per request and
 * exposes it as ctx.actor. Procedures must read the role from there; a role in
 * a request body is a claim, never an authority.
 *
 * The AsyncWorkspace lives in the context, not in the router. Production builds
 * it from the verified JWT (fromDrizzle). Tests inject fromInMemory() directly.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { AsyncWorkspace, type Role } from '@luma/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * The server-resolved identity behind a request. `id` is the public.users row
 * id, not the Supabase auth UUID.
 */
export type Actor = { id: string; role: Role };

export type Context = {
  authUserId: string | null;
  /** Null when unauthenticated, or authenticated but with no users row yet. */
  actor: Actor | null;
  ws: AsyncWorkspace;
};

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (cachedJwks) return cachedJwks;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) throw new Error('SUPABASE_URL is not set — cannot verify JWTs');
  cachedJwks = createRemoteJWKSet(
    new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );
  return cachedJwks;
}

async function verifyJwt(authHeader: string | null): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${supabaseUrl}/auth/v1`,
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') return null;
    return sub;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<Context> {
  const authUserId = await verifyJwt(opts.req.headers.get('authorization'));

  if (!authUserId) {
    // Unauthenticated requests get an in-memory workspace. Every protected
    // procedure rejects them before touching it, so this is a placeholder
    // that satisfies the context type without pretending to be a real session.
    return { authUserId: null, actor: null, ws: AsyncWorkspace.fromInMemory() };
  }

  const ws = AsyncWorkspace.fromDrizzle(authUserId);

  // A missing users row yields a null actor (rejected below). A lookup that
  // throws is deliberately not caught: swallowing it would turn a database
  // outage into a misleading "no role" refusal, and failing the request is
  // still fail-closed.
  const user = await ws.getCurrentUser();
  const actor: Actor | null = user ? { id: user.id, role: user.role } : null;

  return { authUserId, actor, ws };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Requires a verified Supabase session AND a provisioned workspace actor.
 * The narrowed ctx exposes authUserId and actor as non-null and preserves ws.
 *
 * The two failures differ on purpose: no session is UNAUTHORIZED (who are
 * you?), while a valid session with no users row is FORBIDDEN (we know you, but
 * you hold no role, so nothing you attribute can be trusted).
 */
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.authUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  if (!opts.ctx.actor) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No workspace role is provisioned for this identity',
    });
  }
  return opts.next({
    ctx: {
      authUserId: opts.ctx.authUserId,
      actor: opts.ctx.actor,
      ws: opts.ctx.ws,
    },
  });
});
