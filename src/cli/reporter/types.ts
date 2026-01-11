import type { RunResult, SuiteResult, TaskResult, EvalTask, Suite } from '../../types.js'

export interface Reporter {
  onStart?(): void
  onSuiteStart?(suite: Suite): void
  onSuiteEnd?(suite: Suite, result: SuiteResult): void
  onTaskStart?(task: EvalTask, suite: Suite): void
  onTaskEnd?(task: EvalTask, suite: Suite, result: TaskResult): void
  onEnd?(result: RunResult): void
}
