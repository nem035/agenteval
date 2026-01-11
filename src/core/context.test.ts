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
      { defaultProvider: 'anthropic', defaultModel: 'test' },
      { system: 'You are helpful' },
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
      { defaultProvider: 'anthropic' },
      {},
      {},
      graderResults
    )

    expect(typeof context.expect).toBe('function')
  })

  it('maintains conversation history across calls', async () => {
    // Track messages at each call time (deep copy to avoid reference issues)
    const callHistory: Array<{ messages: { role: string; content: string }[] }> = []
    const chatMock = vi.fn().mockImplementation((opts) => {
      // Store a snapshot of messages at call time
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
      { defaultProvider: 'anthropic' },
      { system: 'Test system' },
      {},
      graderResults
    )

    await context.ai.chat([{ role: 'user', content: 'First message' }])
    await context.ai.chat([{ role: 'user', content: 'Second message' }])

    // First call has 1 message
    expect(callHistory[0].messages).toHaveLength(1)
    expect(callHistory[0].messages[0].content).toBe('First message')

    // Second call has 3 messages (user1, assistant1, user2)
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
      { defaultProvider: 'anthropic' },
      { system: 'Suite system prompt' },
      {},
      graderResults
    )

    await context.ai.chat([{ role: 'user', content: 'Hello' }])

    const call = (mockProvider.chat as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(call.system).toBe('Suite system prompt')
  })

  it('throws if provider not configured', () => {
    const providers = new Map<ProviderName, AIProvider>()
    const graderResults: GraderResult[] = []

    expect(() =>
      createEvalContext(
        providers,
        { defaultProvider: 'anthropic' },
        {},
        {},
        graderResults
      )
    ).toThrow('Provider "anthropic" not configured')
  })

  it('respects eval-level provider override', async () => {
    const anthropicProvider = createMockProvider()
    const openaiProvider = createMockProvider()
    const providers = new Map<ProviderName, AIProvider>([
      ['anthropic', anthropicProvider],
      ['openai', openaiProvider],
    ])
    const graderResults: GraderResult[] = []

    const context = createEvalContext(
      providers,
      { defaultProvider: 'anthropic' },
      {},
      { provider: 'openai' },
      graderResults
    )

    await context.ai.chat([{ role: 'user', content: 'Hello' }])

    expect(openaiProvider.chat).toHaveBeenCalled()
    expect(anthropicProvider.chat).not.toHaveBeenCalled()
  })
})
