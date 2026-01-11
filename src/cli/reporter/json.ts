import type { RunResult } from '../../types.js'
import type { Reporter } from './types.js'

export interface JsonReporterOptions {
  pretty?: boolean
}

export function createJsonReporter(options: JsonReporterOptions = {}): Reporter {
  const { pretty = false } = options

  return {
    onEnd(result: RunResult): void {
      const output = {
        success: result.success,
        summary: result.summary,
        suites: result.suites.map((suite) => ({
          name: suite.name,
          file: suite.file,
          tasks: suite.tasks.map((task) => ({
            name: task.name,
            status: task.status,
            duration: task.duration,
            trials: task.trials.map((trial) => ({
              status: trial.status,
              duration: trial.duration,
              error: trial.error,
              graders: trial.graderResults.map((g) => ({
                pass: g.pass,
                reason: g.reason,
                score: g.score,
              })),
              usage: trial.usage,
              costUsd: trial.costUsd,
            })),
          })),
          duration: suite.duration,
        })),
        usage: result.usage,
        costUsd: result.costUsd,
        duration: result.duration,
      }

      if (pretty) {
        console.log(JSON.stringify(output, null, 2))
      } else {
        console.log(JSON.stringify(output))
      }
    },
  }
}
