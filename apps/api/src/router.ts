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
 * decidedBy, fromRole) come from ctx.actor.role and are not in any input
 * schema: a client that still sends them has them stripped by zod. Fields that
 * say who something is FOR (assignedTo, toRole) are real decisions by the
 * caller and stay as input.
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

export const appRouter = router({
  snapshot: protectedProcedure.query(async ({ ctx }) => await ctx.ws.snapshot()),

  /**
   * Creating a user grants a role, so only an owner may do it. The check reads
   * the actor's role; input.role is only the payload being created, never the
   * caller's authority.
   */
  createUser: protectedProcedure
    .input(z.object({ name: z.string().min(1), role: z.enum(ROLES) }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.actor.role !== 'owner') {
        forbid('Owner role required to create users.');
      }
      return await ctx.ws.createUser(input.name, input.role);
    }),

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
});

export type AppRouter = typeof appRouter;
