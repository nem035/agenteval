import pc from 'picocolors'
import type { RunResult, TaskResult, EvalTask, Suite } from '../../types.js'
import type { Reporter } from './types.js'

const PASS = pc.green('✓')
const FAIL = pc.red('✗')
const SKIP = pc.yellow('○')

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function formatCost(usd: number): string {
  if (usd < 0.01) {
    return `$${usd.toFixed(4)}`
  }
  return `$${usd.toFixed(2)}`
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return String(count)
}

export interface ConsoleReporterOptions {
  verbose?: boolean
}

export function createConsoleReporter(options: ConsoleReporterOptions = {}): Reporter {
  const { verbose = false } = options

  return {
    onStart(): void {
      console.log()
      console.log(pc.bold(pc.cyan(' AGENTEVAL')) + pc.dim(' v0.1.0'))
      console.log()
    },

    onSuiteStart(suite: Suite): void {
      console.log(pc.dim(` ${suite.file}`))
      console.log(`   ${pc.bold(suite.name)}`)
    },

    onTaskEnd(task: EvalTask, _suite: Suite, result: TaskResult): void {
      const icon =
        result.status === 'passed'
          ? PASS
          : result.status === 'skipped'
            ? SKIP
            : FAIL

      const duration = pc.dim(`(${formatDuration(result.duration)})`)
      console.log(`     ${icon} ${task.name} ${duration}`)

      // Show error details for failures
      if (result.status === 'failed' || result.status === 'error') {
        for (const trial of result.trials) {
          if (trial.error) {
            console.log(pc.red(`       └─ ${trial.error}`))
          }
          // Show failed grader reasons
          for (const grader of trial.graderResults) {
            if (!grader.pass) {
              console.log(pc.red(`       └─ ${grader.reason}`))
            }
          }
        }
      }

      // Verbose mode: show all grader results
      if (verbose && result.status === 'passed') {
        for (const trial of result.trials) {
          for (const grader of trial.graderResults) {
            console.log(pc.dim(`       └─ ${grader.reason}`))
          }
        }
      }
    },

    onSuiteEnd(): void {
      console.log()
    },

    onEnd(result: RunResult): void {
      const line = '─'.repeat(45)
      console.log(pc.dim(` ${line}`))

      // Summary
      const passed = pc.green(`${result.summary.passed} passed`)
      const failed =
        result.summary.failed > 0
          ? pc.red(`, ${result.summary.failed} failed`)
          : ''
      const skipped =
        result.summary.skipped > 0
          ? pc.yellow(`, ${result.summary.skipped} skipped`)
          : ''
      const total = pc.dim(`, ${result.summary.total} total`)

      console.log(` Tests:    ${passed}${failed}${skipped}${total}`)
      console.log(` Time:     ${formatDuration(result.duration)}`)

      if (result.usage.totalTokens > 0) {
        console.log(
          ` Tokens:   ${formatTokens(result.usage.inputTokens)} input, ${formatTokens(result.usage.outputTokens)} output`
        )
      }

      if (result.costUsd > 0) {
        console.log(` Cost:     ${formatCost(result.costUsd)}`)
      }

      console.log()

      // Exit status hint
      if (!result.success) {
        console.log(pc.red(' Some tests failed.'))
        console.log()
      }
    },
  }
}
