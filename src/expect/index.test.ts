import { describe, it, expect, beforeEach } from 'vitest'
import { createExpect, ExpectationError } from './index.js'
import type { ChatResult, GraderResult } from '../types.js'

function makeChatResult(content: string, toolCalls: ChatResult['toolCalls'] = []): ChatResult {
  return {
    content,
    toolCalls,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  }
}

describe('expect', () => {
  let graderResults: GraderResult[]

  beforeEach(() => {
    graderResults = []
  })

  describe('toContain()', () => {
    it('passes when text is found (case insensitive)', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('hello')

      expect(graderResults).toHaveLength(1)
      expect(graderResults[0].pass).toBe(true)
    })

    it('passes with case sensitive match', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('Hello', { caseSensitive: true })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when text not found', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.toContain('goodbye')).toThrow(ExpectationError)
      expect(graderResults[0].pass).toBe(false)
    })

    it('fails case sensitive mismatch', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.toContain('hello', { caseSensitive: true })).toThrow(ExpectationError)
    })
  })

  describe('not.toContain()', () => {
    it('passes when text is NOT found', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.not.toContain('goodbye')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when text IS found', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.not.toContain('hello')).toThrow(ExpectationError)
    })
  })

  describe('toMatch()', () => {
    it('passes when regex matches', () => {
      const result = makeChatResult('The answer is 42')
      const e = createExpect(result, graderResults)

      e.toMatch(/\d+/)

      expect(graderResults[0].pass).toBe(true)
    })

    it('passes with string pattern', () => {
      const result = makeChatResult('hello@example.com')
      const e = createExpect(result, graderResults)

      e.toMatch('[a-z]+@[a-z]+\\.[a-z]+')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when regex does not match', () => {
      const result = makeChatResult('no numbers here')
      const e = createExpect(result, graderResults)

      expect(() => e.toMatch(/\d+/)).toThrow(ExpectationError)
    })
  })

  describe('not.toMatch()', () => {
    it('passes when regex does NOT match', () => {
      const result = makeChatResult('no numbers here')
      const e = createExpect(result, graderResults)

      e.not.toMatch(/\d+/)

      expect(graderResults[0].pass).toBe(true)
    })
  })

  describe('toAskQuestions()', () => {
    it('passes when question count is in range', () => {
      const result = makeChatResult('What is your name? How can I help?')
      const e = createExpect(result, graderResults)

      e.toAskQuestions({ min: 1, max: 3 })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when too few questions', () => {
      const result = makeChatResult('Hello there.')
      const e = createExpect(result, graderResults)

      expect(() => e.toAskQuestions({ min: 1 })).toThrow(ExpectationError)
    })

    it('fails when too many questions', () => {
      const result = makeChatResult('What? Why? How? When? Where?')
      const e = createExpect(result, graderResults)

      expect(() => e.toAskQuestions({ max: 2 })).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.toInclude()', () => {
    it('passes when tool was called', () => {
      const result = makeChatResult('Done', [
        { name: 'search', arguments: { query: 'test' } },
      ])
      const e = createExpect(result, graderResults)

      e.toolCalls.toInclude('search')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when tool was not called', () => {
      const result = makeChatResult('Done', [])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toInclude('search')).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.not.toInclude()', () => {
    it('passes when tool was NOT called', () => {
      const result = makeChatResult('Done', [])
      const e = createExpect(result, graderResults)

      e.toolCalls.not.toInclude('delete')

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when tool WAS called', () => {
      const result = makeChatResult('Done', [
        { name: 'delete', arguments: {} },
      ])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.not.toInclude('delete')).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.toHaveArgs()', () => {
    it('passes when args match', () => {
      const result = makeChatResult('Done', [
        { name: 'search', arguments: { query: 'hello', limit: 10 } },
      ])
      const e = createExpect(result, graderResults)

      e.toolCalls.toHaveArgs('search', { query: 'hello' })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when args do not match', () => {
      const result = makeChatResult('Done', [
        { name: 'search', arguments: { query: 'hello' } },
      ])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveArgs('search', { query: 'goodbye' })).toThrow(ExpectationError)
    })

    it('fails when tool not called', () => {
      const result = makeChatResult('Done', [])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveArgs('search', { query: 'test' })).toThrow(ExpectationError)
    })
  })

  describe('toolCalls.toHaveResult()', () => {
    it('passes when result matches', () => {
      const result = makeChatResult('Done', [
        { name: 'search', arguments: {}, result: { count: 5 } },
      ])
      const e = createExpect(result, graderResults)

      e.toolCalls.toHaveResult('search', { count: 5 })

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails when result does not match', () => {
      const result = makeChatResult('Done', [
        { name: 'search', arguments: {}, result: { count: 5 } },
      ])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveResult('search', { count: 10 })).toThrow(ExpectationError)
    })

    it('fails when no result (tool not executed)', () => {
      const result = makeChatResult('Done', [
        { name: 'search', arguments: {} },
      ])
      const e = createExpect(result, graderResults)

      expect(() => e.toolCalls.toHaveResult('search', { count: 5 })).toThrow(ExpectationError)
    })
  })

  describe('to() custom grader', () => {
    it('passes with custom grader', () => {
      const result = makeChatResult('Safe content')
      const e = createExpect(result, graderResults)

      const customGrader = (r: ChatResult) => ({
        pass: !r.content.includes('unsafe'),
        reason: 'Content is safe',
      })

      e.to(customGrader)

      expect(graderResults[0].pass).toBe(true)
    })

    it('fails with custom grader', () => {
      const result = makeChatResult('unsafe content here')
      const e = createExpect(result, graderResults)

      const customGrader = (r: ChatResult) => ({
        pass: !r.content.includes('unsafe'),
        reason: 'Content is unsafe',
      })

      expect(() => e.to(customGrader)).toThrow(ExpectationError)
    })

    it('supports async custom grader', async () => {
      const result = makeChatResult('test content')
      const e = createExpect(result, graderResults)

      const asyncGrader = async (_r: ChatResult) => ({
        pass: true,
        reason: 'Async check passed',
      })

      await e.to(asyncGrader)

      expect(graderResults[0].pass).toBe(true)
    })
  })

  describe('fluent chaining', () => {
    it('supports chaining toContain calls', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('hello').toContain('world')

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(true)
    })

    it('supports chaining toContain with toMatch', () => {
      const result = makeChatResult('Hello World 123!')
      const e = createExpect(result, graderResults)

      e.toContain('hello').toMatch(/\d+/)

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(true)
    })

    it('supports chaining with not', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      e.toContain('hello').not.toContain('goodbye')

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(true)
    })

    it('throws on first failing assertion in chain', () => {
      const result = makeChatResult('Hello World!')
      const e = createExpect(result, graderResults)

      expect(() => e.toContain('hello').toContain('xyz').toContain('world')).toThrow(ExpectationError)

      expect(graderResults).toHaveLength(2)
      expect(graderResults[0].pass).toBe(true)
      expect(graderResults[1].pass).toBe(false)
    })
  })
})
