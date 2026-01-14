import type {
  AIProvider,
  ProviderName,
  ProviderConfig,
  EvaliteConfig,
} from '../types.js'
import { createAnthropicProvider } from './providers/anthropic.js'
import { createOpenAIProvider } from './providers/openai.js'

export interface ProviderFactory {
  create(config: ProviderConfig): AIProvider
}

const providers: Record<ProviderName, ProviderFactory> = {
  anthropic: { create: createAnthropicProvider },
  openai: { create: createOpenAIProvider },
}

/**
 * Create an AI provider based on the configuration
 */
export function createProvider(
  name: ProviderName,
  config: ProviderConfig = {}
): AIProvider {
  const factory = providers[name]
  if (!factory) {
    throw new Error(`Unknown provider: ${name}`)
  }
  return factory.create(config)
}

/**
 * Create providers from agentevals config
 */
export function createProvidersFromConfig(
  config: EvaliteConfig
): Map<ProviderName, AIProvider> {
  const providerMap = new Map<ProviderName, AIProvider>()

  // Always try to create providers if API keys are available
  const anthropicKey =
    config.providers?.anthropic?.apiKey ?? process.env.ANTHROPIC_API_KEY
  const openaiKey =
    config.providers?.openai?.apiKey ?? process.env.OPENAI_API_KEY

  if (anthropicKey) {
    providerMap.set(
      'anthropic',
      createProvider('anthropic', {
        apiKey: anthropicKey,
        baseURL: config.providers?.anthropic?.baseURL,
      })
    )
  }

  if (openaiKey) {
    providerMap.set(
      'openai',
      createProvider('openai', {
        apiKey: openaiKey,
        baseURL: config.providers?.openai?.baseURL,
      })
    )
  }

  return providerMap
}
