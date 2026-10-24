# Ember Signal — First Productization Task Card

**Task ID:** `TASK-20260923-EMBER-FIRST-PRODUCT-001`

**Owner:** Operator A  
**Product reviewer:** Operator B  
**Product:** Ember Signal — Signals to Evidence  
**Source repository:** `https://github.com/highfive251677-wq/ember-lite`  
**Source commit inspected:** `2bb64e184c5618cf5d7fef2f4755975b6041b535`  
**Luma project:** `/home/ubuntu/luma-foundry`

## Objective

Turn the existing local-first Ember Signal core into a reproducible, installable, reviewable first-product release while preserving its evidence-first and human-in-control boundaries. Connect the release identity to the existing Luma Ember Signal evidence adapter without claiming commercial clearance.

## Phase-one scope

1. Add standard Python packaging metadata and a stable `ember-signal` CLI entry point.
2. Add a deterministic product/release verification command that checks identity, required runtime modules, evidence-chain requirements, and source release identity.
3. Add dependency and smoke tests using the standard library; do not require pytest to run the baseline gate.
4. Add a release manifest that records the upstream commit, product identity, MIT source status, runtime boundary, and explicit commercial/IP pending status.
5. Add documentation for local installation, verification, evidence export boundary, and the Luma adapter contract.
6. Produce a branch and reviewable PR; do not merge, deploy, change DNS, activate payment, or enable recurring automation in this phase.

## Explicit non-goals

Do not copy Python source into the Luma Node application. Do not expose API keys or private data. Do not change the Luma database schema or public route in this phase. Do not mark the product commercially cleared. Do not activate auto-deploy, recurring sync, checkout, or webhook writes.

## Acceptance gates

- `python -m unittest discover -s tests -v` passes.
- `python -m compileall -q .` passes.
- `python scripts/verify_release.py --json` returns a machine-readable PASS result for the checked source tree.
- `pip install -e . --no-deps` succeeds in an isolated environment.
- `ember-signal verify --json` returns PASS after installation.
- No secret-like literals are introduced.
- Diff is limited to packaging, verification, tests, manifest, and documentation.
- Commercial/IP status remains `PENDING — evidence incomplete`.

## Connector/workflow boundary

GitHub is used for branch/PR and immutable source identity. Google Drive/Sheets is used only after deterministic validation for the handoff artifact. Make remains manual-only and read-only for Render verification until Operator B confirms a Product ID and destination mapping. Render deployment is a later owner-reviewed phase.

## Review gates

Operator A: technical correctness, tests, package behavior, security, and release identity.  
Operator B: catalogue/product naming, Drive register mapping, provenance wording, and commercial/IP boundary.

## Rollback

Quarantine failed patches; do not modify Luma production files or live evidence data. Revert the dedicated branch or close the PR if any gate fails.

**Status:** `RUNNING — isolated implementation`
