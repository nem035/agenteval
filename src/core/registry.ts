import type { Suite, EvalTask, SuiteOptions, EvalOptions, EvalFn } from '../types.js'

/**
 * Global registry for collecting suites and tasks during file loading.
 * This mimics how Vitest/Jest collect tests via describe/it.
 */

let currentSuites: Suite[] = []
let currentSuite: Suite | null = null
let currentFile: string = ''

export function setCurrentFile(file: string): void {
  currentFile = file
}

export function getCurrentFile(): string {
  return currentFile
}

export function resetRegistry(): void {
  currentSuites = []
  currentSuite = null
  currentFile = ''
}

export function getCollectedSuites(): Suite[] {
  return currentSuites
}

/**
 * Define a test suite with optional configuration
 */
export function describe(
  name: string,
  optionsOrFn: SuiteOptions | (() => void),
  maybeFn?: () => void
): void {
  const options: SuiteOptions = typeof optionsOrFn === 'function' ? {} : optionsOrFn
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn!

  const suite: Suite = {
    name,
    options,
    tasks: [],
    file: currentFile,
  }

  currentSuites.push(suite)
  currentSuite = suite

  // Execute the suite body to collect tasks
  fn()

  currentSuite = null
}

/**
 * Define an eval task within a suite
 * Note: Using 'evalTask' internally since 'eval' is a reserved word
 */
export function evalTask(
  name: string,
  optionsOrFn: EvalOptions | EvalFn,
  maybeFn?: EvalFn
): void {
  if (!currentSuite) {
    throw new Error(`eval() must be called within a describe() block`)
  }

  const options: EvalOptions = typeof optionsOrFn === 'function' ? {} : optionsOrFn
  const fn = typeof optionsOrFn === 'function' ? optionsOrFn : maybeFn!

  const task: EvalTask = {
    name,
    fn,
    options,
  }

  currentSuite.tasks.push(task)
}

// Aliases
export { evalTask as test }
export { evalTask as it }
