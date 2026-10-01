# AGENTS.md

Repository memory for agents working on Luma Foundry Platform.

## What this is

An AI workshop/automation platform. Products move through
**Goal → Product → Work Item → Handoff → Decision**, gated by a hard evidence rule.

## Commands

```bash
npm install
npm run typecheck     # tsc -b — must pass
npm test              # vitest across all workspaces — must pass
npm run build         # must pass
npm run dev:mcp       # MCP server on stdio
npm run dev:api       # tRPC on http://localhost:3000/api/trpc
```

Run typecheck, test, and build before considering any change done. CI runs all three.

## Non-negotiable rules

1. **Never weaken the clearance gate.** `assertTransitionAllowed` in
   `packages/core/src/governance.ts` is the single enforcement point. A product may only
   become `cleared` when all eight required evidence kinds are recorded. Traceability
   evidence (`source_commit`, `dependency_sbom`) never implies clearance. If a change needs
   this relaxed, that is a design change requiring an owner decision — not a code edit.

2. **Keep the surfaces in agreement.** `packages/mcp-server` and `apps/api` are thin adapters
   over `packages/core`. Never reimplement a rule in an adapter. If the two surfaces can
   disagree about what "cleared" means, the foundation is broken.

3. **`packages/core` has no I/O.** No database, no network, no filesystem, no imports outside
   itself. This keeps the rules pure and testable.

4. **No mocks in tests.** Exercise real code paths — real `Workspace`, real MCP client over
   the SDK's in-memory transport, real tRPC caller.

5. **Never commit secrets.** `manus/out/` in the parent recovery workspace holds plaintext
   credentials the owner pasted into Manus chat; it is gitignored for that reason.

## Conventions

- TypeScript strict, ESM, `NodeNext` resolution. Relative imports need the `.js` extension.
- Zod for all input validation at the edges (MCP tool schemas, tRPC inputs).
- Domain vocabularies (statuses, roles, evidence kinds) live in `packages/core/src/types.ts`
  as `as const` arrays — derive union types from them, never retype the literals.
- Writes are validated: unknown goal/product ids are rejected, not silently accepted.
- Comments explain *why*, never restate the code.

## Architecture notes

- One rule set, many surfaces — see `docs/ARCHITECTURE.md`.
- Storage is in-memory by design; swap behind `Workspace` without touching rules.
- The shipped site already has matching Drizzle tables (`collaborationGoals`,
  `collaborationProducts`, `collaborationWorkItems`, `collaborationHandoffs`,
  `collaborationDecisions`) — that is the migration path.

## Working with Manus

Manus acts as `operator_a` (builds, records build evidence). OpenHands acts as `operator_b`
(reviews, records rights evidence, gates clearance; never edits product code). The owner
resolves decisions. Full protocol in `docs/COLLABORATION.md`.

## Background

Recovery and study of the original build:
`../PROJECT_RECONSTRUCTION.md` and `../SITE_AND_PRODUCT_STUDY.md`.
