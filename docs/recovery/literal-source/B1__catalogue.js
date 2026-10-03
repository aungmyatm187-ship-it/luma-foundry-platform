/**
 * Read-only catalogue snapshot generated from the Luma Foundry shared Google
 * Sheet (Products tab) on 2026-08-27. Do not edit product identity or demo
 * URLs here without updating the source-of-truth sheet first.
 */
export const catalogueMeta = {
  source: "Luma Foundry — Operator Sync / Products",
  goalId: "goal-batch-01",
  syncedAtUtc: "2026-08-27T02:05:00Z",
  activeTemplateCount: 5,
  paymentState: "disconnected",
};

export const products = [
  {
    id: "prd-axiom-grid",
    index: "01",
    name: "Axiom Grid",
    category: "AI Infrastructure",
    collection: "systems",
    previewUrl: "https://lumafoundry-jx4veohg.manus.space/axiom-grid",
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/axiom-grid-hero_46c3b0f8.png",
    direction: "A dark infrastructure narrative for teams that need a clearer technical point of view.",
    tone: "signal-blue",
  },
  {
    id: "prd-selene-agents",
    index: "02",
    name: "Selene Agents",
    category: "Enterprise Agent Orchestration",
    collection: "systems",
    previewUrl: "https://lumafoundry-jx4veohg.manus.space/selene-agents",
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/selene-agents-hero_9dd8b039.png",
    direction: "A quiet editorial system for work that still needs human judgement at its centre.",
    tone: "lilac",
  },
  {
    id: "prd-kinetic-mesh",
    index: "03",
    name: "Kinetic Mesh",
    category: "No-Code Automation",
    collection: "systems",
    previewUrl: "https://lumafoundry-jx4veohg.manus.space/kinetic-mesh",
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/kinetic-mesh-hero_682e14df.png",
    direction: "An industrial product direction for repeatable work that keeps moving with intent.",
    tone: "amber",
  },
  {
    id: "prd-lattice-labs",
    index: "04",
    name: "Lattice Labs",
    category: "Research Intelligence",
    collection: "research",
    previewUrl: "https://lumafoundry-jx4veohg.manus.space/lattice-labs",
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/lattice-labs-hero_587c9d31.png",
    direction: "A focused research direction for organisations that lead with evidence before action.",
    tone: "violet",
  },
  {
    id: "prd-orbital-ledger",
    index: "05",
    name: "Orbital Ledger",
    category: "CFO Intelligence",
    collection: "leadership",
    previewUrl: "https://lumafoundry-jx4veohg.manus.space/orbital-ledger",
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/orbital-ledger-hero_d99df92d.png",
    direction: "A composed executive narrative for financial planning, priorities, and the next horizon.",
    tone: "paper",
  },
];
