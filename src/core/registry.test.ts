import { describe, it, expect, beforeEach } from 'vitest'
import {
  describe as describeSuite,
  evalTask,
  resetRegistry,
  setCurrentFile,
  getCollectedSuites,
} from './registry.js'

describe('registry', () => {
  beforeEach(() => {
    resetRegistry()
  })

  describe('describe()', () => {
    it('creates a suite with name and options', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('my-suite', { system: 'You are helpful' }, () => {})

      const suites = getCollectedSuites()
      expect(suites).toHaveLength(1)
      expect(suites[0].name).toBe('my-suite')
      expect(suites[0].options.system).toBe('You are helpful')
      expect(suites[0].file).toBe('/test/file.eval.ts')
    })

    it('creates a suite without options', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('simple-suite', () => {})

      const suites = getCollectedSuites()
      expect(suites).toHaveLength(1)
      expect(suites[0].name).toBe('simple-suite')
      expect(suites[0].options).toEqual({})
    })

    it('collects multiple suites', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('suite-1', () => {})
      describeSuite('suite-2', () => {})
      describeSuite('suite-3', () => {})

      const suites = getCollectedSuites()
      expect(suites).toHaveLength(3)
    })
  })

  describe('evalTask()', () => {
    it('adds task to current suite', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('my-suite', () => {
        evalTask('my-task', async () => {})
      })

      const suites = getCollectedSuites()
      expect(suites[0].tasks).toHaveLength(1)
      expect(suites[0].tasks[0].name).toBe('my-task')
    })

    it('adds task with options', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('my-suite', () => {
        evalTask('my-task', { timeout: 5000 }, async () => {})
      })

      const suites = getCollectedSuites()
      expect(suites[0].tasks[0].options?.timeout).toBe(5000)
    })

    it('collects multiple tasks', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('my-suite', () => {
        evalTask('task-1', async () => {})
        evalTask('task-2', async () => {})
        evalTask('task-3', async () => {})
      })

      const suites = getCollectedSuites()
      expect(suites[0].tasks).toHaveLength(3)
    })

    it('throws if called outside describe', () => {
      setCurrentFile('/test/file.eval.ts')

      expect(() => {
        evalTask('orphan-task', async () => {})
      }).toThrow('eval() must be called within a describe() block')
    })
  })

  describe('resetRegistry()', () => {
    it('clears all collected suites', () => {
      setCurrentFile('/test/file.eval.ts')

      describeSuite('suite-1', () => {})
      describeSuite('suite-2', () => {})

      expect(getCollectedSuites()).toHaveLength(2)

      resetRegistry()

      expect(getCollectedSuites()).toHaveLength(0)
    })
  })
})
