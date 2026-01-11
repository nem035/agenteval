import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runSuites } from './runner.js'
import type { Suite, AIProvider, EvaliteConfig, ProviderName, ChatResult } from '../types.js'

function createMockProvider(response: string = 'Mock response'): AIProvider {
  return {
    chat: vi.fn().mockResolvedValue({
      content: response,
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    } as ChatResult),
  }
}

function createMockConfig(overrides: Partial<EvaliteConfig> = {}): EvaliteConfig {
  return {
    defaultProvider: 'anthropic',
    defaultModel: 'test-model',
    trials: 1,
    parallel: false,
    timeout: 5000,
    ...overrides,
  }
}

describe('runSuites', () => {
  let mockProvider: AIProvider
  let providers: Map<ProviderName, AIProvider>

  beforeEach(() => {
    mockProvider = createMockProvider()
    providers = new Map([['anthropic', mockProvider]])
  })

  it('runs a simple passing suite', async () => {
    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: { system: 'You are helpful' },
        tasks: [
          {
            name: 'passing-task',
            fn: async ({ ai, expect }) => {
              const result = await ai.chat([{ role: 'user', content: 'Hi' }])
              expect(result).toContain('Mock')
            },
          },
        ],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig(),
      providers,
    })

    expect(result.success).toBe(true)
    expect(result.summary.total).toBe(1)
    expect(result.summary.passed).toBe(1)
    expect(result.summary.failed).toBe(0)
  })

  it('runs a failing suite', async () => {
    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: {},
        tasks: [
          {
            name: 'failing-task',
            fn: async ({ ai, expect }) => {
              const result = await ai.chat([{ role: 'user', content: 'Hi' }])
              expect(result).toContain('nonexistent text')
            },
          },
        ],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig(),
      providers,
    })

    expect(result.success).toBe(false)
    expect(result.summary.failed).toBe(1)
  })

  it('handles task errors', async () => {
    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: {},
        tasks: [
          {
            name: 'error-task',
            fn: async () => {
              throw new Error('Unexpected error')
            },
          },
        ],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig(),
      providers,
    })

    expect(result.success).toBe(false)
    expect(result.suites[0].tasks[0].status).toBe('error')
  })

  it('runs multiple trials', async () => {
    let callCount = 0
    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: {},
        tasks: [
          {
            name: 'multi-trial-task',
            fn: async ({ ai, expect }) => {
              callCount++
              const result = await ai.chat([{ role: 'user', content: 'Hi' }])
              expect(result).toContain('Mock')
            },
          },
        ],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig({ trials: 3 }),
      providers,
    })

    expect(callCount).toBe(3)
    expect(result.suites[0].tasks[0].trials).toHaveLength(3)
  })

  it('tracks total usage across tasks', async () => {
    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: {},
        tasks: [
          {
            name: 'task-1',
            fn: async ({ ai }) => {
              await ai.chat([{ role: 'user', content: 'Hi' }])
            },
          },
          {
            name: 'task-2',
            fn: async ({ ai }) => {
              await ai.chat([{ role: 'user', content: 'Hi' }])
            },
          },
        ],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig(),
      providers,
    })

    // Two tasks ran, each using tokens
    expect(result.summary.total).toBe(2)
    expect(result.summary.passed).toBe(2)
  })

  it('calls lifecycle hooks', async () => {
    const onSuiteStart = vi.fn()
    const onSuiteEnd = vi.fn()
    const onTaskStart = vi.fn()
    const onTaskEnd = vi.fn()

    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: {},
        tasks: [
          {
            name: 'task-1',
            fn: async ({ ai, expect }) => {
              const result = await ai.chat([{ role: 'user', content: 'Hi' }])
              expect(result).toContain('Mock')
            },
          },
        ],
      },
    ]

    await runSuites(suites, {
      config: createMockConfig(),
      providers,
      onSuiteStart,
      onSuiteEnd,
      onTaskStart,
      onTaskEnd,
    })

    expect(onSuiteStart).toHaveBeenCalledTimes(1)
    expect(onSuiteEnd).toHaveBeenCalledTimes(1)
    expect(onTaskStart).toHaveBeenCalledTimes(1)
    expect(onTaskEnd).toHaveBeenCalledTimes(1)
  })

  it('runs multiple suites', async () => {
    const suites: Suite[] = [
      {
        name: 'suite-1',
        file: '/test1.eval.ts',
        options: {},
        tasks: [{ name: 'task-1', fn: async () => {} }],
      },
      {
        name: 'suite-2',
        file: '/test2.eval.ts',
        options: {},
        tasks: [{ name: 'task-2', fn: async () => {} }],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig(),
      providers,
    })

    expect(result.suites).toHaveLength(2)
    expect(result.summary.total).toBe(2)
  })

  it('aggregates duration correctly', async () => {
    const suites: Suite[] = [
      {
        name: 'test-suite',
        file: '/test.eval.ts',
        options: {},
        tasks: [
          {
            name: 'task-1',
            fn: async () => {
              await new Promise((r) => setTimeout(r, 50))
            },
          },
        ],
      },
    ]

    const result = await runSuites(suites, {
      config: createMockConfig(),
      providers,
    })

    expect(result.duration).toBeGreaterThanOrEqual(50)
  })
})
