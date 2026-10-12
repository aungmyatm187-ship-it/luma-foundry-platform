# Architecture

## Principle

**One rule set, many surfaces.** The governance rule — no clearance without evidence — must
hold identically whether it is reached by a human in the web app, an MCP client, a CI job,
or an agent. Duplicating the rule per surface is how products get "cleared" by accident.

So the rule lives in exactly one place and every surface is a thin adapter over it.

```
        web app        MCP client (Manus / OpenHands)      CI
            |                        |                     |
            v                        v                     v
      apps/api (tRPC)      packages/mcp-server         (tests)
            \                        /
             \                      /
              v                    v
        packages/core  — domain model + governance
        (pure rules; persistence via repository adapters)
```

## Layers

### `packages/core` — the rules

The domain-rule modules are pure and have no I/O. The package also owns the repository
abstraction and storage adapters, kept behind the domain boundary. It contains:

- `types.ts` — the domain model: `Goal`, `Product`, `WorkItem`, `Handoff`, `Decision`,
  `Evidence`, plus the status vocabularies.
- `governance.ts` — `REQUIRED_EVIDENCE`, `evaluateClearance`, `assertTransitionAllowed`.
  The single enforcement point for the clearance gate.
- `workspace.ts` — an in-memory `Workspace` with validated writes.
- `repository.ts` / `async-workspace.ts` — storage abstraction and async facade, with in-memory
  and Drizzle/Postgres repository implementations.
- `release-passport.ts` — a pure, portable export of product evidence coverage and clearance
  blockers. It reuses the evaluator and does not claim to verify referenced artefacts.

The governance check is a pure function, so a UI can preview "what is missing?" without side
effects. Storage adapters remain outside the rule evaluation path.

### `packages/mcp-server` — the agent surface

Wraps `core` in Model Context Protocol tools. Uses `McpServer.registerTool` with Zod schemas,
which the SDK converts to JSON Schema for clients. Every tool that can mutate state returns a
structured error rather than throwing across the transport.

`createServer(workspace)` is a factory so tests get an isolated server per case.

### `apps/api` — the web surface

A tRPC router mirroring the procedures the shipped `/workspace` app already calls
(`createGoal`, `createProduct`, `createWorkItem`, `createHandoff`, `createDecision`,
`snapshot`, plus `checkClearance` and `setProductStatus`). The fetch adapter means the same
router runs on Node, Vercel, Cloudflare Workers, or Render.

## The pipeline

```
Goal  ──▶  Product  ──▶  Work Item  ──▶  Handoff  ──▶  Decision
  │           │              │              │             │
outcome    what we sell   build/review   A → B        approve/decline
                                                    (stays open until resolved)
                                     │
                                     └──▶ Evidence ──▶ gates Product.status = 'cleared'
```

`Evidence` is the only thing that unlocks clearance. Work completing does not. A passing build
does not. A live URL does not.

The release passport makes that evidence legible across a handoff. It is a read-only snapshot;
it does not change the gate, fetch evidence references, or confer legal or cryptographic
assurance.

## Persistence

The synchronous `Workspace` and `InMemoryRepository` provide fast isolated local use and tests.
`AsyncWorkspace` supports the repository interface, including a Drizzle/Postgres adapter. The
shipped site already has matching tables (`collaborationGoals`, `collaborationProducts`,
`collaborationWorkItems`, `collaborationHandoffs`, `collaborationDecisions`). Production
database configuration and deployment remain environment-specific; storage adapters must not
duplicate or weaken the pure governance rules.

## Testing

Tests exercise real code paths:

- `core` tests call the real `Workspace` and the real `evaluateClearance`.
- `mcp-server` tests connect a real MCP `Client` to a real `McpServer` over the SDK's
  in-memory transport — actual JSON-RPC, not a stubbed call.
- `api` tests use tRPC's `createCaller`, the same procedure path the web app takes.

No mocks. If a rule breaks, a test breaks.
