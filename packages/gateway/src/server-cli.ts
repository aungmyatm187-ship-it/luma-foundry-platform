#!/usr/bin/env node
/**
 * Bot launcher.
 *
 * Starts the gateway server and, when a public URL is supplied, registers the
 * Telegram webhook so updates are pushed to it. Secrets are read from the
 * environment and never printed.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
 *   PUBLIC_URL=https://your-host/telegram \
 *   node dist/server-cli.js
 *
 *   node dist/server-cli.js --check      # verify the token, then exit
 *   node dist/server-cli.js --runs       # print open runs, then exit
 */
import { verifyEd25519 } from './ed25519.js';
import { RunStore, handle } from './gateway.js';
import { createBotServer, telegramIdentity, type ActorConfig } from './server.js';
import { setWebhook } from './telegram.js';
import type { Capability } from '@luma/core';

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);

const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const publicUrl = process.env.PUBLIC_URL ?? '';
const port = Number(process.env.PORT ?? 8080);

/**
 * Capability grants, as `platform:id=name:cap1|cap2` in ACTORS.
 *
 * `=` separates the actor key from its name and capabilities, because `:` is
 * already used inside the key (`telegram:42`).
 */
function parseActors(spec: string | undefined): ActorConfig {
  const actors: ActorConfig = {};
  if (!spec) return actors;
  for (const entry of spec.split(',')) {
    const [key, rest] = entry.split('=');
    if (!key) continue;
    const [name, caps] = (rest ?? '').split(':');
    actors[key.trim()] = {
      name: (name || key).trim(),
      capabilities: (caps ?? '').split('|').filter(Boolean) as Capability[],
    };
  }
  return actors;
}

async function main(): Promise<void> {
  if (has('--check')) {
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN is not set.');
      process.exit(1);
    }
    const me = await telegramIdentity(token);
    if (me.ok) {
      console.log(`Bot is live: @${me.username} (id ${me.id})`);
      process.exit(0);
    }
    console.error('Token rejected by Telegram.');
    process.exit(1);
  }

  if (has('--runs')) {
    const store = new RunStore();
    console.log(JSON.stringify(store.all(), null, 2));
    process.exit(0);
  }

  const store = new RunStore();
  const server = createBotServer({
    store,
    ...(token && webhookSecret ? { telegram: { token, webhookSecret } } : {}),
    ...(process.env.DISCORD_PUBLIC_KEY
      ? {
          discord: {
            publicKey: process.env.DISCORD_PUBLIC_KEY,
            verifyEd25519,
            ...(process.env.DISCORD_APPLICATION_ID
              ? { applicationId: process.env.DISCORD_APPLICATION_ID }
              : {}),
            ...(process.env.DISCORD_BOT_TOKEN ? { botToken: process.env.DISCORD_BOT_TOKEN } : {}),
          },
        }
      : {}),
    actors: parseActors(process.env.ACTORS),
    log: (line) => console.log(`[gateway] ${line}`),
  });

  server.listen(port, () => {
    console.log(`[gateway] listening on :${port}`);
    console.log(`[gateway] health: http://localhost:${port}/health`);
  });

  if (token && publicUrl && webhookSecret) {
    const res = await setWebhook(token, publicUrl, webhookSecret);
    console.log(`[gateway] webhook registration: ${res.ok ? 'ok' : `failed (HTTP ${res.status})`}`);
  } else if (token && !publicUrl) {
    console.log('[gateway] PUBLIC_URL not set — webhook not registered. Use long polling or set it.');
  }

  // A demo command so a fresh start can be exercised without a chat platform.
  if (has('--demo')) {
    const reply = handle(
      { platform: 'cli', externalId: 'demo', text: 'help' },
      {
        store,
        contextFor: () => ({ evidence: [], approvals: [], artifacts: [] }),
        actorFor: () => ({ externalId: 'demo', name: 'Demo', capabilities: ['operate', 'build'] }),
        nextId: () => 'run-demo',
      },
    );
    console.log(`\n[demo] ${reply.text}\n`);
  }
}

main().catch((error: unknown) => {
  console.error(`[gateway] fatal: ${(error as Error).message}`);
  process.exit(1);
});
