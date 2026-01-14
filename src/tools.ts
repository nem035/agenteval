/**
 * Tool definition utilities for agentevals
 */

import type { ToolDefinition, ToolParameter, ToolWithExecutor } from './types.js'

/**
 * Options for defining a tool
 */
export interface DefineToolOptions<TArgs extends Record<string, unknown> = Record<string, unknown>> {
  /** Human-readable description of what the tool does */
  description?: string
  /** Parameter definitions */
  parameters?: ToolParameter[]
  /** Function to execute when the tool is called */
  execute?: (args: TArgs) => Promise<unknown> | unknown
}

/**
 * Define a tool for use in evals.
 *
 * @example
 * // Simple tool without execution
 * const getWeather = defineTool('getWeather', {
 *   description: 'Get the current weather for a location',
 *   parameters: [
 *     { name: 'location', type: 'string', required: true },
 *     { name: 'units', type: 'string', required: false },
 *   ],
 * })
 *
 * @example
 * // Tool with execution function
 * const calculator = defineTool('calculator', {
 *   description: 'Perform arithmetic operations',
 *   parameters: [
 *     { name: 'operation', type: 'string', required: true },
 *     { name: 'a', type: 'number', required: true },
 *     { name: 'b', type: 'number', required: true },
 *   ],
 *   execute: async ({ operation, a, b }) => {
 *     switch (operation) {
 *       case 'add': return a + b
 *       case 'subtract': return a - b
 *       case 'multiply': return a * b
 *       case 'divide': return a / b
 *       default: throw new Error(`Unknown operation: ${operation}`)
 *     }
 *   },
 * })
 *
 * @example
 * // Using in a test
 * describe('weather-agent', {
 *   ai: anthropic('claude-sonnet-4-20250514'),
 *   system: 'You are a weather assistant.',
 *   tools: [getWeather],
 * }, () => {
 *   e('asks for weather', async ({ ai, expect }) => {
 *     const result = await ai.prompt('What is the weather in Tokyo?')
 *
 *     expect(result).toolCalls.toInclude('getWeather')
 *     expect(result).toolCalls.toHaveArgs('getWeather', { location: 'Tokyo' })
 *   })
 * })
 */
export function defineTool<TArgs extends Record<string, unknown> = Record<string, unknown>>(
  name: string,
  options: DefineToolOptions<TArgs> = {}
): ToolWithExecutor {
  const definition: ToolDefinition = {
    name,
    description: options.description,
    parameters: options.parameters,
  }

  return {
    definition,
    execute: options.execute as ((args: Record<string, unknown>) => Promise<unknown> | unknown) | undefined,
  }
}

/**
 * Create a mock tool executor that records calls and returns a specified value.
 * Useful for testing tool call behavior without actual execution.
 *
 * @example
 * const mockExecute = createMockExecutor({ success: true })
 * const myTool = defineTool('myTool', {
 *   description: 'A mock tool',
 *   parameters: [{ name: 'input', type: 'string', required: true }],
 *   execute: mockExecute,
 * })
 *
 * // After running the eval...
 * expect(mockExecute.calls).toHaveLength(1)
 * expect(mockExecute.calls[0]).toEqual({ input: 'hello' })
 */
export function createMockExecutor<TResult = unknown>(
  returnValue: TResult
): ((args: Record<string, unknown>) => TResult) & { calls: Record<string, unknown>[] } {
  const calls: Record<string, unknown>[] = []

  const executor = (args: Record<string, unknown>): TResult => {
    calls.push(args)
    return returnValue
  }

  executor.calls = calls

  return executor
}

/**
 * Create a spy executor that wraps an existing executor and records calls.
 *
 * @example
 * const originalExecute = async (args) => fetchWeather(args.location)
 * const spyExecute = createSpyExecutor(originalExecute)
 *
 * const weatherTool = defineTool('getWeather', {
 *   description: 'Get weather',
 *   parameters: [{ name: 'location', type: 'string', required: true }],
 *   execute: spyExecute,
 * })
 *
 * // After running the eval...
 * expect(spyExecute.calls).toContainEqual({ location: 'Tokyo' })
 */
export function createSpyExecutor<TResult = unknown>(
  executor: (args: Record<string, unknown>) => TResult | Promise<TResult>
): ((args: Record<string, unknown>) => TResult | Promise<TResult>) & {
  calls: Record<string, unknown>[]
  results: TResult[]
} {
  const calls: Record<string, unknown>[] = []
  const results: TResult[] = []

  const spy = (args: Record<string, unknown>): TResult | Promise<TResult> => {
    calls.push(args)
    const result = executor(args)

    if (result instanceof Promise) {
      return result.then((r) => {
        results.push(r)
        return r
      })
    }

    results.push(result)
    return result
  }

  spy.calls = calls
  spy.results = results

  return spy
}
