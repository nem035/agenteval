import { createOpenAI } from '@ai-sdk/openai'
import { generateText, dynamicTool, zodSchema } from 'ai'
import { z } from 'zod'
import type {
  AIProvider,
  ChatOptions,
  ChatResult,
  ProviderConfig,
  ToolCall,
  ToolDefinition,
  ToolWithExecutor,
} from '../../types.js'

/**
 * Build a Zod schema shape from tool parameters
 */
function buildZodShape(params?: ToolDefinition['parameters']): z.ZodRawShape {
  if (!params || params.length === 0) {
    return {}
  }

  const shape: z.ZodRawShape = {}

  for (const param of params) {
    let fieldSchema: z.ZodTypeAny

    switch (param.type) {
      case 'string':
        fieldSchema = z.string()
        break
      case 'number':
        fieldSchema = z.number()
        break
      case 'boolean':
        fieldSchema = z.boolean()
        break
      case 'array':
        fieldSchema = z.array(z.unknown())
        break
      case 'object':
        fieldSchema = z.record(z.unknown())
        break
      default:
        fieldSchema = z.unknown()
    }

    if (param.description) {
      fieldSchema = fieldSchema.describe(param.description)
    }

    if (!param.required) {
      fieldSchema = fieldSchema.optional()
    }

    shape[param.name] = fieldSchema
  }

  return shape
}


/**
 * Check if a tool has an executor function
 */
function isToolWithExecutor(t: ToolDefinition | ToolWithExecutor): t is ToolWithExecutor {
  return 'definition' in t && typeof (t as ToolWithExecutor).execute === 'function'
}

/**
 * Get the tool definition from either format
 */
function getToolDefinition(t: ToolDefinition | ToolWithExecutor): ToolDefinition {
  return isToolWithExecutor(t) ? t.definition : t
}

export function createOpenAIProvider(config: ProviderConfig = {}): AIProvider {
  const openai = createOpenAI({
    apiKey: config.apiKey ?? process.env.OPENAI_API_KEY,
    baseURL: config.baseURL,
  })

  return {
    async chat(options: ChatOptions): Promise<ChatResult> {
      const {
        model = 'gpt-4o',
        system,
        messages,
        tools: inputTools,
        maxTokens = 4096,
        temperature = 0,
      } = options

      // Track tool calls for assertions
      const toolCalls: ToolCall[] = []

      // Build tool map for AI SDK
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const toolMap: Record<string, any> = {}

      if (inputTools && inputTools.length > 0) {
        for (const t of inputTools) {
          const def = getToolDefinition(t)
          const executor = isToolWithExecutor(t) ? t.execute : undefined
          const shape = buildZodShape(def.parameters)
          const schema = z.object(shape)

          toolMap[def.name] = dynamicTool({
            description: def.description ?? '',
            inputSchema: zodSchema(schema),
            execute: async (args) => {
              // Record the tool call
              const callRecord: ToolCall = {
                name: def.name,
                arguments: args as Record<string, unknown>,
              }
              toolCalls.push(callRecord)

              // Execute if we have an executor
              if (executor) {
                const result = await executor(args as Record<string, unknown>)
                callRecord.result = result
                return result
              }

              // Return a placeholder if no executor
              return { executed: true }
            },
          })
        }
      }

      const hasTools = Object.keys(toolMap).length > 0

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
        ...(hasTools ? { tools: toolMap, maxSteps: 5 } : {}),
        maxOutputTokens: maxTokens,
        temperature,
      })

      // Get usage from result
      const usage = result.usage ?? { promptTokens: 0, completionTokens: 0 }

      return {
        content: result.text,
        toolCalls,
        usage: {
          inputTokens: (usage as { promptTokens?: number }).promptTokens ?? 0,
          outputTokens: (usage as { completionTokens?: number }).completionTokens ?? 0,
          totalTokens:
            ((usage as { promptTokens?: number }).promptTokens ?? 0) +
            ((usage as { completionTokens?: number }).completionTokens ?? 0),
        },
      }
    },
  }
}
