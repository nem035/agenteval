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
  config: EvaliteConfig,
  suiteOptions: SuiteOptions,
  evalOptions: EvalOptions,
  graderResults: GraderResult[]
): EvalContext & { expect: (result: ChatResult) => Expect } {
  // Determine which provider to use
  const providerName =
    evalOptions.provider ??
    suiteOptions.provider ??
    config.defaultProvider ??
    'anthropic'

  const provider = providers.get(providerName)
  if (!provider) {
    throw new Error(
      `Provider "${providerName}" not configured. Add API key to config or environment.`
    )
  }

  // Get the judge provider for LLM grading
  const judgeProviderName = config.judge?.provider ?? providerName
  const judgeProvider = providers.get(judgeProviderName)

  // Determine model
  const model = evalOptions.model ?? suiteOptions.model ?? config.defaultModel

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

  return {
    ai: {
      async chat(messages: Message[]): Promise<ChatResult> {
        // Add new messages to history
        conversationHistory.push(...messages)

        const result = await provider.chat({
          model,
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
      },
    },
    expect: (result: ChatResult) => createExpect(result, graderResults, judgeProvider),
  }
}
