/**
 * Luma Foundry workspace router.
 *
 * Mirrors the procedures the shipped /workspace app already calls, backed by the
 * same core domain and governance rules as the MCP server. One rule set, two
 * surfaces — an agent and the web UI cannot disagree about what "cleared" means.
 */
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

import {
  DECISION_STATUSES,
  EVIDENCE_KINDS,
  PRIORITIES,
  PRODUCT_STATUSES,
  ROLES,
  WORK_ITEM_STATUSES,
  AsyncWorkspace,
  evaluateClearance,
} from '@luma/core';

export function createRouter(ws: AsyncWorkspace = AsyncWorkspace.fromInMemory()) {
  const t = initTRPC.create();
  const procedure = t.procedure;

  return t.router({
    snapshot: procedure.query(async () => await ws.snapshot()),

    createUser: procedure
      .input(z.object({ name: z.string().min(1), role: z.enum(ROLES) }))
      .mutation(async ({ input }) => await ws.createUser(input.name, input.role)),

    createGoal: procedure
      .input(
        z.object({
          ownerId: z.string(),
          title: z.string().min(1),
          outcome: z.string().min(1),
          priority: z.enum(PRIORITIES).optional(),
          targetDate: z.string().nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => await ws.createGoal(input)),

    createProduct: procedure
      .input(
        z.object({
          goalId: z.string(),
          name: z.string().min(1),
          category: z.string().min(1),
          route: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => await ws.createProduct(input)),

    createWorkItem: procedure
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
      .mutation(async ({ input }) => await ws.createWorkItem(input)),

    updateWorkItemStatus: procedure
      .input(z.object({ workItemId: z.string(), status: z.enum(WORK_ITEM_STATUSES) }))
      .mutation(async ({ input }) => await ws.updateWorkItemStatus(input.workItemId, input.status)),

    createHandoff: procedure
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
      .mutation(async ({ input }) => await ws.createHandoff(input)),

    updateHandoffStatus: procedure
      .input(z.object({ handoffId: z.string(), status: z.enum(['draft', 'sent', 'accepted', 'returned']) }))
      .mutation(async ({ input }) => await ws.updateHandoffStatus(input.handoffId, input.status)),

    createDecision: procedure
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
      .mutation(async ({ input }) => await ws.createDecision(input)),

    updateDecisionStatus: procedure
      .input(
        z.object({
          decisionId: z.string(),
          status: z.enum(DECISION_STATUSES),
          decidedBy: z.enum(ROLES),
        }),
      )
      .mutation(async ({ input }) =>
        await ws.updateDecisionStatus(input.decisionId, input.status, input.decidedBy),
      ),

    recordEvidence: procedure
      .input(
        z.object({
          productId: z.string(),
          kind: z.enum(EVIDENCE_KINDS),
          reference: z.string().min(1),
          note: z.string().min(1),
          recordedBy: z.enum(ROLES),
        }),
      )
      .mutation(async ({ input }) => await ws.recordEvidence(input)),

    /** Guarded: returns a clearance report, never mutates. */
    checkClearance: procedure
      .input(z.object({ productId: z.string() }))
      .query(async ({ input }) => {
        const snap = await ws.snapshot();
        const product = snap.products.find((p) => p.id === input.productId);
        if (!product) throw new Error(`Unknown product: ${input.productId}`);
        const evidence = await ws.evidenceFor(input.productId);
        return evaluateClearance(product, evidence);
      }),

    /** Guarded: throws unless the product has earned clearance. */
    setProductStatus: procedure
      .input(z.object({ productId: z.string(), status: z.enum(PRODUCT_STATUSES) }))
      .mutation(async ({ input }) => await ws.updateProductStatus(input.productId, input.status)),
  });
}

export type AppRouter = ReturnType<typeof createRouter>;
