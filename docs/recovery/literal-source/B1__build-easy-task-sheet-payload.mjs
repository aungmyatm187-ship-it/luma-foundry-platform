import fs from "node:fs";

const inputPath = "/home/ubuntu/luma-foundry-master-shop/EASY-TASK-REGISTER-LUMA.json";
const outputPath = "/home/ubuntu/luma-foundry-master-shop/tmp-gws-easy-task-values.json";
const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const headers = [
  "Task ID",
  "Operator",
  "Model Tier",
  "Priority",
  "Status",
  "Task",
  "Required Data",
  "Current Evidence",
  "Owner Action",
  "Safe Boundary",
  "Next Step",
  "Evidence Ref",
];

const rows = source.rows.map((row) => [
  row.task_id,
  row.operator,
  row.model_tier,
  row.priority,
  row.status,
  row.task,
  row.required_data,
  row.current_evidence,
  row.owner_action,
  row.safe_boundary,
  row.next_step,
  row.evidence_ref,
]);

const values = [
  ["Luma Foundry — Easy Task Register", "", "", "", "", "", "", "", "", "", "", ""],
  ["Scope: small, repeatable, low-risk tasks only; Operator A production and hosted demos are out of scope.", "", "", "", "", "", "", "", "", "", "", ""],
  ["Model tier: Manus 1.6 Live · Source checked: 2026-09-15 · Statuses are evidence-based and may be pending.", "", "", "", "", "", "", "", "", "", "", ""],
  headers,
  ...rows,
];

fs.writeFileSync(outputPath, JSON.stringify({ values }, null, 2) + "\n");
console.log(`Wrote ${rows.length} task rows to ${outputPath}`);
