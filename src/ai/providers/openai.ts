import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import type {
  AIProvider,
  ChatOptions,
  ChatResult,
  ProviderConfig,
  ToolCall,
} from '../../types.js'

export function createOpenAIProvider(config: ProviderConfig = {}): AIProvider {
  const openai = createOpenAI({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: config.baseURL,
  })

  return {
    async chat(options: ChatOptions): Promise<ChatResult> {
      const { model = 'gpt-4o', system, messages, maxTokens = 4096, temperature = 0 } = options

      // Build messages array with system prompt
      const allMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
      if (system) {
        allMessages.push({ role: 'system', content: system })
      }
      for (const m of messages) {
        allMessages.push({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })
      }

      const result = await generateText({
        model: openai(model),
        messages: allMessages,
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
