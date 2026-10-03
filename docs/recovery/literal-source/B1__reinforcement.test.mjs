import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("state checkpoint preserves the current payment, sync, and source-of-truth boundaries", async () => {
  const checkpoint = JSON.parse(await readFile(new URL("op_b_state_checkpoint.json", root), "utf8"));
  assert.equal(checkpoint.source_of_truth.mapped_product_count, 50);
  assert.equal(checkpoint.source_of_truth.sync_mode, "manual read-only snapshot; real-time listener not configured");
  assert.equal(checkpoint.storefront.payment_state, "disconnected");
  assert.equal(checkpoint.guardrails.no_live_payment_or_webhook, true);
  assert.equal(checkpoint.guardrails.no_right_click_or_copy_blocking, true);
});

test("reinforcement documents preserve release controls and no-fabrication guardrails", async () => {
  const [architecture, checklist, hooks] = await Promise.all([
    readFile(new URL("AUTOMATION-ARCHITECTURE.md", root), "utf8"),
    readFile(new URL("AUDIT-CHECKLIST.md", root), "utf8"),
    readFile(new URL("HERO-HOOKS.md", root), "utf8"),
  ]);
  assert.match(architecture, /owner-reviewed release sync/i);
  assert.match(architecture, /event-driven/i);
  assert.match(checklist, /No invented reviews/i);
  assert.match(hooks, /Alternative 01/i);
  assert.match(hooks, /Alternative 02/i);
  assert.match(hooks, /Alternative 03/i);
});
