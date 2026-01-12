import type {
  AIProvider,
  ChatResult,
  EvalContext,
  EvaliteConfig,
  GraderResult,
  Message,
  ProviderName,
  SuiteOptions,
  EvalOptions,
  ToolDefinition,
  ToolWithExecutor,
} from '../types.js'
import { createExpect, Expect } from '../expect/index.js'

/**
 * Creates the eval context that gets passed to each eval function
 */
export function createEvalContext(
  providers: Map<ProviderName, AIProvider>,
  _config: EvaliteConfig,
  suiteOptions: SuiteOptions,
  evalOptions: EvalOptions,
  graderResults: GraderResult[]
): EvalContext & { expect: (result: ChatResult) => Expect } {
  // Get explicit ai config from eval options or suite options
  const aiConfig = evalOptions.ai ?? suiteOptions.ai
  if (!aiConfig) {
    throw new Error(
      'No AI provider configured. Use ai: anthropic("model") or ai: openai("model") in describe() options.'
    )
  }

  const provider = providers.get(aiConfig.provider)
  if (!provider) {
    throw new Error(
      `Provider "${aiConfig.provider}" not configured. Add API key to config or environment.`
    )
  }

  // Get judge config (falls back to same as ai config)
  const judgeConfig = evalOptions.judge ?? suiteOptions.judge ?? aiConfig
  const judgeProvider = providers.get(judgeConfig.provider) ?? provider

  // Collect tools from suite and eval options
  const suiteTools = suiteOptions.tools ?? []
  const evalTools = evalOptions.tools
    ? Object.entries(evalOptions.tools).map(([name, tool]) => ({
        ...tool,
        definition: { ...tool.definition, name },
      }))
    : []
  const tools: (ToolDefinition | ToolWithExecutor)[] = [...suiteTools, ...evalTools]

  // Conversation history for multi-turn
  const conversationHistory: Message[] = []

  const chat = async (messages: Message[]): Promise<ChatResult> => {
    // Add new messages to history
    conversationHistory.push(...messages)

    const result = await provider.chat({
      model: aiConfig.model,
      system: suiteOptions.system,
      messages: conversationHistory,
      tools: tools.length > 0 ? tools : undefined,
    })

    // Add assistant response to history for multi-turn
    conversationHistory.push({
      role: 'assistant',
      content: result.content,
    })

    return result
  }

  return {
    ai: {
      chat,
      async prompt(content: string): Promise<ChatResult> {
        return chat([{ role: 'user', content }])
      },
    },
    expect: (result: ChatResult) => createExpect(result, graderResults, judgeProvider, judgeConfig),
  }
}
