import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = JSON.parse(await readFile(resolve(root, "data/products-current.json"), "utf8"));
const [headers, ...rows] = source.values;
const products = rows
  .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])))
  .filter((product) => product.status === "live");

const generatedAt = new Date().toISOString();
const titleRows = (title, purpose) => [
  [title],
  ["Purpose", purpose, "Generated", generatedAt, "Completion rule", "Do not mark verified until evidence matches the exact live release commit."],
  [],
];

const sourceHeaders = [
  "Product ID",
  "Product name",
  "Live preview URL",
  "Release version/tag",
  "Repository URL",
  "Immutable release commit/hash",
  "Source archive or read-only access link",
  "Original design-history link",
  "Contributor-rights record link",
  "Dependency lockfile/SBOM link",
  "Third-party notices link",
  "Recorded by",
  "Recorded at UTC",
  "Verification status",
  "Reviewer notes",
];

const sourceValues = {
  majorDimension: "ROWS",
  values: [
    ...titleRows(
      "Luma Foundry — Operator A Source Commit Register",
      "Connect each active public template to its exact repository state, source/design history, contributor rights, and dependency evidence."
    ),
    sourceHeaders,
    ...products.map((product) => [
      product.product_id,
      product.product_name,
      product.hosted_preview_url,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Pending evidence",
      "",
    ]),
  ],
};

const assetHeaders = [
  "Product ID",
  "Product name",
  "Asset ID / file path",
  "Asset type",
  "Product use/purpose",
  "Creator / rightsholder",
  "Source URL or creation record",
  "Licence / permission type",
  "Licence proof link",
  "Commercial use allowed",
  "Modification allowed",
  "Attribution required / exact text",
  "Territory / expiry / restrictions",
  "Linked release commit/hash",
  "Reviewed by",
  "Review status",
  "Reviewer notes",
];

const assetValues = {
  majorDimension: "ROWS",
  values: [
    ...titleRows(
      "Luma Foundry — Operator A Asset Licence Register",
      "Create one row per image, icon, illustration, video, audio item, texture, font, or other third-party asset used in a template. Duplicate product rows as needed."
    ),
    assetHeaders,
    ...products.map((product) => [
      product.product_id,
      product.product_name,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "Pending evidence",
      "",
    ]),
  ],
};

await mkdir(resolve(root, "data"), { recursive: true });
await writeFile(resolve(root, "data/operator-a-source-commit-register.sheet-values.json"), JSON.stringify(sourceValues), "utf8");
await writeFile(resolve(root, "data/operator-a-asset-licence-register.sheet-values.json"), JSON.stringify(assetValues), "utf8");
await writeFile(
  resolve(root, "data/operator-a-evidence-kit-manifest.json"),
  JSON.stringify(
    {
      generated_at_utc: generatedAt,
      product_count: products.length,
      source_register_rows: sourceValues.values.length,
      asset_register_starter_rows: assetValues.values.length,
      completion_boundary: "Starter rows are not proof. Operator A must add evidence and a reviewer must verify it against the exact release commit.",
    },
    null,
    2
  ),
  "utf8"
);

console.log(`Evidence kit prepared for ${products.length} live products.`);
if (products.length !== 50) process.exitCode = 1;
