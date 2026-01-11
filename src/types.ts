/**
 * Core types for Evalite
 */

// ============================================================================
// Messages & Conversations
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  role: MessageRole
  content: string
}

// ============================================================================
// Tool Definitions & Calls
// ============================================================================

export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  description?: string
  required?: boolean
}

export interface ToolDefinition {
  name: string
  description?: string
  parameters?: ToolParameter[]
}

export interface ToolWithExecutor {
  definition: ToolDefinition
  execute?: (args: Record<string, unknown>) => Promise<unknown> | unknown
}

export interface ToolCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

// ============================================================================
// AI Provider Interface
// ============================================================================

export interface ChatOptions {
  model?: string
  system?: string
  messages: Message[]
  tools?: (ToolDefinition | ToolWithExecutor)[]
  maxTokens?: number
  temperature?: number
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface ChatResult {
  content: string
  toolCalls: ToolCall[]
  usage: TokenUsage
}

export interface AIProvider {
  chat(options: ChatOptions): Promise<ChatResult>
}

export type ProviderName = 'anthropic' | 'openai'

// ============================================================================
// Grader Results
// ============================================================================

export interface GraderResult {
  pass: boolean
  reason: string
  score?: number
  usage?: TokenUsage
  costUsd?: number
}

// ============================================================================
// Test Structure
// ============================================================================

export interface SuiteOptions {
  system?: string
  model?: string
  provider?: ProviderName
  tools?: (ToolDefinition | ToolWithExecutor)[]
}

export interface EvalOptions {
  tools?: Record<string, ToolWithExecutor>
  model?: string
  provider?: ProviderName
  timeout?: number
}

// Expect interface defined here to avoid circular imports
export interface ExpectInterface {
  not: ExpectInterface
  toolCalls: ToolCallsExpectInterface
  toContain(text: string, options?: { caseSensitive?: boolean }): void
  toMatch(pattern: RegExp | string): void
  toAskQuestions(options: { min?: number; max?: number }): void
  toPassJudge(promptOrOptions: string | { prompt: string; model?: string; threshold?: number }): Promise<void>
  to(grader: (result: ChatResult) => GraderResult | Promise<GraderResult>): void | Promise<void>
}

export interface ToolCallsExpectInterface {
  not: ToolCallsExpectInterface
  toInclude(toolName: string): void
  toHaveArgs(toolName: string, expectedArgs: Record<string, unknown>): void
  toHaveResult(toolName: string, expectedResult: unknown): void
}

export interface EvalContext {
  ai: {
    chat(messages: Message[]): Promise<ChatResult>
  }
  expect: (result: ChatResult) => ExpectInterface
}

export type EvalFn = (context: EvalContext) => Promise<void>

export interface EvalTask {
  name: string
  fn: EvalFn
  options?: EvalOptions
}

export interface Suite {
  name: string
  options: SuiteOptions
  tasks: EvalTask[]
  file: string
}

// ============================================================================
// Execution Results
// ============================================================================

export type TaskStatus = 'passed' | 'failed' | 'skipped' | 'error'

export interface TrialResult {
  status: TaskStatus
  duration: number
  graderResults: GraderResult[]
  error?: string
  usage: TokenUsage
  costUsd: number
}

export interface TaskResult {
  name: string
  status: TaskStatus
  trials: TrialResult[]
  duration: number
}

export interface SuiteResult {
  name: string
  file: string
  tasks: TaskResult[]
  duration: number
}

export interface RunResult {
  success: boolean
  suites: SuiteResult[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
  }
  usage: TokenUsage
  costUsd: number
  duration: number
}

// ============================================================================
// Configuration
// ============================================================================

export interface ProviderConfig {
  apiKey?: string
  baseURL?: string
}

export interface JudgeConfig {
  provider?: ProviderName
  model?: string
}

export interface EvaliteConfig {
  providers?: {
    anthropic?: ProviderConfig
    openai?: ProviderConfig
  }
  defaultProvider?: ProviderName
  defaultModel?: string
  include?: string[]
  exclude?: string[]
  trials?: number
  timeout?: number
  parallel?: boolean
  maxConcurrency?: number
  judge?: JudgeConfig
  reporters?: ('console' | 'json')[]
  maxCost?: number
}
