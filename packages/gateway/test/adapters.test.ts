/**
 * Adapter tests.
 *
 * These cover the parts of the adapters that face the public internet:
 * verifying that a request really came from the platform, and rendering replies
 * without losing them to a parse error. A bot endpoint that trusts an
 * unverified caller is a governance hole, because the caller controls the text.
 */
import { describe, expect, it } from 'vitest';
import {
  chatIdOf,
  escapeMarkdown,
  getMe,
  toCommand as telegramCommand,
  toTelegramMarkdown,
  verifySecret,
  type TelegramUpdate,
} from '../src/telegram.js';
import {
  COMMANDS,
  INTERACTION,
  RESPONSE,
  hexToBytes,
  toCommand as discordCommand,
  toComponents,
  toResponse,
  verifySignature,
  type DiscordInteraction,
} from '../src/discord.js';

describe('telegram adapter', () => {
  const update: TelegramUpdate = {
    update_id: 1,
    message: {
      message_id: 10,
      from: { id: 42, first_name: 'Aung' },
      chat: { id: 42, type: 'private' },
      text: 'hero axiom-grid',
    },
  };

  it('reduces an update to a command', () => {
    expect(telegramCommand(update)).toEqual({
      platform: 'telegram',
      externalId: '42',
      text: 'hero axiom-grid',
    });
  });

  it('ignores a message with no text', () => {
    expect(telegramCommand({ message: { message_id: 1, chat: { id: 1, type: 'private' } } })).toBeNull();
  });

  it('ignores a message with no sender', () => {
    expect(
      telegramCommand({ message: { message_id: 1, chat: { id: 1, type: 'private' }, text: 'hi' } }),
    ).toBeNull();
  });

  it('reads the chat id', () => {
    expect(chatIdOf(update)).toBe(42);
  });

  describe('secret verification', () => {
    const secret = 'abc123';

    it('accepts the matching secret', () => {
      expect(verifySecret(secret, secret)).toBe(true);
    });

    it('rejects a wrong secret of the same length', () => {
      expect(verifySecret('abc124', secret)).toBe(false);
    });

    it('rejects a wrong length', () => {
      expect(verifySecret('abc12', secret)).toBe(false);
    });

    it('rejects missing input', () => {
      expect(verifySecret(null, secret)).toBe(false);
      expect(verifySecret(secret, '')).toBe(false);
    });
  });

  describe('markdown', () => {
    it('escapes reserved characters', () => {
      expect(escapeMarkdown('a.b!c')).toBe('a\\.b\\!c');
    });

    it('preserves intended bold and code spans', () => {
      const out = toTelegramMarkdown('*bold* and `code.here`');
      expect(out).toContain('*bold*');
      expect(out).toContain('`code\\.here`');
    });

    it('escapes characters inside code spans rather than dropping them', () => {
      const out = toTelegramMarkdown('run `licence axiom-grid`');
      expect(out).toContain('`licence axiom\\-grid`');
    });

    it('escapes a stray asterisk that is not emphasis', () => {
      const out = toTelegramMarkdown('2 * 3');
      expect(out).toContain('\\*');
    });
  });

  it('getMe reports a failed token without throwing', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ ok: false }), { status: 401 })) as unknown as typeof fetch;
    const r = await getMe('bad', fakeFetch);
    expect(r.ok).toBe(false);
  });

  it('getMe reports identity for a good token', async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ ok: true, result: { username: 'luma_bot', id: 7 } }), {
        status: 200,
      })) as unknown as typeof fetch;
    const r = await getMe('good', fakeFetch);
    expect(r).toEqual({ ok: true, username: 'luma_bot', id: 7 });
  });
});

describe('discord adapter', () => {
  const interaction: DiscordInteraction = {
    id: 'i1',
    type: INTERACTION.APPLICATION_COMMAND,
    data: { name: 'hero', options: [{ name: 'target', value: 'axiom-grid' }] },
    member: { user: { id: '99', username: 'aung' } },
  };

  it('reduces a slash command to a gateway command', () => {
    expect(discordCommand(interaction)).toEqual({
      platform: 'discord',
      externalId: '99',
      text: 'hero axiom-grid',
    });
  });

  it('uses the bare command name when no target is given', () => {
    const i: DiscordInteraction = { id: 'i', type: 2, data: { name: 'status' }, user: { id: '5' } };
    expect(discordCommand(i)?.text).toBe('status');
  });

  it('ignores a non-command interaction', () => {
    expect(discordCommand({ id: 'i', type: INTERACTION.PING })).toBeNull();
  });

  it('renders a reply as an interaction response', () => {
    const r = toResponse({ ok: true, text: 'done' });
    expect(r.type).toBe(RESPONSE.CHANNEL_MESSAGE_WITH_SOURCE);
    expect(r.data.content).toBe('done');
  });

  it('truncates an over-long reply rather than failing', () => {
    const r = toResponse({ ok: true, text: 'x'.repeat(3000) });
    expect(r.data.content.length).toBeLessThanOrEqual(2000);
  });

  it('builds buttons from suggestions', () => {
    expect(toComponents({ ok: true, text: 'a', suggestions: ['gates x'] })).toHaveLength(1);
    expect(toComponents({ ok: true, text: 'a' })).toBeUndefined();
  });

  it('parses hex to bytes', () => {
    expect(Array.from(hexToBytes('ff00'))).toEqual([255, 0]);
  });

  describe('signature verification', () => {
    const pub = 'aa'.repeat(32);

    it('accepts a valid signature', () => {
      const verify = () => true;
      expect(verifySignature(verify, '{"a":1}', 'ab'.repeat(64), '123', pub)).toBe(true);
    });

    it('rejects an invalid signature', () => {
      const verify = () => false;
      expect(verifySignature(verify, '{"a":1}', 'ab'.repeat(64), '123', pub)).toBe(false);
    });

    it('rejects when headers are missing', () => {
      const verify = () => true;
      expect(verifySignature(verify, '{}', null, '123', pub)).toBe(false);
      expect(verifySignature(verify, '{}', 'ab'.repeat(64), null, pub)).toBe(false);
      expect(verifySignature(verify, '{}', 'ab'.repeat(64), '123', '')).toBe(false);
    });

    it('does not throw on malformed hex', () => {
      const verify = () => true;
      expect(() => verifySignature(verify, '{}', 'zz', '123', pub)).not.toThrow();
    });
  });

  it('publishes a command for every workflow verb plus the read-only verbs', () => {
    const names = COMMANDS.map((c) => c.name);
    for (const v of ['release', 'hero', 'workshop', 'deploy', 'evidence']) {
      expect(names).toContain(v);
    }
    for (const v of ['help', 'catalogue', 'status', 'whoami', 'licence', 'gates']) {
      expect(names).toContain(v);
    }
  });
});
