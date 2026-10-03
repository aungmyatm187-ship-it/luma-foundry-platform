import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = JSON.parse(await readFile(resolve(root, "data/products-current.json"), "utf8"));
const [headers, ...rows] = source.values;
const index = Object.fromEntries(headers.map((header, position) => [header, position]));

const requiredEvidence = [
  "Source repository / immutable commit",
  "Original design history",
  "Asset register and commercial licences",
  "Contributor assignment / work-for-hire record",
  "Dependency licence inventory and notices",
  "Qualified IP counsel review",
];

const liveProducts = rows
  .map((row) => Object.fromEntries(headers.map((header, position) => [header, row[position] || ""])))
  .filter((product) => product.status === "live");

const matrixRows = liveProducts.map((product) => ({
  product_id: product.product_id,
  product_name: product.product_name,
  category: product.category,
  shared_status: product.status,
  operator_owner: product.operator_owner,
  shared_source_field: product.source,
  hosted_preview_url: product.hosted_preview_url,
  public_url_host_check: new URL(product.hosted_preview_url).hostname === "lumafoundry-jx4veohg.manus.space" ? "Pass — Luma-hosted URL" : "Review — non-Luma URL",
  source_repository_immutable_commit: "Missing from accessible shared records",
  original_design_history: "Missing from accessible shared records",
  asset_register_and_commercial_licences: "Missing from accessible shared records",
  contributor_assignment_record: "Missing from accessible shared records",
  dependency_licence_inventory: "Missing from accessible shared records",
  qualified_ip_counsel_review: "Missing from accessible shared records",
  commercial_clearance: "Conditional / blocked pending evidence",
  next_action: "Operator A attaches the six required evidence records; owner/counsel reviews before commercial release",
}));

const report = {
  generated_at_utc: new Date().toISOString(),
  source_range: source.range,
  source_headers: headers,
  accessible_evidence_fields: ["product_id", "product_name", "category", "hosted_preview_url", "status", "operator_owner", "source", "updated_at_utc"],
  absent_provenance_fields: requiredEvidence,
  totals: {
    live_products: matrixRows.length,
    luma_hosted_public_urls: matrixRows.filter((item) => item.public_url_host_check === "Pass — Luma-hosted URL").length,
    products_with_complete_commercial_clearance_evidence: 0,
    products_blocked_pending_evidence: matrixRows.filter((item) => item.commercial_clearance === "Conditional / blocked pending evidence").length,
  },
  rows: matrixRows,
};

const sheetHeaders = [
  "Product ID",
  "Product name",
  "Category",
  "Shared status",
  "Operator owner",
  "Luma preview URL",
  "Public URL host",
  "Source repository / immutable commit",
  "Original design history",
  "Asset register / commercial licences",
  "Contributor assignment record",
  "Dependency licence inventory",
  "Qualified IP counsel review",
  "Commercial clearance",
  "Next action",
  "Shared source field",
];
const sheetValues = {
  majorDimension: "ROWS",
  values: [
    ["Luma Foundry — Operator A Commercial-Clearance Evidence Matrix"],
    ["Source snapshot", source.range, "Generated", report.generated_at_utc, "Current clearance", "0/50 complete — evidence collection required"],
    [],
    sheetHeaders,
    ...matrixRows.map((item) => [
      item.product_id,
      item.product_name,
      item.category,
      item.shared_status,
      item.operator_owner,
      item.hosted_preview_url,
      item.public_url_host_check,
      item.source_repository_immutable_commit,
      item.original_design_history,
      item.asset_register_and_commercial_licences,
      item.contributor_assignment_record,
      item.dependency_licence_inventory,
      item.qualified_ip_counsel_review,
      item.commercial_clearance,
      item.next_action,
      item.shared_source_field,
    ]),
  ],
};

await writeFile(resolve(root, "data/operator-a-evidence-matrix.json"), JSON.stringify(report, null, 2), "utf8");
await writeFile(resolve(root, "data/operator-a-evidence-matrix.sheet-values.json"), JSON.stringify(sheetValues), "utf8");
console.log(`Evidence matrix: ${report.totals.live_products} live products; ${report.totals.luma_hosted_public_urls} Luma-hosted URLs; ${report.totals.products_with_complete_commercial_clearance_evidence} complete; ${report.totals.products_blocked_pending_evidence} blocked pending evidence.`);
if (!matrixRows.length || report.totals.products_with_complete_commercial_clearance_evidence !== 0 || report.totals.products_blocked_pending_evidence !== matrixRows.length) process.exitCode = 1;
