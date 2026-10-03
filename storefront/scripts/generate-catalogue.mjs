import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "data/products-current.json");
const outputPath = resolve(root, "catalogue.js");

const collections = {
  systems: new Set([
    "AI Infrastructure",
    "Enterprise Agent Orchestration",
    "No-Code Automation",
    "Care-Operations AI",
    "Edge AI Hardware",
    "AI Governance and Compliance",
    "Conversational AI for Service Teams",
    "Generative Brand Platform",
  ]),
  insight: new Set(["Research Intelligence", "CFO Intelligence"]),
  luxury: new Set([
    "Editorial Fashion Portfolio",
    "Fine Jewellery House",
    "Premium Skin Studio",
    "Couture Bridal Atelier",
    "Niche Fragrance Brand",
    "Floral Studio",
    "Independent Watchmaker",
    "Art and Object Gallery",
    "Design-Led Eyewear",
    "Coastal Wellness Retreat",
    "Botanical Personal Care",
  ]),
  spatial: new Set([
    "Contemporary Architecture Practice",
    "Luxury Property Brokerage",
    "Boutique Hotel",
    "High-End Residential Interiors",
    "Architectural Lighting",
    "Private Event Venue",
    "Landscape Architecture Studio",
    "Urban Mixed-Use Development",
    "Premium Home Furnishings",
    "Design Cabins and Escapes",
    "Design Tools for Architects",
    "Urban Strategy and Place Branding",
    "Destination Wedding Planning",
  ]),
  objects: new Set([
    "Artful Homewares",
    "Specialty Coffee Subscription",
    "Premium Running Apparel",
    "High-Fidelity Speakers",
    "Elevated Pet Goods",
    "Fine Food and Table Goods",
    "Travel Accessories",
    "Considered Children’s Design",
  ]),
  practice: new Set([
    "Brand and Digital Agency",
    "Commercial Production Studio",
    "Modern Legal Advisory",
    "Premium Creative Education",
    "Strategy and Transformation Consultancy",
    "Sonic Identity Studio",
    "Culture and Event Experience Studio",
    "Executive Creative Search",
  ]),
};

const firstBatchDetails = {
  "prd-axiom-grid": {
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/axiom-grid-hero_46c3b0f8.png",
    direction: "A dark infrastructure narrative for teams that need a clearer technical point of view.",
  },
  "prd-selene-agents": {
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/selene-agents-hero_9dd8b039.png",
    direction: "A quiet editorial system for work that still needs human judgement at its centre.",
  },
  "prd-kinetic-mesh": {
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/kinetic-mesh-hero_682e14df.png",
    direction: "An industrial product direction for repeatable work that keeps moving with intent.",
  },
  "prd-lattice-labs": {
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/lattice-labs-hero_587c9d31.png",
    direction: "A focused research direction for organisations that lead with evidence before action.",
  },
  "prd-orbital-ledger": {
    imageUrl: "https://lumafoundry-jx4veohg.manus.space/manus-storage/orbital-ledger-hero_d99df92d.png",
    direction: "A composed executive narrative for financial planning, priorities, and the next horizon.",
  },
};

const toneByCollection = {
  systems: ["signal-blue", "lilac", "amber"],
  insight: ["violet", "paper"],
  luxury: ["paper", "violet", "amber"],
  spatial: ["signal-blue", "paper", "lilac"],
  objects: ["amber", "paper", "violet"],
  practice: ["lilac", "signal-blue", "paper"],
};

function collectionFor(category) {
  for (const [collection, allowedCategories] of Object.entries(collections)) {
    if (allowedCategories.has(category)) return collection;
  }
  throw new Error(`No buyer-intent collection configured for category: ${category}`);
}

function productDirection(category) {
  return `An original ${category} direction. Explore the live demo to evaluate its visual language and flow.`;
}

function renderModule(products, syncedAtUtc) {
  const contents = JSON.stringify(products, null, 2);
  return `/**
 * Read-only catalogue snapshot generated from the Luma Foundry shared Google
 * Sheet (Products tab). Do not edit product identity or demo URLs here without
 * updating the source-of-truth sheet first.
 */
export const catalogueMeta = {
  source: "Luma Foundry — Operator Sync / Products",
  goalId: "goal-factory-50",
  syncedAtUtc: ${JSON.stringify(syncedAtUtc)},
  activeTemplateCount: ${products.length},
  paymentState: "disconnected",
  syncMode: "manual read-only snapshot",
};

export const products = ${contents};
`;
}

const payload = JSON.parse(await readFile(sourcePath, "utf8"));
const [headers, ...rows] = payload.values;
const column = Object.fromEntries(headers.map((header, index) => [header, index]));
const activeRows = rows.filter((row) => row[column.status] === "live");

const products = activeRows.map((row, index) => {
  const id = row[column.product_id];
  const category = row[column.category];
  const collection = collectionFor(category);
  const firstBatch = firstBatchDetails[id] || {};
  return {
    id,
    index: String(index + 1).padStart(2, "0"),
    name: row[column.product_name],
    category,
    collection,
    previewUrl: row[column.hosted_preview_url],
    imageUrl: firstBatch.imageUrl || null,
    direction: firstBatch.direction || productDirection(category),
    tone: toneByCollection[collection][index % toneByCollection[collection].length],
    releaseState: "Live preview / checkout offline",
  };
});

const syncedAtUtc = activeRows.map((row) => row[column.updated_at_utc]).sort().at(-1);
await writeFile(outputPath, renderModule(products, syncedAtUtc), "utf8");
console.log(`Generated ${products.length} live catalogue records from ${sourcePath}`);
