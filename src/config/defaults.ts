import type { EvaliteConfig } from '../types.js'

export const defaultConfig: Required<
  Pick<
    EvaliteConfig,
    | 'include'
    | 'exclude'
    | 'trials'
    | 'timeout'
    | 'parallel'
    | 'maxConcurrency'
    | 'reporters'
    | 'defaultProvider'
    | 'defaultModel'
  >
> = {
  include: ['**/*.eval.ts', '**/*.eval.js', '**/*.eval.mts', '**/*.eval.mjs'],
  exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
  trials: 1,
  timeout: 60000,
  parallel: true,
  maxConcurrency: 5,
  reporters: ['console'],
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',
}
