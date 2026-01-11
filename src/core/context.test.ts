import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEvalContext } from './context.js'
import type { AIProvider, ProviderName, GraderResult } from '../types.js'

function createMockProvider(): AIProvider {
  return {
    chat: vi.fn().mockResolvedValue({
      content: 'Hello from mock',
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createEvalContext', () => {
  it('creates context with ai.chat function', async () => {
    const mockProvider = createMockProvider()
    const providers = new Map<ProviderName, AIProvider>([['anthropic', mockProvider]])
    const graderResults: GraderResult[] = []

    const context = createEvalContext(
      providers,
      {},
      { ai: { provider: 'anthropic', model: 'test' }, system: 'You are helpful' },
      {},
      graderResults
    )

    const result = await context.ai.chat([{ role: 'user', content: 'Hello' }])

    expect(result.content).toBe('Hello from mock')
    expect(mockProvider.chat).toHaveBeenCalled()
  })

  it('creates context with expect function', () => {
    const mockProvider = createMockProvider()
    const providers = new Map<ProviderName, AIProvider>([['anthropic', mockProvider]])
    const graderResults: GraderResult[] = []

    const context = createEvalContext(
      providers,
      {},
      { ai: { provider: 'anthropic', model: 'test' } },
      {},
      graderResults
    )

    expect(typeof context.expect).toBe('function')
  })

  it('maintains conversation history across calls', async () => {
    const callHistory: Array<{ messages: { role: string; content: string }[] }> = []
    const chatMock = vi.fn().mockImplementation((opts) => {
      callHistory.push({ messages: JSON.parse(JSON.stringify(opts.messages)) })
      return Promise.resolve({
        content: 'Hello from mock',
        toolCalls: [],
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      })
    })

    const mockProvider: AIProvider = { chat: chatMock }
    const providers = new Map<ProviderName, AIProvider>([['anthropic', mockProvider]])
    const graderResults: GraderResult[] = []

    const context = createEvalContext(
      providers,
      {},
      { ai: { provider: 'anthropic', model: 'test' }, system: 'Test system' },
      {},
      graderResults
    )

    await context.ai.chat([{ role: 'user', content: 'First message' }])
    await context.ai.chat([{ role: 'user', content: 'Second message' }])

    expect(callHistory[0].messages).toHaveLength(1)
    expect(callHistory[0].messages[0].content).toBe('First message')

    expect(callHistory[1].messages).toHaveLength(3)
    expect(callHistory[1].messages[0].content).toBe('First message')
    expect(callHistory[1].messages[1].role).toBe('assistant')
    expect(callHistory[1].messages[2].content).toBe('Second message')
  })

  it('uses suite-level system prompt', async () => {
    const mockProvider = createMockProvider()
    const providers = new Map<ProviderName, AIProvider>([['anthropic', mockProvider]])
    const graderResults: GraderResult[] = []

    const context = createEvalContext(
      providers,
      {},
      { ai: { provider: 'anthropic', model: 'test' }, system: 'Suite system prompt' },
      {},
      graderResults
    )

    await context.ai.chat([{ role: 'user', content: 'Hello' }])

    const call = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.system).toBe('Suite system prompt')
  })

  it('throws if ai not configured', () => {
    const providers = new Map<ProviderName, AIProvider>()
    const graderResults: GraderResult[] = []

    expect(() =>
      createEvalContext(
        providers,
        {},
        {},
        {},
        graderResults
      )
    ).toThrow('No AI provider configured')
  })

  it('respects eval-level ai override', async () => {
    const anthropicProvider = createMockProvider()
    const openaiProvider = createMockProvider()
    const providers = new Map<ProviderName, AIProvider>([
      ['anthropic', anthropicProvider],
      ['openai', openaiProvider],
    ])
    const graderResults: GraderResult[] = []

    const context = createEvalContext(
      providers,
      {},
      { ai: { provider: 'anthropic', model: 'claude' } },
      { ai: { provider: 'openai', model: 'gpt-4' } },
      graderResults
    )

    await context.ai.chat([{ role: 'user', content: 'Hello' }])

    expect(openaiProvider.chat).toHaveBeenCalled()
    expect(anthropicProvider.chat).not.toHaveBeenCalled()
  })
})
