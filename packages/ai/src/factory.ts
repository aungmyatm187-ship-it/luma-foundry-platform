import type { AIAdapter, ProviderName } from './types.js';
import { MockAIAdapter } from './adapters/mock.js';

export async function createAIAdapter(
  provider: ProviderName = 'mock',
): Promise<AIAdapter> {
  switch (provider) {
    case 'openai':
    case 'azure':
      throw new Error(`AI provider '${provider}' is not implemented yet - use 'mock'.`);
    case 'mock':
    default:
      return new MockAIAdapter();
  }
}
