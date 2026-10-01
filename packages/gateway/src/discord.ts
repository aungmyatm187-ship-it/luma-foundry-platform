/**
 * Discord adapter.
 *
 * Discord is the secondary surface: useful for a team workspace, and its slash
 * commands render structured options well. It is more work than Telegram — an
 * application must be registered, commands published, and every interaction
 * verified with Ed25519 — so it comes after Telegram, not before.
 *
 * As with Telegram, this file holds translation only. Routing and governance
 * live in gateway.ts.
 */
import type { BotCommand, BotReply, Platform } from './gateway.js';

const PLATFORM: Platform = 'discord';

/** Discord interaction types. */
export const INTERACTION = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

/** Discord callback types. */
export const RESPONSE = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

export interface DiscordInteraction {
  id: string;
  type: number;
  data?: {
    name: string;
    options?: Array<{ name: string; value: string | number | boolean }>;
  };
  member?: { user?: { id: string; username?: string } };
  user?: { id: string; username?: string };
}

/** Reduce a Discord slash-command interaction to a gateway command. */
export function toCommand(interaction: DiscordInteraction): BotCommand | null {
  if (interaction.type !== INTERACTION.APPLICATION_COMMAND || !interaction.data) return null;

  const user = interaction.member?.user ?? interaction.user;
  if (!user) return null;

  const target = interaction.data.options?.find((o) => o.name === 'target')?.value;
  const text = target ? `${interaction.data.name} ${String(target)}` : interaction.data.name;

  return { platform: PLATFORM, externalId: user.id, text };
}

/** Render a gateway reply as a Discord interaction response. */
export function toResponse(reply: BotReply): {
  type: number;
  data: { content: string; flags?: number };
} {
  // Discord caps message content at 2000 characters.
  const content = reply.text.length > 2000 ? `${reply.text.slice(0, 1990)}…` : reply.text;
  return { type: RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE, data: { content } };
}

/** Convert a gateway reply into components (buttons) for the suggested commands. */
export function toComponents(reply: BotReply): unknown[] | undefined {
  if (!reply.suggestions?.length) return undefined;
  return [
    {
      type: 1,
      components: reply.suggestions.slice(0, 5).map((s) => ({
        type: 2,
        style: 2,
        label: s.slice(0, 80),
        custom_id: `cmd:${s.slice(0, 80)}`,
      })),
    },
  ];
}

/**
 * Verify a Discord interaction signature (Ed25519).
 *
 * Discord signs every interaction with the application's public key. An
 * unverified interaction must be rejected before the body is trusted — the
 * endpoint is public, so anyone can POST to it.
 *
 * `verify` is injected so this module stays free of a hard dependency on a
 * specific crypto binding; the server passes a real Ed25519 verifier.
 */
export function verifySignature(
  verify: (message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array) => boolean,
  rawBody: string,
  signatureHex: string | null | undefined,
  timestamp: string | null | undefined,
  publicKeyHex: string,
): boolean {
  if (!signatureHex || !timestamp || !publicKeyHex) return false;
  try {
    const message = new TextEncoder().encode(timestamp + rawBody);
    return verify(message, hexToBytes(signatureHex), hexToBytes(publicKeyHex));
  } catch {
    return false;
  }
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * The slash-command definitions to publish to Discord.
 *
 * One command per workflow verb, plus the read-only ones, each taking an
 * optional product route.
 */
export const COMMANDS = [
  { name: 'help', description: 'How to use the Luma Foundry bot' },
  { name: 'catalogue', description: 'List the platform workflows' },
  { name: 'status', description: 'Show open workflow runs' },
  { name: 'whoami', description: 'Show the capabilities your account holds' },
  {
    name: 'licence',
    description: 'Audit a product’s typefaces for resale safety',
    options: [{ name: 'target', description: 'Product route, e.g. axiom-grid', type: 3, required: true }],
  },
  {
    name: 'gates',
    description: 'Show what blocks the current stage',
    options: [{ name: 'target', description: 'Product route', type: 3, required: true }],
  },
  ...[
    ['release', 'Run the product release workflow'],
    ['hero', 'Run the hero asset workflow'],
    ['workshop', 'Run a workshop track'],
    ['deploy', 'Run the automation deploy workflow'],
    ['evidence', 'Run the evidence review workflow'],
  ].map(([name, description]) => ({
    name: name!,
    description: description!,
    options: [{ name: 'target', description: 'Product route', type: 3, required: true }],
  })),
] as const;

/** Register slash commands with Discord. */
export async function registerCommands(
  applicationId: string,
  botToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number }> {
  const res = await fetchImpl(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
    method: 'PUT',
    headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(COMMANDS),
  });
  return { ok: res.ok, status: res.status };
}
