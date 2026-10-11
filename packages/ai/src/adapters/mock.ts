import type { AIAdapter, ChatMessage, CompletionOptions, CompletionResult } from '../types.js';

export class MockAIAdapter implements AIAdapter {
  name = 'mock' as const;

  async complete(
    messages: ChatMessage[],
    options: CompletionOptions = {},
  ): Promise<CompletionResult> {
    const last = messages[messages.length - 1]?.content ?? '';

    return {
      text: `Mock AI response for: ${last.slice(0, 120)}`,
      model: options.model ?? 'mock-model',
      provider: 'mock',
      metadata: {
        mode: 'mock',
      },
    };
  }
}
