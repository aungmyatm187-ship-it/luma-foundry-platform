import { describe, expect, it } from 'vitest';

import { MockAIAdapter } from '../src/adapters/mock.js';

describe('mock ai adapter', () => {
  it('returns deterministic mock output', async () => {
    const ai = new MockAIAdapter();
    const result = await ai.complete([
      { role: 'user', content: 'hello world' },
    ]);

    expect(result.provider).toBe('mock');
    expect(result.text).toContain('hello world');
    expect(result.model).toBe('mock-model');
  });
});
