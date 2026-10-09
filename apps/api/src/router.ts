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
 */
import { z } from 'zod';

import {
  DECISION_STATUSES,
  EVIDENCE_KINDS,
  PRIORITIES,
  PRODUCT_STATUSES,
  ROLES,
  WORK_ITEM_STATUSES,
  buildEvidenceReviewPacket,
  evaluateClearance,
} from '@luma/core';

import { router, protectedProcedure } from './trpc.js';

export const appRouter = router({
  snapshot: protectedProcedure.query(async ({ ctx }) => await ctx.ws.snapshot()),

  createUser: protectedProcedure
    .input(z.object({ name: z.string().min(1), role: z.enum(ROLES) }))
    .mutation(async ({ ctx, input }) => await ctx.ws.createUser(input.name, input.role)),

  createGoal: protectedProcedure
    .input(
      z.object({
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

  createHandoff: protectedProcedure
    .input(
      z.object({
        goalId: z.string(),
        productId: z.string().nullable().optional(),
        fromRole: z.enum(ROLES),
        toRole: z.enum(ROLES),
        title: z.string().min(1),
        summary: z.string().min(1),
        asks: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => await ctx.ws.createHandoff(input)),

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

  updateDecisionStatus: protectedProcedure
    .input(
      z.object({
        decisionId: z.string(),
        status: z.enum(DECISION_STATUSES),
        decidedBy: z.enum(ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      await ctx.ws.updateDecisionStatus(input.decisionId, input.status, input.decidedBy),
    ),

  recordEvidence: protectedProcedure
    .input(
      z.object({
        productId: z.string(),
        kind: z.enum(EVIDENCE_KINDS),
        reference: z.string().min(1),
        note: z.string().min(1),
        recordedBy: z.enum(ROLES),
      }),
    )
    .mutation(async ({ ctx, input }) => await ctx.ws.recordEvidence(input)),

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

  /** Reviewer-ready record history and requirement coverage; read-only. */
  evidenceReviewPacket: protectedProcedure
    .input(z.object({ productId: z.string() }))
    .query(async ({ ctx, input }) => {
      const snap = await ctx.ws.snapshot();
      const product = snap.products.find((p) => p.id === input.productId);
      if (!product) throw new Error(`Unknown product: ${input.productId}`);
      return buildEvidenceReviewPacket(product, await ctx.ws.evidenceFor(input.productId));
    }),

  /** Guarded: throws unless the product has earned clearance. */
  setProductStatus: protectedProcedure
    .input(z.object({ productId: z.string(), status: z.enum(PRODUCT_STATUSES) }))
    .mutation(async ({ ctx, input }) => await ctx.ws.updateProductStatus(input.productId, input.status)),
});

export type AppRouter = typeof appRouter;
