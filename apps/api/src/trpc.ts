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
 * The AsyncWorkspace lives in the context, not in the router. Production builds
 * it from the verified JWT (fromDrizzle). Tests inject fromInMemory() directly.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { AsyncWorkspace } from '@luma/core';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Context = {
  authUserId: string | null;
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
    return { authUserId: null, ws: AsyncWorkspace.fromInMemory() };
  }

  return { authUserId, ws: AsyncWorkspace.fromDrizzle(authUserId) };
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Requires a verified Supabase session.
 * The narrowed ctx exposes authUserId as non-null and preserves ws.
 */
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.authUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return opts.next({
    ctx: { authUserId: opts.ctx.authUserId, ws: opts.ctx.ws },
  });
});
