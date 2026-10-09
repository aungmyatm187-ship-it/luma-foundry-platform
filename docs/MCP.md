# MCP

The platform exposes itself as a **Model Context Protocol** server, so any MCP client —
Manus, OpenHands, Claude, an IDE, a CI job — can drive the same evidence-gated pipeline.

## Transport

**stdio** is the default and what `npm run dev:mcp` starts. Use it when the server runs
alongside the client on the same machine.

For a hosted, multi-tenant deployment, use **Streamable HTTP**. That is the current
recommended transport for remote MCP servers: it supports streaming responses, standard HTTP
auth, and stateless per-request handling that sits behind a load balancer. Two things matter
when you make that move:

- **Broker credentials per tenant.** Never hand a long-lived secret to a model. Store tenant
  credentials server-side and resolve them at call time.
- **Isolate execution per tenant.** One tenant's tool call must not be able to observe
  another's workspace. Today `Workspace` is process-local, which is isolation by construction;
  a hosted deployment must keep that property explicitly.

## Tools

Sixteen tools, grouped by intent.

**Read**

| Tool | Purpose |
|---|---|
| `snapshot` | Full workspace state |
| `check_clearance` | Whether a product has earned clearance, and what is missing |
| `evidence_review_packet` | Immutable point-in-time record checklist with expected producer class, coverage and blockers; explicitly not an approval |

**Goal & product**

| Tool | Purpose |
|---|---|
| `create_goal` | Create an outcome |
| `create_product` | Add a product to a goal (starts `concept`) |
| `set_product_status` | Change status — `cleared` checks required evidence kinds, but not workflow owner approval |

**Work**

| Tool | Purpose |
|---|---|
| `create_work_item` | Create and assign build/review work |
| `update_work_item_status` | Move work through its lifecycle |
| `create_handoff` | Record a handoff between roles |

**Decision & evidence**

| Tool | Purpose |
|---|---|
| `create_decision` | Raise a decision requiring explicit resolution |
| `update_decision_status` | Approve, decline, or defer |
| `record_evidence` | Attach release evidence to a product |

**Workflow**

| Tool | Purpose |
|---|---|
| `list_workflows` | Discover workflow stages and gates |
| `start_workflow` | Start a workflow run |
| `advance_workflow` | Move a run through enforced gates |
| `workflow_gates` | Read current blockers and next reachable stages |

## The correct order of operations

Use the packet to understand which evidence record types are present, then inspect the
references and obtain the required human decision through the clearance workflow. A complete
packet is not clearance authorization:

```
evidence_review_packet  →  record_evidence (for missing kinds)  →  human reference review  →  clearance workflow / owner approval
```

If clearance is attempted too early the tool returns a structured error naming the missing
kinds — not an exception across the transport:

```json
{ "error": "Product prd-0001 cannot be marked 'cleared'. Missing required evidence: asset_licence. ..." }
```

Both `check_clearance` and `evidence_review_packet` are pure reads. The packet exposes each
required kind, the expected producer class, records currently returned by the repository, and
an unambiguous latest record when timestamps permit. Stored recorder-role labels are not
independently authenticated; evidence contents and legal sufficiency are not assessed. It
reports `requiredRecordsComplete`, not readiness to clear. The clearance workflow separately
requires owner approval; note that the direct `set_product_status` guard currently checks only
evidence-kind presence and does not enforce that workflow approval.

## Client configuration

```json
{
  "mcpServers": {
    "luma-foundry": {
      "command": "node",
      "args": ["/absolute/path/to/luma-foundry-platform/packages/mcp-server/dist/index.js"]
    }
  }
}
```

Build first (`npm run build`), or point `command` at `npx tsx src/index.ts` for development.

## Verify it by hand

```bash
cat > /tmp/probe.jsonl <<'EOF'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0"}}}
{"jsonrpc":"2.0","method":"notifications/initialized"}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
EOF
node packages/mcp-server/dist/index.js < /tmp/probe.jsonl
```

CI runs this same probe on every push, so a broken handshake fails the build.

## Spec baseline

Built against MCP SDK `1.31.x`. The server declares protocol version `2025-06-18` during
initialization and negotiates with the client, which keeps it compatible with current clients
while the spec continues to evolve.
