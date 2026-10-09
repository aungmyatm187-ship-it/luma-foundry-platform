# Auth plan for issue #7 — remaining work

## Goal

Make `apps/api` and `packages/mcp-server` use `DrizzleRepository` instead of
`InMemoryRepository`, with every request scoped to a Supabase-authenticated
user. After this lands, the API is database-backed and RLS enforces isolation
without any application-level check.

## Preconditions (all satisfied)

- 7 tables exist with RLS enabled and policies targeting `public`
- `app_user` connects with `BYPASSRLS = false`
- `DrizzleRepository` proven by `scripts/test-drizzle-repository.ts`
- `AsyncWorkspace.fromDrizzle(authUserId)` factory exists

## Design decisions already made

**User identity.** The repository constructor takes the Supabase auth UUID
(the JWT `sub` claim), not `public.users.id`. Every RLS policy compares
`auth.uid()` against `public.users.auth_user_id`. Passing our internal id
would return zero rows.

**Tenancy model.** Constructor injection — a repository per request. No
ambient context, no AsyncLocalStorage, no module singleton. Works identically
in Node, Cloudflare Workers, and MCP stdio.

**MCP server.** Each MCP client runs its own server process bound to one
user, configured via `LUMA_AUTH_USER_ID` in the client's MCP config. The
process identity IS the user identity. This is the honest answer for a
transport that carries no headers.

## Files to change

### 1. `apps/api/src/trpc.ts` — new file

tRPC context and procedure wrappers.

- `createContext(opts)` — reads `Authorization: Bearer <jwt>`, verifies it
  against `SUPABASE_URL/auth/v1/user`, returns `{ authUserId: string | null }`
- `publicProcedure` — `t.procedure`
- `protectedProcedure` — `t.procedure.use()` that throws `UNAUTHORIZED` when
  `ctx.authUserId` is null

### 2. `apps/api/src/router.ts` — modify

- `createRouter` signature changes: `createRouter(authUserId: string)` returns
  a router bound to that user's repository
- Every mutation moves from `procedure` to `protectedProcedure`
- Every `ws.method(...)` call becomes `ws.method(...)` where `ws` is the
  request-scoped `AsyncWorkspace.fromDrizzle(authUserId)`
- `snapshot` becomes `protectedProcedure` (was public)

### 3. `apps/api/src/server.ts` — modify

- Remove the module-level `const workspace = AsyncWorkspace.fromInMemory()`
- Per request: build context from headers, resolve `authUserId`, build router
  with that user's repository, handle the request
- Add `GET /health` returning `{ ok: true }` (for Render health checks)
- Add `GET /api/trpc/snapshot` fallback returning 401 when unauthenticated

### 4. `packages/mcp-server/src/index.ts` — modify

- Read `process.env.LUMA_AUTH_USER_ID` at startup
- `const ws = AsyncWorkspace.fromDrizzle(authUserId)` if set, otherwise
  fall back to `fromInMemory()` for local dev
- No other changes

### 5. `apps/api/test/router.test.ts` — modify

- Every test currently uses `AsyncWorkspace.fromInMemory()`
- Add a `protectedProcedure` test that passes no JWT and expects 401
- Keep existing tests on the in-memory repo (they test rule correctness,
  not persistence)

### 6. `packages/core/src/db.ts` — review

- Currently throws on first query if `DATABASE_URL` is missing (lazy init).
  Verify the error message is clear enough for a failed deploy.

## Implementation order

1. Write `apps/api/src/trpc.ts` — new file, breaks nothing
2. Run `npm run typecheck` — must stay green
3. Refactor `router.ts` to use `protectedProcedure` — tests will fail
4. Update `router.test.ts` to provide a valid `authUserId` in ctx
5. Run `npm test` — must return green
6. Refactor `server.ts` to build per-request context and router
7. Add health endpoint
8. Add an end-to-end test that hits the deployed API with a real Supabase JWT
9. Merge to `main` only after the E2E test passes on the deployed environment

## Risks

- **Live deploy.** `apps/api` auto-deploys to Render on push to `main`. Every
  step that touches `apps/api` must be verified on a feature branch first.
- **JWT verification cost.** Supabase's `/auth/v1/user` endpoint is a network
  round trip per request. For a low-traffic app this is fine. If it becomes a
  problem, verify the JWT signature locally using the project's JWKS.
- **Cold start on Render free tier.** First request after idle may take 50s.
  This is a rendering of the free tier, not a bug.
- **`app_user` connection limits.** Session-mode pooler keeps one connection
  per active client. At more than a handful of concurrent requests, upgrade to
  transaction mode (port 6543) — but then `prepare: false` matters more, and
  `withUser`'s transaction isolation is required.

## Rollback

If anything goes wrong after merge:
- `git revert <merge-commit>` and push — Render redeploys within 60s
- The database is unaffected. Schema, triggers, and policies are not touched
  by this change.

## Done when

- `apps/api` writes to Postgres for every authenticated request
- Unauthenticated requests return 401, not 500
- Cross-user reads return zero rows (verified by a test that hits the live API)
- `npm test` green on `main`
- CI green on `main`
