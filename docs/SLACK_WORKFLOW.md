# Slack Automation Workflow — Flexible, Multi-Function

**Goal:** one Slack workspace where the owner, Manus, and OpenHands drive *any* Luma Foundry
function — hero art, workshop tracks, evidence review, deployment — without the automation being
wired to one specific job.

**Design constraint:** flexible like water. Not a pipeline. A router over composable stages.

---

## Why a fixed pipeline would fail here

The platform is not one work. It is many functions over shared work: 50 workshop verticals, 25
hero assets, a 31-item evidence queue, deployments. If the Slack automation hardcodes
"build → review → deploy", then every new function needs new automation, and the workflows drift
apart until two of them disagree about what "reviewed" means.

So the automation does not contain workflows. It **routes to** them. The workflows live in
`packages/core/src/workflows.ts` as composable stages, and Slack is one more front end onto
them — alongside MCP and the tRPC API.

```
        Slack (owner, Manus, OpenHands)
                    │
                    ▼
        ┌───────────────────────┐
        │  luma-router          │  parse intent → pick workflow + stage
        └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  workflow engine      │  entry/exit gates, capabilities
        │  packages/core        │  (same rules as MCP + API)
        └───────────────────────┘
```

---

## Architecture

### 1. One router, not one bot per job

A single Slack app. A command names the **function**, not a script:

```
/luma hero        axiom-grid            → hero-asset workflow
/luma workshop    kinetic-mesh          → workshop-track workflow
/luma evidence    ember-signal          → evidence-review workflow
/luma deploy      <client>              → automation-deploy workflow
/luma release     <product>             → product-release workflow
/luma status                            → every open run, grouped by function
```

Adding a function = adding a workflow to the catalogue. **The Slack side does not change.**

### 2. Stages are shared vessels

Because `review`, `evidence`, and `clearance` are single shared stage objects (tested:
`workflow.test.ts` asserts the same `review` object appears in four workflows), a gate fixed once
is fixed everywhere. Slack inherits that automatically.

### 3. Actor capabilities, not roles, decide who can move

A stage declares the capabilities it needs (`design`, `build`, `review`, `evidence`, `operate`,
`deploy`, `decide`). An actor holds some. This is what lets a human, Manus, and OpenHands all use
the same command with different permissions — and why the same workflow can be driven from Slack,
MCP, or the API without modification.

| Actor | Capabilities |
|---|---|
| Owner | `decide`, `operate` |
| Manus (Operator A) | `design`, `build`, `operate` |
| OpenHands (Operator B) | `review`, `evidence`, `operate` |

The engine enforces this. A build actor cannot enter `clearance` — the test suite proves it.

### 4. Every move is recorded

`WorkflowRun.history` records who entered each stage, when, and with what capabilities. A Slack
action produces the same audit trail as an MCP call.

---

## Slack surface

### Slash commands

| Command | Effect |
|---|---|
| `/luma <function> <target>` | Start a run, or advance the target's current run |
| `/luma status` | All open runs by function, with each run's next reachable stages |
| `/luma gates <target>` | Exactly what is blocking the target, and who can clear it |
| `/luma whoami` | The capabilities your Slack account holds |

`/luma gates` is the important one. It answers "what is missing?" without mutating anything —
the same property `check_clearance` has on MCP.

### Channels

| Channel | Purpose |
|---|---|
| `#luma-ops` | All run traffic; approvals land here |
| `#luma-art` | Hero asset workflow only |
| `#luma-evidence` | Evidence review queue |
| `#luma-alerts` | Blocked runs and gate failures |

Channel is a **filter, not a boundary**. A run is the same run whichever channel it was started
in — so moving a conversation between channels never loses state.

### Approval via Block Kit

Gates needing owner approval post interactive buttons:

```
┌──────────────────────────────────────────┐
│ Approval needed — publish                │
│ Product: Axiom Grid                      │
│ Gate:   Owner approval to publish        │
│ Blockers: none                           │
│                                          │
│  [ Approve ]   [ Decline ]   [ Ask why ] │
└──────────────────────────────────────────┘
```

The button resolves the `approval` gate in the run context. It does **not** set product status
directly — that still goes through `assertTransitionAllowed`. Two independent gates, deliberately.

---

## Flexibility mechanisms

Four things make this water rather than a pipe:

1. **Composable stages.** New function = new ordering of existing stages. No engine change.
2. **Declarative gates.** A gate is data (`{kind, label}`), so a new gate is a data edit, not code.
3. **Capability-based entry.** Permissions are per-actor, not per-command — so adding an actor
   (a new agent, a contractor) does not mean rewriting workflows.
4. **One rule set, many surfaces.** Slack, MCP, and tRPC all call the same engine. A rule fixed
   in `core` is fixed in all three at once.

---

## What this needs to run

| Need | Status | Owner action |
|---|---|---|
| `SLACK_BOT_TOKEN` (`xoxb-`) with `chat:write`, `commands`, `channels:history` | **missing** | create a Slack app, install, add secret |
| `SLACK_SIGNING_SECRET` | **missing** | from the Slack app config |
| Channel ids for the four channels | **missing** | create channels |
| OpenHands automation to host the router | available | deploy once token exists |
| Workflow engine | **done** | `packages/core/src/workflow.ts`, 18 tests |

### On the token you tried before

The token supplied earlier was an **app-configuration token** (`xoxe.xoxp-1-`) with only
`identify`, `app_configurations:read`, `app_configurations:write`. It authenticated against team
"Luma Foundry" (`lumafoundry.slack.com`) but **cannot read channels or post messages** —
`missing_scope` on every conversation call.

A bot token is a different thing. What is needed:

1. api.slack.com/apps → Create New App (from scratch), workspace `lumafoundry.slack.com`
2. **OAuth & Permissions** → Bot Token Scopes: `chat:write`, `commands`, `channels:read`,
   `channels:history`, `users:read`
3. **Install to Workspace** → copy the **Bot User OAuth Token** (`xoxb-…`)
4. **Basic Information** → copy the **Signing Secret**
5. Add both as conversation secrets: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`

---

## How it stays governed

The risk with a flexible router is that flexibility becomes a way around the rules. It does not
here, for one reason: **the router cannot bypass the engine.** Every advance calls `advance()`,
which evaluates the current stage's gates and the target stage's capabilities. There is no
"force" flag.

So a Slack command can start any function and move work along — and still cannot clear a product
without evidence, cannot publish without owner approval, and cannot deploy without sign-off.

---

## What I need from you

1. **The bot token and signing secret** (steps above). Without these, nothing in Slack runs.
2. **Channel names** — confirm the four, or tell me your preferred set.
3. **Which functions to wire first.** My suggestion: `hero` and `evidence` — they map to the two
   concrete problems already measured (25 missing heroes, 31 unreviewed evidence items).
4. **Who is `owner` in Slack** — your Slack user id, so approvals are attributed correctly.
