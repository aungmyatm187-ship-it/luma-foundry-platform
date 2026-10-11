import { describe, expect, it } from 'vitest';

import { createAIAdapter } from '../src/factory.js';

describe('ai adapter factory', () => {
  it('returns the mock adapter by default', async () => {
    const ai = await createAIAdapter();
    expect(ai.name).toBe('mock');
  });

  it('rejects providers that are not implemented yet', async () => {
    await expect(createAIAdapter('openai')).rejects.toThrow(/not implemented/);
    await expect(createAIAdapter('azure')).rejects.toThrow(/not implemented/);
  });
});
