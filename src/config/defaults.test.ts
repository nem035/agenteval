import { describe, it, expect } from 'vitest'
import { defaultConfig } from './defaults.js'

describe('defaultConfig', () => {
  it('has sensible defaults', () => {
    expect(defaultConfig.include).toContain('**/*.eval.ts')
    expect(defaultConfig.exclude).toContain('**/node_modules/**')
    expect(defaultConfig.trials).toBe(1)
    expect(defaultConfig.timeout).toBe(60000)
    expect(defaultConfig.parallel).toBe(true)
    expect(defaultConfig.maxConcurrency).toBe(5)
    expect(defaultConfig.reporters).toContain('console')
    expect(defaultConfig.defaultProvider).toBe('anthropic')
  })

  it('has valid default model', () => {
    expect(defaultConfig.defaultModel).toMatch(/claude/)
  })
})
