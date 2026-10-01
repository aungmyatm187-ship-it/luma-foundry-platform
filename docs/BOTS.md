# Bots

The bot layer lets you drive the platform from a chat app. It is a front end
onto the workflow engine, not a second place where workflows live: every command
routes through the same `advance()` that enforces the gates.

## Why Telegram first

Slack needs a workspace admin to install an app, which is why it has been
blocked. Telegram needs nothing:

| | Telegram | Discord | Slack |
|---|---|---|---|
| Cost | Free, unlimited | Free | Free tier limited |
| Setup | Chat with BotFather, get a token | Register app, publish commands | Admin installs app |
| Approval needed | No | No | Yes |
| Webhook signature | Secret token header | Ed25519 | Signing secret |
| Reach in Myanmar | Dominant | Niche | Rare in-market |

Telegram is the primary surface for the Myanmar audience. Discord is supported
for team workspaces. Slack remains a supported adapter and will work the moment
a bot token is available.

## Getting a Telegram token

1. Open Telegram, message **@BotFather**.
2. Send `/newbot`, choose a name and a username ending in `bot`.
3. BotFather replies with a token like `123456:ABC-DEF...`.
4. Set it as `TELEGRAM_BOT_TOKEN`.

No approval, no billing, no waiting.

## Running

```bash
# Verify the token works
TELEGRAM_BOT_TOKEN=... node packages/gateway/dist/server-cli.js --check

# Run the server, and register the webhook when a public URL is set
TELEGRAM_BOT_TOKEN=... \
TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32) \
PUBLIC_URL=https://your-host/telegram \
ACTORS="telegram:12345=Aung:operate|build|design|review|evidence|deploy|decide" \
PORT=8080 \
node packages/gateway/dist/server-cli.js
```

`ACTORS` maps a platform user to capabilities. The format is
`platform:id=Name:cap1|cap2`, comma-separated. An unmapped user is treated as a
known user with no capabilities — every gated action is refused, which is the
intended default.

Capabilities: `design`, `build`, `review`, `evidence`, `operate`, `deploy`,
`decide`.

## Commands

| Command | What it does |
|---|---|
| `help` | List the functions |
| `catalogue` | List the workflows |
| `status` | Show open runs |
| `whoami` | Show the capabilities your account holds |
| `licence <route>` | Audit a product's typefaces for resale |
| `gates <route>` | Show what blocks the current stage |
| `release <route>` | Run the product-release workflow |
| `hero <route>` | Run the hero-asset workflow |
| `workshop <route>` | Run a workshop track |
| `deploy <route>` | Run the automation-deploy workflow |
| `evidence <route>` | Run the evidence-review workflow |

Example session:

```
you:  hero axiom-grid
bot:  Started *Hero asset production* for `axiom-grid` at `intake`.
      Run `run-abc-1`.
      Next: check `gates axiom-grid`.

you:  hero axiom-grid
bot:  `axiom-grid`: `intake` → *`design`* by Aung.
      Next: `gates axiom-grid`

you:  hero axiom-grid
bot:  `axiom-grid`: `design` → *`assets`* by Aung.

you:  hero axiom-grid
bot:  Blocked: `assets` requires recorded evidence: asset_licence
```

The last line is the point. The bot cannot advance the run, because the stage
requires a recorded asset licence that does not exist yet. There is no override
flag, in the bot or anywhere else.

## Adding a platform

An adapter translates a platform's wire format into a `BotCommand` and renders a
`BotReply` back. It contains no routing and no governance.

1. Write `packages/gateway/src/<platform>.ts` exporting `toCommand` and a send function.
2. Add a route in `server.ts` that verifies the platform's signature first.
3. Add tests for the signature check — that is the security boundary.

The gateway is unchanged, because the gateway is where the rules live.

## Security

These endpoints are public, so each one verifies its caller before trusting the
body:

- **Telegram** — the `X-Telegram-Bot-Api-Secret-Token` header must equal the
  secret given to `setWebhook`, compared in constant time.
- **Discord** — every interaction is verified with Ed25519 against the
  application's public key, over `timestamp + rawBody`.

An unverified request is rejected with 401 before any command is routed.

Secrets come from the environment and are never logged. A reply that fails
Telegram's MarkdownV2 parser is resent as plain text, so a formatting bug
degrades the styling rather than losing the message.
