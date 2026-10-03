import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("current shared product snapshot lacks the evidence required for commercial IP clearance", async () => {
  const source = JSON.parse(await readFile(new URL("../data/products-current.json", import.meta.url), "utf8"));
  const [headers, ...rows] = source.values;
  const statusIndex = headers.indexOf("status");
  const liveCount = rows.filter((row) => row[statusIndex] === "live").length;
  const requiredMissingHeaders = [
    "source_repository_immutable_commit",
    "original_design_history",
    "asset_register_and_commercial_licences",
    "contributor_assignment_record",
    "dependency_licence_inventory",
    "qualified_ip_counsel_review",
  ];

  assert.equal(liveCount, 50);
  for (const header of requiredMissingHeaders) assert.equal(headers.includes(header), false);
});
