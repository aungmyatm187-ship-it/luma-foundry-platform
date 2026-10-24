import { z } from "zod";

export const collaboratorRoles = ["owner", "operator_a", "operator_b"] as const;
export const workStatuses = ["backlog", "ready", "in_progress", "blocked", "review", "done"] as const;
export const decisionStatuses = ["pending", "approved", "declined"] as const;

export const createGoalInput = z.object({
  title: z.string().trim().min(3).max(160),
  outcome: z.string().trim().min(6).max(3_000),
  priority: z.enum(["focus", "next", "later"]),
});

export const createProductInput = z.object({
  goalId: z.number().int().positive(),
  name: z.string().trim().min(2).max(160),
  category: z.string().trim().min(2).max(120),
  route: z.string().trim().max(255).optional(),
});

export const createWorkItemInput = z.object({
  goalId: z.number().int().positive(),
  productId: z.number().int().positive().nullable().optional(),
  type: z.enum(["task", "support"]),
  assignedTo: z.enum(collaboratorRoles),
  title: z.string().trim().min(3).max(180),
  detail: z.string().trim().max(3_000).optional(),
  priority: z.enum(["high", "medium", "low"]),
});

export const createHandoffInput = z.object({
  goalId: z.number().int().positive(),
  productId: z.number().int().positive().nullable().optional(),
  fromRole: z.enum(collaboratorRoles),
  toRole: z.enum(collaboratorRoles),
  title: z.string().trim().min(3).max(180),
  summary: z.string().trim().min(6).max(3_000),
  asks: z.string().trim().max(2_000).optional(),
});

export const createDecisionInput = z.object({
  goalId: z.number().int().positive(),
  productId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(3).max(180),
  context: z.string().trim().min(6).max(3_000),
});

export const updateWorkStatusInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(workStatuses),
});

export const updateDecisionStatusInput = z.object({
  id: z.number().int().positive(),
  status: z.enum(decisionStatuses),
  decision: z.string().trim().max(3_000).optional(),
});
