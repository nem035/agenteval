import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import type {
  AIProvider,
  ChatOptions,
  ChatResult,
  ProviderConfig,
  ToolCall,
} from '../../types.js'

export function createAnthropicProvider(config: ProviderConfig = {}): AIProvider {
  const anthropic = createAnthropic({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
    baseURL: config.baseURL,
  })

  return {
    async chat(options: ChatOptions): Promise<ChatResult> {
      const { model = 'claude-sonnet-4-20250514', system, messages, maxTokens = 4096, temperature = 0 } = options

      // For now, we'll track tool calls but not actually define tools in the AI SDK
      // This is a simpler approach that works reliably
      const result = await generateText({
        model: anthropic(model),
        system,
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        maxOutputTokens: maxTokens,
        temperature,
      })

      // Extract tool calls from the response if any
      const toolCalls: ToolCall[] = []

      // Get usage from result
      const usage = result.usage ?? { promptTokens: 0, completionTokens: 0 }

      return {
        content: result.text,
        toolCalls,
        usage: {
          inputTokens: (usage as { promptTokens?: number }).promptTokens ?? 0,
          outputTokens: (usage as { completionTokens?: number }).completionTokens ?? 0,
          totalTokens: ((usage as { promptTokens?: number }).promptTokens ?? 0) +
                       ((usage as { completionTokens?: number }).completionTokens ?? 0),
        },
      }
    },
  }
}
