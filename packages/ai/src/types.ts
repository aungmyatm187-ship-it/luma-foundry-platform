export type ProviderName = 'openai' | 'azure' | 'mock';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface CompletionResult {
  text: string;
  model: string;
  provider: ProviderName;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AIAdapter {
  name: ProviderName;
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;
  stream?(
    messages: ChatMessage[],
    options?: CompletionOptions,
    onChunk?: (chunk: string) => void,
  ): Promise<CompletionResult>;
}
