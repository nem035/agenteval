import type { EvaliteConfig, Suite } from '../../types.js'
import type { Reporter } from '../reporter/types.js'
import { loadConfig } from '../../config/loader.js'
import { discoverEvalFiles, filterByPattern } from '../../core/discovery.js'
import { loadEvalFiles } from '../../core/loader.js'
import { runSuites } from '../../core/runner.js'
import { createProvidersFromConfig } from '../../ai/interface.js'
import { createConsoleReporter } from '../reporter/console.js'
import { createJsonReporter } from '../reporter/json.js'

export interface RunOptions {
  config?: string
  grep?: string
  trials?: number
  maxCost?: number
  reporter?: 'console' | 'json'
  verbose?: boolean
  model?: string
  provider?: 'anthropic' | 'openai'
  dryRun?: boolean
}

export async function runCommand(
  patterns: string[],
  options: RunOptions
): Promise<number> {
  const cwd = process.cwd()

  // Load config
  let config: EvaliteConfig
  try {
    config = await loadConfig(cwd)
  } catch (error) {
    console.error('Failed to load config:', error)
    return 1
  }

  // Override config with CLI options
  if (options.trials !== undefined) {
    config.trials = options.trials
  }
  if (options.maxCost !== undefined) {
    config.maxCost = options.maxCost
  }
  if (options.model !== undefined) {
    config.defaultModel = options.model
  }
  if (options.provider !== undefined) {
    config.defaultProvider = options.provider
  }

  // Discover eval files
  let files: string[]
  if (patterns.length > 0) {
    // Use provided patterns
    files = await discoverEvalFiles({
      cwd,
      include: patterns.map((p) => (p.includes('*') ? p : `**/*${p}*`)),
      exclude: config.exclude,
    })
  } else {
    // Use config patterns
    files = await discoverEvalFiles({
      cwd,
      include: config.include,
      exclude: config.exclude,
    })
  }

  // Filter by grep pattern
  if (options.grep) {
    files = filterByPattern(files, options.grep)
  }

  if (files.length === 0) {
    console.log('No eval files found.')
    return 0
  }

  // Dry run - just show what would be executed
  if (options.dryRun) {
    console.log('Would run the following eval files:')
    for (const file of files) {
      console.log(`  - ${file}`)
    }
    return 0
  }

  // Create providers
  const providers = createProvidersFromConfig(config)
  if (providers.size === 0) {
    console.error(
      'No AI providers configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variables.'
    )
    return 1
  }

  // Load eval files
  let suites: Suite[]
  try {
    suites = await loadEvalFiles(files)
  } catch (error) {
    console.error('Failed to load eval files:', error)
    return 1
  }

  if (suites.length === 0) {
    console.log('No eval suites found in the discovered files.')
    return 0
  }

  // Create reporter
  const reporterType = options.reporter ?? config.reporters?.[0] ?? 'console'
  const reporter: Reporter =
    reporterType === 'json'
      ? createJsonReporter({ pretty: true })
      : createConsoleReporter({ verbose: options.verbose })

  // Run evals
  reporter.onStart?.()

  const result = await runSuites(suites, {
    config,
    providers,
    maxCost: options.maxCost,
    onSuiteStart: reporter.onSuiteStart?.bind(reporter),
    onSuiteEnd: reporter.onSuiteEnd?.bind(reporter),
    onTaskStart: reporter.onTaskStart?.bind(reporter),
    onTaskEnd: reporter.onTaskEnd?.bind(reporter),
  })

  reporter.onEnd?.(result)

  return result.success ? 0 : 1
}
