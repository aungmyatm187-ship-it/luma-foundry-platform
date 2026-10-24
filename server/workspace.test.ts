import { describe, expect, it } from "vitest";
import { createGoalInput, createHandoffInput, createWorkItemInput } from "./workspaceSchemas";

describe("workspace input contracts", () => {
  it("accepts a concrete owner goal", () => {
    const result = createGoalInput.parse({ title: "Release Batch 01", outcome: "Publish five verified product routes for the storefront.", priority: "focus" });
    expect(result.priority).toBe("focus");
  });

  it("rejects a work item without a useful title", () => {
    expect(() => createWorkItemInput.parse({ goalId: 1, type: "task", assignedTo: "operator_a", title: "x", priority: "high" })).toThrow();
  });

  it("keeps handoff authors and recipients inside the approved collaborator roles", () => {
    const result = createHandoffInput.parse({ goalId: 1, fromRole: "operator_a", toRole: "operator_b", title: "Pass design notes", summary: "Visual system and mobile findings are ready for the next review." });
    expect(result.toRole).toBe("operator_b");
  });
});
