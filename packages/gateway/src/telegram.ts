/**
 * Telegram adapter.
 *
 * Telegram is the primary bot surface for the Myanmar audience: the Bot API is
 * free with no message or user limit, a bot token is issued by BotFather in
 * minutes with no approval step, and Telegram is the dominant messaging app in
 * the market. Slack requires a workspace admin to install an app; Telegram
 * requires nothing but a chat with BotFather.
 *
 * This file translates Telegram updates into gateway commands. It holds no
 * routing and no governance — those live in gateway.ts.
 */
import type { BotCommand, BotReply, Platform } from './gateway.js';

const PLATFORM: Platform = 'telegram';
const API = 'https://api.telegram.org';

/** The subset of a Telegram update this adapter reads. */
export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

/** Reduce a Telegram update to a gateway command, or null if it is not one. */
export function toCommand(update: TelegramUpdate): BotCommand | null {
  const msg = update.message;
  if (!msg?.text || !msg.from) return null;
  return { platform: PLATFORM, externalId: String(msg.from.id), text: msg.text };
}

/** The chat to reply into for an update. */
export function chatIdOf(update: TelegramUpdate): number | null {
  return update.message?.chat.id ?? null;
}

/**
 * Render a reply as Telegram MarkdownV2.
 *
 * Telegram rejects unescaped reserved characters in MarkdownV2, so every
 * character outside the emphasis we intend is escaped. Getting this wrong makes
 * the API return 400 and the message vanish, so it is done strictly.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (c) => `\\${c}`);
}

/**
 * Convert the gateway's light markdown to Telegram MarkdownV2.
 *
 * Only `*bold*` and `` `code` `` are honoured; everything else is escaped. The
 * gateway emits exactly those two, so this stays a small, predictable transform.
 */
export function toTelegramMarkdown(text: string): string {
  const tokens: string[] = [];
  // Park code spans first so their contents are never emphasis-parsed.
  let out = text.replace(/`([^`]+)`/g, (_m, inner: string) => {
    tokens.push(inner);
    return `\u0000${tokens.length - 1}\u0000`;
  });

  out = out.replace(/\*([^*]+)\*/g, (_m, inner: string) => `*${inner}*`);

  out = out
    .split('\n')
    .map((line) => escapeMarkdown(line).replace(/\\\*([^*]+?)\\\*/g, '*$1*'))
    .join('\n');

  out = out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => `\`${escapeMarkdown(tokens[Number(i)]!)}\``);
  return out;
}

export interface TelegramSender {
  token: string;
  fetchImpl?: typeof fetch;
}

/**
 * Send a gateway reply to a chat.
 *
 * On a MarkdownV2 parse error (HTTP 400) the message is resent as plain text:
 * a formatting bug should degrade the styling, never lose the reply.
 */
export async function sendReply(
  sender: TelegramSender,
  chatId: number,
  reply: BotReply,
  opts: { keyboard?: boolean } = {},
): Promise<{ ok: boolean; status: number; fellBack: boolean }> {
  const doFetch = sender.fetchImpl ?? fetch;
  const url = `${API}/bot${sender.token}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: toTelegramMarkdown(reply.text),
    parse_mode: 'MarkdownV2',
    link_preview_options: { is_disabled: true },
  };

  if (opts.keyboard && reply.suggestions?.length) {
    body.reply_markup = {
      keyboard: reply.suggestions.map((s) => [{ text: s }]),
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }

  const first = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (first.ok) return { ok: true, status: first.status, fellBack: false };

  if (first.status === 400) {
    delete body.parse_mode;
    body.text = reply.text;
    const second = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: second.ok, status: second.status, fellBack: true };
  }

  return { ok: false, status: first.status, fellBack: false };
}

/** Register the webhook with Telegram so updates are pushed rather than polled. */
export async function setWebhook(
  token: string,
  publicUrl: string,
  secretToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetchImpl(`${API}/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: publicUrl,
      secret_token: secretToken,
      allowed_updates: ['message'],
      drop_pending_updates: true,
    }),
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => null) };
}

/** Fetch bot identity — used to verify a token is live. */
export async function getMe(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; username?: string; id?: number }> {
  const res = await fetchImpl(`${API}/bot${token}/getMe`);
  const body = (await res.json().catch(() => null)) as
    | { ok?: boolean; result?: { username?: string; id?: number } }
    | null;
  return { ok: Boolean(body?.ok), username: body?.result?.username, id: body?.result?.id };
}

/**
 * Verify a webhook request came from Telegram.
 *
 * Telegram sets this header to the `secret_token` given to `setWebhook`. It is
 * the only proof the caller is Telegram, so it is checked before the body is
 * parsed or any command is routed.
 */
export function verifySecret(header: string | null | undefined, expected: string): boolean {
  if (!header || !expected) return false;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i += 1) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}
