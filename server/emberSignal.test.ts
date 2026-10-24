import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { emberSignalBriefInput, emberSignalBriefOutput } from "./routers/emberSignal";

const validInput = {
  campaignName: "Northern Light",
  audience: "Independent teams choosing a sharper point of view",
  marketSignals: "People want proof they can act on, not another broad promise.",
  desiredOutcome: "Create a campaign brief that earns a clear next decision.",
  channels: ["email", "social"] as const,
};

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("emberSignalBriefInput", () => {
  it("accepts a bounded campaign brief request", () => {
    expect(emberSignalBriefInput.parse(validInput)).toMatchObject(validInput);
  });

  it("rejects empty evidence and unsupported channels", () => {
    expect(() => emberSignalBriefInput.parse({ ...validInput, marketSignals: "short" })).toThrow();
    expect(() => emberSignalBriefInput.parse({ ...validInput, channels: ["sms"] })).toThrow();
  });
});

describe("emberSignalBriefOutput", () => {
  it("accepts the structured brief contract", () => {
    expect(
      emberSignalBriefOutput.parse({
        coreTension: "Teams see activity but lack a clear next decision.",
        campaignThesis: "Make evidence the most visible part of the campaign.",
        recommendedMove: "Lead with one audience truth and prove it across channels.",
        proofPoints: ["Repeated audience language", "A measurable decision cue"],
        nextQuestion: "Which signal would change the room's next decision?",
      }),
    ).toHaveProperty("proofPoints.length", 2);
  });
});

describe("emberSignal.buildCampaignBrief", () => {
  it("requires authentication before any LLM request can run", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());

    await expect(caller.emberSignal.buildCampaignBrief(validInput)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("emberSignal.getLocalEvidence", () => {
  it("keeps the canonical evidence bridge behind authentication", async () => {
    const caller = appRouter.createCaller(createAnonymousContext());

    await expect(caller.emberSignal.getLocalEvidence()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
