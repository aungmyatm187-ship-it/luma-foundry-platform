import { z } from "zod";
import { invokeLLM } from "../_core/llm";
import { protectedProcedure, router } from "../_core/trpc";
import { readCanonicalEmberSignalSource } from "../emberSignalSource";

export const emberSignalBriefInput = z.object({
  campaignName: z.string().trim().min(2).max(120),
  audience: z.string().trim().min(8).max(700),
  marketSignals: z.string().trim().min(8).max(2_500),
  desiredOutcome: z.string().trim().min(8).max(700),
  channels: z
    .array(z.enum(["email", "social", "web", "events", "paid-media"]))
    .min(1)
    .max(5),
});

export const emberSignalBriefOutput = z.object({
  coreTension: z.string().min(1).max(500),
  campaignThesis: z.string().min(1).max(700),
  recommendedMove: z.string().min(1).max(700),
  proofPoints: z.array(z.string().min(1).max(280)).min(2).max(4),
  nextQuestion: z.string().min(1).max(400),
});

const outputSchema = {
  name: "ember_signal_campaign_brief",
  strict: true,
  schema: {
    type: "object",
    properties: {
      coreTension: { type: "string" },
      campaignThesis: { type: "string" },
      recommendedMove: { type: "string" },
      proofPoints: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
      nextQuestion: { type: "string" },
    },
    required: ["coreTension", "campaignThesis", "recommendedMove", "proofPoints", "nextQuestion"],
    additionalProperties: false,
  },
} as const;

const buildPrompt = (input: z.infer<typeof emberSignalBriefInput>) =>
  [
    `Campaign: ${input.campaignName}`,
    `Audience: ${input.audience}`,
    `Market signals: ${input.marketSignals}`,
    `Desired outcome: ${input.desiredOutcome}`,
    `Channels: ${input.channels.join(", ")}`,
  ].join("\n");

export const emberSignalRouter = router({
  // Kept under the existing procedure name to preserve the client contract.
  // The response now uses the same validated Render-first source and bounded
  // local fallback as the public /api/signals endpoint.
  getLocalEvidence: protectedProcedure.query(() => readCanonicalEmberSignalSource()),

  buildCampaignBrief: protectedProcedure
    .input(emberSignalBriefInput)
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are Ember Signal, a disciplined campaign-intelligence strategist. Turn audience language and market evidence into a concise, evidence-led campaign brief. Do not invent research, statistics, customer quotes, or proof. If evidence is thin, say what must be verified. Return JSON only.",
          },
          { role: "user", content: buildPrompt(input) },
        ],
        responseFormat: { type: "json_schema", json_schema: outputSchema },
      });

      const content = response.choices[0]?.message.content;
      if (typeof content !== "string") {
        throw new Error("Ember Signal returned no structured brief");
      }

      const brief = emberSignalBriefOutput.parse(JSON.parse(content));

      return {
        brief,
        usage: response.usage ?? null,
        model: response.model,
        requestId: response.id,
      };
    }),
});
