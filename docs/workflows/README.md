# Staged workflows

These files belong in `.github/workflows/`. They are staged here because the
credential used to seed this repository lacks the GitHub App `workflows`
permission, so writes to `.github/workflows/` are refused with 403.

To activate them, move each file into `.github/workflows/` (a user or app with
`workflows: write` can do this), or add them through the GitHub web UI.

| Staged file | Belongs at |
|---|---|
| `docs/workflows/ci.yml` | `.github/workflows/ci.yml` |
| `docs/workflows/agent-review.yml` | `.github/workflows/agent-review.yml` |

Both have been validated locally: `ci.yml`'s sequence (install → typecheck → test
→ build → MCP handshake probe) passes on the current tree.
