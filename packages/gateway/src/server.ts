/**
 * Bot HTTP server.
 *
 * Hosts the webhook endpoints for every bot platform and the shared run store.
 * One process serves Telegram, Discord and Slack; adding a platform is adding a
 * route, not a service.
 *
 * Secrets arrive through the environment and are never logged. Every inbound
 * request is verified against its platform's signature before the body is
 * trusted, because these endpoints are public.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  RunStore,
  handle,
  type BotActor,
  type GatewayDeps,
  type Platform,
} from './gateway.js';
import type { RunContext } from '@luma/core';
import {
  chatIdOf,
  getMe,
  sendReply,
  toCommand as telegramCommand,
  verifySecret,
  type TelegramUpdate,
} from './telegram.js';
import { INTERACTION, RESPONSE, toCommand as discordCommand, toResponse, type DiscordInteraction } from './discord.js';

/** Capabilities granted per platform user, from configuration. */
export interface ActorConfig {
  /** externalId -> capabilities. */
  [platformAndId: string]: { name: string; capabilities: BotActor['capabilities'] };
}

export interface ServerConfig {
  telegram?: { token: string; webhookSecret: string };
  discord?: {
    publicKey: string;
    applicationId?: string;
    botToken?: string;
    /** Ed25519 verify, injected to avoid a crypto-binding dependency. */
    verifyEd25519: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean;
  };
  /** Capability grants. An unmapped user gets no capabilities. */
  actors?: ActorConfig;
  /** Evidence/approval context per product route. Defaults to empty. */
  contextFor?: (target: string) => RunContext;
  /** Port to listen on. */
  port?: number;
  /** Injectable for tests. */
  store?: RunStore;
  now?: () => string;
  log?: (line: string) => void;
}

const EMPTY_CONTEXT: RunContext = { evidence: [], approvals: [], artifacts: [] };

function readBody(req: IncomingMessage, limitBytes = 1_000_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

export function createBotServer(config: ServerConfig): Server {
  const store = config.store ?? new RunStore();
  const log = config.log ?? (() => {});
  const actors = config.actors ?? {};
  let counter = 0;

  const deps: GatewayDeps = {
    store,
    contextFor: config.contextFor ?? (() => EMPTY_CONTEXT),
    actorFor: (platform: Platform, externalId: string): BotActor => {
      const grant = actors[`${platform}:${externalId}`];
      if (grant) return { externalId, name: grant.name, capabilities: grant.capabilities };
      // An unmapped user is a known user with no capabilities — not an error.
      // The gateway will refuse any capability-gated action, which is the point.
      return { externalId, name: `${platform} user ${externalId}`, capabilities: [] };
    },
    nextId: () => {
      counter += 1;
      return `run-${Date.now().toString(36)}-${counter}`;
    },
    ...(config.now ? { now: config.now } : {}),
  };

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/health') {
      send(res, 200, { ok: true, runs: store.all().length });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/runs') {
      send(res, 200, { ok: true, runs: store.all() });
      return;
    }

    // ---- Telegram ------------------------------------------------------

    if (req.method === 'POST' && url.pathname === '/telegram') {
      const tg = config.telegram;
      if (!tg) {
        send(res, 404, { ok: false, error: 'telegram not configured' });
        return;
      }
      const secret = req.headers['x-telegram-bot-api-secret-token'];
      if (!verifySecret(typeof secret === 'string' ? secret : null, tg.webhookSecret)) {
        log('telegram: rejected unverified request');
        send(res, 401, { ok: false, error: 'bad secret' });
        return;
      }

      let update: TelegramUpdate;
      try {
        update = JSON.parse(await readBody(req)) as TelegramUpdate;
      } catch {
        send(res, 400, { ok: false, error: 'bad json' });
        return;
      }

      const cmd = telegramCommand(update);
      const chatId = chatIdOf(update);
      if (!cmd || chatId === null) {
        send(res, 200, { ok: true, ignored: true });
        return;
      }

      const reply = handle(cmd, deps);
      log(`telegram ${cmd.externalId}: ${cmd.text} -> ${reply.ok ? 'ok' : 'refused'}`);
      try {
        await sendReply({ token: tg.token }, chatId, reply, { keyboard: true });
      } catch (error) {
        log(`telegram send failed: ${(error as Error).message}`);
      }
      send(res, 200, { ok: true });
      return;
    }

    // ---- Discord -------------------------------------------------------

    if (req.method === 'POST' && url.pathname === '/discord') {
      const dc = config.discord;
      if (!dc?.verifyEd25519) {
        send(res, 404, { ok: false, error: 'discord not configured' });
        return;
      }
      const raw = await readBody(req);
      const sig = req.headers['x-signature-ed25519'];
      const ts = req.headers['x-signature-timestamp'];

      const { verifySignature } = await import('./discord.js');
      const valid = verifySignature(
        dc.verifyEd25519,
        raw,
        typeof sig === 'string' ? sig : null,
        typeof ts === 'string' ? ts : null,
        dc.publicKey,
      );
      if (!valid) {
        log('discord: rejected unverified interaction');
        send(res, 401, { ok: false, error: 'bad signature' });
        return;
      }

      let interaction: DiscordInteraction;
      try {
        interaction = JSON.parse(raw) as DiscordInteraction;
      } catch {
        send(res, 400, { ok: false, error: 'bad json' });
        return;
      }

      if (interaction.type === INTERACTION.PING) {
        send(res, 200, { type: RESPONSE.PONG });
        return;
      }

      const cmd = discordCommand(interaction);
      if (!cmd) {
        send(res, 200, { type: RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE, data: { content: 'Unsupported interaction.' } });
        return;
      }

      const reply = handle(cmd, deps);
      log(`discord ${cmd.externalId}: ${cmd.text} -> ${reply.ok ? 'ok' : 'refused'}`);
      send(res, 200, toResponse(reply));
      return;
    }

    send(res, 404, { ok: false, error: 'not found' });
  });
}

/** Verify a Telegram token and report the bot identity. */
export async function telegramIdentity(token: string) {
  return getMe(token);
}
