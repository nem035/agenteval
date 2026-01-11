import type {
  AIProvider,
  EvaliteConfig,
  EvalTask,
  GraderResult,
  ProviderName,
  RunResult,
  Suite,
  SuiteResult,
  TaskResult,
  TaskStatus,
  TokenUsage,
  TrialResult,
} from '../types.js'
import { createEvalContext } from './context.js'
import { ExpectationError } from '../expect/index.js'

export interface RunnerOptions {
  config: EvaliteConfig
  providers: Map<ProviderName, AIProvider>
  onSuiteStart?: (suite: Suite) => void
  onSuiteEnd?: (suite: Suite, result: SuiteResult) => void
  onTaskStart?: (task: EvalTask, suite: Suite) => void
  onTaskEnd?: (task: EvalTask, suite: Suite, result: TaskResult) => void
  maxCost?: number
}

interface CostTracker {
  totalCost: number
  exceeded: boolean
}

/**
 * Run a single task trial
 */
async function runTrial(
  task: EvalTask,
  suite: Suite,
  options: RunnerOptions,
  costTracker: CostTracker
): Promise<TrialResult> {
  const { config, providers } = options
  const startTime = Date.now()
  const graderResults: GraderResult[] = []

  // Create context with grader collection
  const context = createEvalContext(
    providers,
    config,
    suite.options,
    task.options ?? {},
    graderResults
  )

  let status: TaskStatus = 'passed'
  let error: string | undefined
  let usage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  let costUsd = 0

  try {
    // Check cost limit before running
    if (options.maxCost && costTracker.totalCost >= options.maxCost) {
      costTracker.exceeded = true
      return {
        status: 'skipped',
        duration: 0,
        graderResults: [],
        error: 'Cost limit exceeded',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
      }
    }

    // Run the eval function
    await task.fn(context)

    // Check if any grader failed
    const failed = graderResults.some((r) => !r.pass)
    status = failed ? 'failed' : 'passed'

    // Aggregate usage from grader results (for LLM judges)
    for (const r of graderResults) {
      if (r.usage) {
        usage.inputTokens += r.usage.inputTokens
        usage.outputTokens += r.usage.outputTokens
        usage.totalTokens += r.usage.totalTokens
      }
      if (r.costUsd) {
        costUsd += r.costUsd
      }
    }
  } catch (err) {
    if (err instanceof ExpectationError) {
      status = 'failed'
      error = err.graderResult.reason
    } else {
      status = 'error'
      error = err instanceof Error ? err.message : String(err)
    }
  }

  const duration = Date.now() - startTime

  // Update cost tracker
  costTracker.totalCost += costUsd

  return {
    status,
    duration,
    graderResults,
    error,
    usage,
    costUsd,
  }
}

/**
 * Run all trials for a task
 */
async function runTask(
  task: EvalTask,
  suite: Suite,
  options: RunnerOptions,
  costTracker: CostTracker
): Promise<TaskResult> {
  const { config } = options
  const trials = config.trials ?? 1
  const startTime = Date.now()

  options.onTaskStart?.(task, suite)

  const trialResults: TrialResult[] = []

  for (let i = 0; i < trials; i++) {
    if (costTracker.exceeded) {
      trialResults.push({
        status: 'skipped',
        duration: 0,
        graderResults: [],
        error: 'Cost limit exceeded',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        costUsd: 0,
      })
      continue
    }

    const result = await runTrial(task, suite, options, costTracker)
    trialResults.push(result)
  }

  // Determine overall status
  // If any trial passed, consider it passed (pass@k logic)
  const anyPassed = trialResults.some((r) => r.status === 'passed')
  const allSkipped = trialResults.every((r) => r.status === 'skipped')
  const anyError = trialResults.some((r) => r.status === 'error')

  let status: TaskStatus
  if (allSkipped) {
    status = 'skipped'
  } else if (anyPassed) {
    status = 'passed'
  } else if (anyError) {
    status = 'error'
  } else {
    status = 'failed'
  }

  const duration = Date.now() - startTime

  const result: TaskResult = {
    name: task.name,
    status,
    trials: trialResults,
    duration,
  }

  options.onTaskEnd?.(task, suite, result)

  return result
}

/**
 * Run all tasks in a suite
 */
async function runSuite(
  suite: Suite,
  options: RunnerOptions,
  costTracker: CostTracker
): Promise<SuiteResult> {
  const { config } = options
  const startTime = Date.now()

  options.onSuiteStart?.(suite)

  const taskResults: TaskResult[] = []

  if (config.parallel) {
    // Run tasks in parallel with concurrency limit
    const concurrency = config.maxConcurrency ?? 5
    const chunks: EvalTask[][] = []

    for (let i = 0; i < suite.tasks.length; i += concurrency) {
      chunks.push(suite.tasks.slice(i, i + concurrency))
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map((task) => runTask(task, suite, options, costTracker))
      )
      taskResults.push(...results)
    }
  } else {
    // Run tasks sequentially
    for (const task of suite.tasks) {
      const result = await runTask(task, suite, options, costTracker)
      taskResults.push(result)
    }
  }

  const duration = Date.now() - startTime

  const result: SuiteResult = {
    name: suite.name,
    file: suite.file,
    tasks: taskResults,
    duration,
  }

  options.onSuiteEnd?.(suite, result)

  return result
}

/**
 * Run all suites
 */
export async function runSuites(
  suites: Suite[],
  options: RunnerOptions
): Promise<RunResult> {
  const startTime = Date.now()
  const costTracker: CostTracker = { totalCost: 0, exceeded: false }

  // Set max cost from options or config
  const maxCost = options.maxCost ?? options.config.maxCost

  const suiteResults: SuiteResult[] = []

  for (const suite of suites) {
    const result = await runSuite(suite, { ...options, maxCost }, costTracker)
    suiteResults.push(result)
  }

  // Aggregate results
  let total = 0
  let passed = 0
  let failed = 0
  let skipped = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCostUsd = 0

  for (const suite of suiteResults) {
    for (const task of suite.tasks) {
      total++
      switch (task.status) {
        case 'passed':
          passed++
          break
        case 'failed':
        case 'error':
          failed++
          break
        case 'skipped':
          skipped++
          break
      }

      for (const trial of task.trials) {
        totalInputTokens += trial.usage.inputTokens
        totalOutputTokens += trial.usage.outputTokens
        totalCostUsd += trial.costUsd
      }
    }
  }

  const duration = Date.now() - startTime

  return {
    success: failed === 0,
    suites: suiteResults,
    summary: {
      total,
      passed,
      failed,
      skipped,
    },
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
    },
    costUsd: totalCostUsd,
    duration,
  }
}
