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

Eleven tools, grouped by intent.

**Read**

| Tool | Purpose |
|---|---|
| `snapshot` | Full workspace state |
| `check_clearance` | Whether a product has earned clearance, and what is missing |

**Goal & product**

| Tool | Purpose |
|---|---|
| `create_goal` | Create an outcome |
| `create_product` | Add a product to a goal (starts `concept`) |
| `set_product_status` | Change status — **`cleared` is guarded** |

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

## The correct order of operations

An agent must never call `set_product_status` with `cleared` blind. The intended sequence:

```
check_clearance  →  record_evidence (for each missing kind)  →  check_clearance  →  set_product_status
```

If clearance is attempted too early the tool returns a structured error naming the missing
kinds — not an exception across the transport:

```json
{ "error": "Product prd-0001 cannot be marked 'cleared'. Missing required evidence: asset_licence. ..." }
```

`check_clearance` is a pure read. Call it as often as needed; it never mutates.

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
