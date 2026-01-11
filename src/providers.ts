/**
 * Provider helper functions for explicit AI configuration
 */

export type AIConfig = {
  provider: 'anthropic' | 'openai'
  model: string
  apiKey?: string
}

/**
 * Configure Anthropic as the AI provider
 *
 * @example
 * describe('my-agent', {
 *   ai: anthropic('claude-sonnet-4-20250514'),
 *   system: 'You are helpful',
 * }, () => { ... })
 */
export function anthropic(model: string, options?: { apiKey?: string }): AIConfig {
  return { provider: 'anthropic', model, ...options }
}

/**
 * Configure OpenAI as the AI provider
 *
 * @example
 * describe('my-agent', {
 *   ai: openai('gpt-4o'),
 *   system: 'You are helpful',
 * }, () => { ... })
 */
export function openai(model: string, options?: { apiKey?: string }): AIConfig {
  return { provider: 'openai', model, ...options }
}
