# Luma Foundry — AI Orchestration Handoff

**Prepared:** 2026-09-20  
**Owner:** Operator A  
**Audience:** Operator B / Master Brand Architect  
**Status:** Procedure and skill drafted; no production code, deployment, schedule, connector write, or repository mutation performed.

## Purpose

Luma Foundry needs a credit-efficient automation layer because the primary coding helper may become unavailable or lack sufficient project context. Operator A and Operator B remain the context owners. Helper LLMs perform only one bounded task at a time, return a structured artifact, and pass deterministic and human review gates before any merge, Drive write, or release action.

## Role elevation / operating model

Operator A is the technical orchestrator for architecture, source repositories, tests, checkpoints, deployment safety, and task decomposition. Operator B is the product/IP/data orchestrator for catalogue truth, Drive registers, provenance, notices, contributor records, and commercial handoff. A helper LLM is an implementation worker, not an approver or context owner.

## Credit-saving order

Prefer deterministic scripts for parsing, hashing, validation, secret scans, and tests. Use direct authenticated connectors for known records. Use Make or Zapier for stable connector-to-connector routing. Use a low-cost or built-in LLM for extraction/classification/short drafts. Use a stronger coding helper only for a small scoped implementation. Use a full Operator run only when context reconciliation, browser operation, multi-tool coordination, or material judgment is required.

## Connector inventory reviewed

The current session exposes Google Drive/Sheets/Gmail, Make, Zapier, workflow orchestration, GitHub through the project integration, WebDev/browser/media tools, and other specialist connectors. Exact connector identifiers and account/target IDs must be discovered before any execution; no connector action was run in this handoff.

## Safety boundaries

The pilot will not activate recurring schedules, auto-merge, auto-deploy, direct main pushes, public publishing, billing, DNS, credential changes, or destructive actions. A helper cannot widen its own scope, invent provenance/licence facts, or write directly to a live production path. Failed output goes to quarantine/review.

## First pilot recommendation

Start with one low-risk read → structured draft → deterministic validation → verified Drive handoff task. After two successful pilots, consider a manual trigger. Add recurring/event automation only after the owner approves target systems, cost budget, retry policy, rollback path, and notification behavior.

## Reusable skill

The reusable skill is `luma-ai-orchestration`. It contains the authority model, credit-saving routing rules, connector no-guess rules, code-worker workflow, safety gates, a connector reference, and a one-task helper card template.

**Commercial/IP status:** unchanged. This procedure does not grant commercial clearance to any Luma product.
