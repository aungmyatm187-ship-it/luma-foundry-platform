/**
 * tRPC context and auth-aware procedures.
 *
 * Verifies Supabase JWTs locally against the project's JWKS endpoint. No
 * per-request network call — the JWKS is fetched once and cached by jose's
 * createRemoteJWKSet.
 *
 * The JWT `sub` claim is the Supabase auth UUID. That is what DrizzleRepository
 * takes in its constructor, and what RLS policies compare against
 * users.auth_user_id.
 */
import { initTRPC, TRPCError } from '@trpc/server';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Context = {
  authUserId: string | null;
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

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<Context> {
  const auth = opts.req.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return { authUserId: null };

  const token = auth.slice('Bearer '.length).trim();
  if (!token) return { authUserId: null };

  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return { authUserId: null };

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${supabaseUrl}/auth/v1`,
    });
    const sub = payload.sub;
    if (!sub || typeof sub !== 'string') return { authUserId: null };
    return { authUserId: sub };
  } catch {
    return { authUserId: null };
  }
}

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.authUserId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }
  return opts.next({
    ctx: { authUserId: opts.ctx.authUserId },
  });
});
