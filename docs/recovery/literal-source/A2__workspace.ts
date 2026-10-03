import { router, protectedProcedure } from "../_core/trpc";
import {
  createDecision,
  createGoal,
  createHandoff,
  createProduct,
  createWorkItem,
  getWorkspaceSnapshot,
  updateDecisionStatus,
  updateWorkItemStatus,
} from "../db";
import {
  createDecisionInput,
  createGoalInput,
  createHandoffInput,
  createProductInput,
  createWorkItemInput,
  updateDecisionStatusInput,
  updateWorkStatusInput,
} from "../workspaceSchemas";

export const workspaceRouter = router({
  snapshot: protectedProcedure.query(({ ctx }) => getWorkspaceSnapshot(ctx.user.id)),
  createGoal: protectedProcedure.input(createGoalInput).mutation(({ ctx, input }) => createGoal(ctx.user.id, input)),
  createProduct: protectedProcedure.input(createProductInput).mutation(({ ctx, input }) => createProduct(ctx.user.id, input)),
  createWorkItem: protectedProcedure.input(createWorkItemInput).mutation(({ ctx, input }) => createWorkItem(ctx.user.id, input)),
  createHandoff: protectedProcedure.input(createHandoffInput).mutation(({ ctx, input }) => createHandoff(ctx.user.id, input)),
  createDecision: protectedProcedure.input(createDecisionInput).mutation(({ ctx, input }) => createDecision(ctx.user.id, input)),
  updateWorkItemStatus: protectedProcedure.input(updateWorkStatusInput).mutation(({ ctx, input }) => updateWorkItemStatus(ctx.user.id, input)),
  updateDecisionStatus: protectedProcedure.input(updateDecisionStatusInput).mutation(({ ctx, input }) => updateDecisionStatus(ctx.user.id, input)),
});
