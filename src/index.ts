// Core test functions
export { describe, evalTask as eval, evalTask, test, it } from './core/registry.js'

// Expect & Graders
export { createExpect, Expect, ExpectationError } from './expect/index.js'
export { defineGrader, type GraderFn, type CustomGrader } from './graders/custom.js'

// Config
export { defineConfig, loadConfig } from './config/loader.js'
export { defaultConfig } from './config/defaults.js'

// Types
export type {
  // Core types
  Message,
  MessageRole,
  ToolDefinition,
  ToolParameter,
  ToolWithExecutor,
  ToolCall,

  // AI types
  AIProvider,
  ChatOptions,
  ChatResult,
  TokenUsage,
  ProviderName,
  ProviderConfig,

  // Test types
  Suite,
  SuiteOptions,
  EvalTask,
  EvalOptions,
  EvalContext,
  EvalFn,

  // Result types
  GraderResult,
  TrialResult,
  TaskResult,
  TaskStatus,
  SuiteResult,
  RunResult,

  // Config types
  EvaliteConfig,
  JudgeConfig,
} from './types.js'

// Provider factory
export { createProvider, createProvidersFromConfig } from './ai/interface.js'
