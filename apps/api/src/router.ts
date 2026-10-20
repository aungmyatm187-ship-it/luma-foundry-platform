/**
 * Luma Foundry workspace router.
 *
 * Mirrors the procedures the shipped /workspace app already calls, backed by
 * the same core domain and governance rules as the MCP server. One rule set,
 * two surfaces — an agent and the web UI cannot disagree about what "cleared"
 * means.
 *
 * Every procedure reads ctx.ws, which createContext builds per request:
 *   - authenticated   → AsyncWorkspace.fromDrizzle(authUserId)  (RLS-scoped)
 *   - unauthenticated → AsyncWorkspace.fromInMemory()           (rejected below)
 *
 * Every procedure here is protected — this is a user-scoped workspace API,
 * not a public endpoint.
 *
 * Attribution vs. choice. Fields that say who DID something (recordedBy,
 * decidedBy, fromRole — and, since migration 0008, the database-derived
 * decidedByUserId / recordedByUserId) come from the session or from database
 * triggers and are not in any input schema: a client that still sends them
 * has them stripped by zod. Fields that say who something is FOR (assignedTo,
 * toRole) are real decisions by the caller and stay as input.
 *
 * Membership is consent-based (migration 0008). There is deliberately no
 * procedure that inserts workspace_members, and no procedure that mints
 * users or global roles: rows in workspace_members are created only by the
 * SECURITY DEFINER database function accept_invitation(), and global roles
 * are assigned only by an authorized service_role admin. The four invitation
 * procedures below are thin adapters over the database functions — the
 * functions, not this router, decide who may invite, who may accept, and
 * what counts as expired.
 */
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import {
  DECISION_STATUSES,
  EVIDENCE_KINDS,
  PRIORITIES,
  PRODUCT_STATUSES,
  ROLES,
  WORK_ITEM_STATUSES,
  evaluateClearance,
} from '@luma/core';

import { router, protectedProcedure } from './trpc.js';

/**
 * FORBIDDEN rather than UNAUTHORIZED: protectedProcedure has already
 * established who the caller is; these refusals are about what they may do.
 */
function forbid(message: string): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

/**
 * Walks an error (and its `.cause` chain — drizzle wraps driver errors) to
 * find a PostgreSQL SQLSTATE code, e.g. '42501' or 'P0001'.
 */
function pgErrorCode(err: unknown): string | undefined {
  let current = err as { code?: unknown; cause?: unknown } | null | undefined;
  for (let hop = 0; current && hop < 5; hop += 1) {
    if (typeof current.code === 'string' && /^[0-9A-Z]{5}$/.test(current.code)) {
      return current.code;
    }
    current = current.cause as typeof current;
  }
  return undefined;
}

/**
 * Same walk for the most specific human-readable message. The database
 * functions raise messages meant to reach the caller ("invitation expired",
 * "only workspace owners may invite"), so the deepest one wins.
 */
function pgErrorMessage(err: unknown): string {
  let current = err as { message?: unknown; cause?: unknown } | null | undefined;
  let message = 'Membership change rejected by the database.';
  for (let hop = 0; current && hop < 5; hop += 1) {
    if (typeof current.message === 'string' && current.message.length > 0) {
      message = current.message;
    }
    current = current.cause as typeof current;
  }
  return message;
}

/**
 * Membership changes run inside SECURITY DEFINER database functions
 * (migration 0008), which are the single authority for who may invite, who
 * may accept, and what counts as expired or already used. The router never
 * re-implements those rules; it translates the database's rejections into
 * tRPC errors:
 *   28000  not authenticated                  → UNAUTHORIZED
 *   42501  insufficient_privilege / RLS       → FORBIDDEN
 *   P0002  no_data_found (unknown invitation) → NOT_FOUND
 *   P0001 / 22023 / 235xx  rule rejections    → BAD_REQUEST
 *          (expired, revoked, replay, wrong user, already a member, …)
 * Anything else fails closed as INTERNAL_SERVER_ERROR with a generic
 * message — an unexpected database state is never rendered as success.
 */
function throwMembershipError(err: unknown): never {
  const code = pgErrorCode(err);
  if (code === '28000') {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: pgErrorMessage(err) });
  }
  if (code === '42501') {
    throw new TRPCError({ code: 'FORBIDDEN', message: pgErrorMessage(err) });
  }
  if (code === 'P0002') {
    throw new TRPCError({ code: 'NOT_FOUND', message: pgErrorMessage(err) });
  }
  if (code === 'P0001' || code === '22023' || code === '23503' || code === '23505' || code === '23514') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: pgErrorMessage(err) });
  }
  throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Membership change failed.' });
}

export const appRouter = router({
  snapshot: protectedProcedure.query(async ({ ctx }) => await ctx.ws.snapshot()),

  // createUser was removed with migration 0008. It was the last
  // direct-provisioning path from the pre-workspace model: an owner minting
  // users with chosen global roles. Under the locked decisions, users are
  // provisioned by Supabase Auth (handle_new_user starts everyone as
  // 'pending' in a personal workspace), global roles are assigned only by an
  // authorized service_role admin, and workspace access arrives exclusively
  // through an accepted invitation (inviteUser / acceptInvite below).

  createGoal: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        ownerId: z.string(),
        title: z.string().min(1),
        outcome: z.string().min(1),
        priority: z.enum(PRIORITIES).optional(),
        targetDate: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => await ctx.ws.createGoal(input)),

  createProduct: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        name: z.string().min(1),
        category: z.string().min(1),
        route: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => await ctx.ws.createProduct(input)),

  // assignedTo is who the work is FOR, which is the caller's choice (an
  // operator legitimately assigns work to the other operator or the owner).
  // Overwriting it with the caller's own role would silently misroute work.
  createWorkItem: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        productId: z.string().nullable().optional(),
        type: z.string().min(1),
        assignedTo: z.enum(ROLES),
        title: z.string().min(1),
        detail: z.string().min(1),
        priority: z.enum(PRIORITIES).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => await ctx.ws.createWorkItem(input)),

  updateWorkItemStatus: protectedProcedure
    .input(z.object({ workItemId: z.string(), status: z.enum(WORK_ITEM_STATUSES) }))
    .mutation(async ({ ctx, input }) => await ctx.ws.updateWorkItemStatus(input.workItemId, input.status)),

  // fromRole is who SENT the handoff, so it is attribution and comes from the
  // session. toRole is who it is addressed to, so it stays the caller's choice.
  createHandoff: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        productId: z.string().nullable().optional(),
        toRole: z.enum(ROLES),
        title: z.string().min(1),
        summary: z.string().min(1),
        asks: z.string().min(1),
      }),
    )
    .mutation(
      async ({ ctx, input }) =>
        await ctx.ws.createHandoff({ ...input, fromRole: ctx.actor.role }),
    ),

  updateHandoffStatus: protectedProcedure
    .input(z.object({ handoffId: z.string(), status: z.enum(['draft', 'sent', 'accepted', 'returned']) }))
    .mutation(async ({ ctx, input }) => await ctx.ws.updateHandoffStatus(input.handoffId, input.status)),

  createDecision: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        productId: z.string().nullable().optional(),
        title: z.string().min(1),
        context: z.string().min(1),
        decision: z.string().min(1),
        ownerId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => await ctx.ws.createDecision(input)),

  /**
   * Only the owner resolves a decision (COLLABORATION.md rule 4); agents may
   * raise and populate one but not close it. Re-opening or deferring is not
   * gated here, so those transitions stay open to every role.
   * decidedBy is attribution, so it is the actor's role, never input.
   * From 0008 the database trigger additionally derives decidedByUserId from
   * the authenticated identity, so a spoofed role label cannot change who the
   * decision is attributed to.
   */
  updateDecisionStatus: protectedProcedure
    .input(
      z.object({
        decisionId: z.string(),
        status: z.enum(DECISION_STATUSES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const resolves = input.status === 'approved' || input.status === 'declined';
      if (resolves && ctx.actor.role !== 'owner') {
        forbid('Only the owner can approve or decline a decision.');
      }
      return await ctx.ws.updateDecisionStatus(
        input.decisionId,
        input.status,
        ctx.actor.role,
      );
    }),

  // recordedBy keeps the audit trail honest: it must distinguish build claims
  // from review verifications, which only works if the author cannot be chosen.
  // From 0008 the database trigger also derives recordedByUserId from the
  // authenticated identity and feeds it into the hash payload (the attribution
  // trigger runs before the hash-chain trigger), so forged role labels are
  // ignored at the database boundary as well as here.
  recordEvidence: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        kind: z.enum(EVIDENCE_KINDS),
        reference: z.string().min(1),
        note: z.string().min(1),
      }),
    )
    .mutation(
      async ({ ctx, input }) =>
        await ctx.ws.recordEvidence({ ...input, recordedBy: ctx.actor.role }),
    ),

  /** Guarded: returns a clearance report, never mutates. */
  checkClearance: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const snap = await ctx.ws.snapshot();
      const product = snap.products.find((p) => p.id === input.productId);
      if (!product) throw new Error(`Unknown product: ${input.productId}`);
      const evidence = await ctx.ws.evidenceFor(input.productId);
      return evaluateClearance(product, evidence);
    }),

  /**
   * Guarded twice, for different reasons. The role check says WHO may clear
   * (operator_a builds, so it may not); it runs first so that refusal never
   * depends on evidence state. The evidence rule itself is not repeated here:
   * updateProductStatus enforces it through governance.ts, and that stays the
   * single place it lives.
   */
  setProductStatus: protectedProcedure
    .input(z.object({ productId: z.string(), status: z.enum(PRODUCT_STATUSES) }))
    .mutation(async ({ ctx, input }) => {
      if (input.status === 'cleared' && ctx.actor.role === 'operator_a') {
        forbid('operator_a builds products and may not clear them.');
      }
      return await ctx.ws.updateProductStatus(input.productId, input.status);
    }),

  // ── Invitations (migration 0008) ─────────────────────────────
  /**
   * Thin adapters over the SECURITY DEFINER database functions. Deliberate
   * design points:
   *
   * 1. No membership INSERT exists on this surface. acceptInvite() causes the
   *    database function to create the workspace_members row — the API never
   *    writes membership directly, so consent cannot be bypassed from the
   *    client however hostile the request.
   * 2. No role or expiry knobs. Global roles come from a service_role admin;
   *    the seven-day expiry is database policy inside create_invitation().
   * 3. No ownership pre-checks here. ctx.actor.role is the GLOBAL role, which
   *    says nothing about workspace ownership; the functions check
   *    is_workspace_owner() authoritatively. The router maps their rejections:
   *    non-owner invite → FORBIDDEN, wrong-user/expired/revoked/replay accept
   *    → BAD_REQUEST, unknown invitation → NOT_FOUND.
   * 4. Identity fields (invitedBy, acceptedBy) and timestamps are derived by
   *    the database from the authenticated context, never from input.
   */
  inviteUser: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        inviteeUserId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.ws.inviteUser(input);
      } catch (err) {
        throwMembershipError(err);
      }
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Pending global-role users may accept (locked decision): acceptance
        // grants workspace membership without changing users.role. The
        // database function enforces invitee identity, single-use and expiry.
        return await ctx.ws.acceptInvite(input.invitationId);
      } catch (err) {
        throwMembershipError(err);
      }
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await ctx.ws.revokeInvite(input.invitationId);
      } catch (err) {
        throwMembershipError(err);
      }
    }),

  /** Invitations addressed to the caller that are still actionable. */
  listMyInvites: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await ctx.ws.listMyInvites();
    } catch (err) {
      throwMembershipError(err);
    }
  }),
});

export type AppRouter = typeof appRouter;
