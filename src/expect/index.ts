import type { ChatResult, GraderResult, ToolCall, AIProvider } from '../types.js'

/**
 * Expectation error that captures grader failure details
 */
export class ExpectationError extends Error {
  constructor(
    public graderResult: GraderResult,
    public expectationType: string
  ) {
    super(graderResult.reason)
    this.name = 'ExpectationError'
  }
}

/**
 * Tool calls wrapper for tool-specific assertions
 */
export class ToolCallsExpect {
  private negated: boolean = false

  constructor(
    private toolCalls: ToolCall[],
    private graderResults: GraderResult[]
  ) {}

  get not(): ToolCallsExpect {
    const instance = new ToolCallsExpect(this.toolCalls, this.graderResults)
    instance.negated = !this.negated
    return instance
  }

  /**
   * Assert that a tool was called
   */
  toInclude(toolName: string): void {
    const found = this.toolCalls.some((tc) => tc.name === toolName)
    const pass = this.negated ? !found : found
    const reason = this.negated
      ? found
        ? `Expected tool "${toolName}" NOT to be called, but it was`
        : `Tool "${toolName}" was not called (as expected)`
      : found
        ? `Tool "${toolName}" was called`
        : `Expected tool "${toolName}" to be called, but it was not. Called tools: ${this.toolCalls.map((t) => t.name).join(', ') || '(none)'}`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toolCalls.toInclude')
    }
  }

  /**
   * Assert that a tool was called with specific arguments
   */
  toHaveArgs(toolName: string, expectedArgs: Record<string, unknown>): void {
    const call = this.toolCalls.find((tc) => tc.name === toolName)

    if (!call) {
      const result: GraderResult = {
        pass: this.negated,
        reason: this.negated
          ? `Tool "${toolName}" was not called (as expected)`
          : `Expected tool "${toolName}" to be called, but it was not`,
      }
      this.graderResults.push(result)
      if (!result.pass) {
        throw new ExpectationError(result, 'toolCalls.toHaveArgs')
      }
      return
    }

    // Check if arguments match
    const argsMatch = Object.entries(expectedArgs).every(([key, value]) => {
      const actual = call.arguments[key]
      return JSON.stringify(actual) === JSON.stringify(value)
    })

    const pass = this.negated ? !argsMatch : argsMatch
    const reason = this.negated
      ? argsMatch
        ? `Expected tool "${toolName}" NOT to have args ${JSON.stringify(expectedArgs)}`
        : `Tool "${toolName}" has different args (as expected)`
      : argsMatch
        ? `Tool "${toolName}" called with correct args`
        : `Tool "${toolName}" called with different args. Expected: ${JSON.stringify(expectedArgs)}, Got: ${JSON.stringify(call.arguments)}`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toolCalls.toHaveArgs')
    }
  }

  /**
   * Assert that a tool execution returned a specific result
   */
  toHaveResult(toolName: string, expectedResult: unknown): void {
    const call = this.toolCalls.find((tc) => tc.name === toolName)

    if (!call) {
      const result: GraderResult = {
        pass: this.negated,
        reason: `Tool "${toolName}" was not called`,
      }
      this.graderResults.push(result)
      if (!result.pass) {
        throw new ExpectationError(result, 'toolCalls.toHaveResult')
      }
      return
    }

    if (call.result === undefined) {
      const result: GraderResult = {
        pass: this.negated,
        reason: `Tool "${toolName}" was called but not executed (no result)`,
      }
      this.graderResults.push(result)
      if (!result.pass) {
        throw new ExpectationError(result, 'toolCalls.toHaveResult')
      }
      return
    }

    const resultMatches = JSON.stringify(call.result) === JSON.stringify(expectedResult)
    const pass = this.negated ? !resultMatches : resultMatches

    const graderResult: GraderResult = {
      pass,
      reason: pass
        ? `Tool "${toolName}" returned expected result`
        : `Tool "${toolName}" returned different result. Expected: ${JSON.stringify(expectedResult)}, Got: ${JSON.stringify(call.result)}`,
    }
    this.graderResults.push(graderResult)

    if (!pass) {
      throw new ExpectationError(graderResult, 'toolCalls.toHaveResult')
    }
  }
}

/**
 * Options for LLM judge
 */
export interface JudgeOptions {
  prompt: string
  model?: string
  provider?: 'anthropic' | 'openai'
  threshold?: number
}

/**
 * Main expect wrapper for ChatResult assertions
 */
export class Expect {
  private negated: boolean = false
  private _toolCalls: ToolCallsExpect

  constructor(
    private result: ChatResult,
    private graderResults: GraderResult[],
    private judgeProvider?: AIProvider
  ) {
    this._toolCalls = new ToolCallsExpect(result.toolCalls, graderResults)
  }

  get not(): Expect {
    const instance = new Expect(this.result, this.graderResults, this.judgeProvider)
    instance.negated = !this.negated
    instance._toolCalls = this._toolCalls.not
    return instance
  }

  get toolCalls(): ToolCallsExpect {
    return this.negated ? this._toolCalls.not : this._toolCalls
  }

  /**
   * Assert that the output contains a substring
   */
  toContain(text: string, options?: { caseSensitive?: boolean }): void {
    const caseSensitive = options?.caseSensitive ?? false
    const content = caseSensitive ? this.result.content : this.result.content.toLowerCase()
    const searchText = caseSensitive ? text : text.toLowerCase()

    const found = content.includes(searchText)
    const pass = this.negated ? !found : found

    const reason = this.negated
      ? found
        ? `Expected output NOT to contain "${text}"`
        : `Output does not contain "${text}" (as expected)`
      : found
        ? `Output contains "${text}"`
        : `Expected output to contain "${text}", but it was not found`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toContain')
    }
  }

  /**
   * Assert that the output matches a regex pattern
   */
  toMatch(pattern: RegExp | string): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    const matches = regex.test(this.result.content)
    const pass = this.negated ? !matches : matches

    const reason = this.negated
      ? matches
        ? `Expected output NOT to match pattern ${regex}`
        : `Output does not match pattern ${regex} (as expected)`
      : matches
        ? `Output matches pattern ${regex}`
        : `Expected output to match pattern ${regex}, but it did not`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toMatch')
    }
  }

  /**
   * Assert the number of questions in the output
   */
  toAskQuestions(options: { min?: number; max?: number }): void {
    const { min = 0, max = Infinity } = options

    // Count question marks as a simple heuristic
    const questionCount = (this.result.content.match(/\?/g) || []).length

    const inRange = questionCount >= min && questionCount <= max
    const pass = this.negated ? !inRange : inRange

    const reason = this.negated
      ? `Expected NOT to ask ${min}-${max} questions, but found ${questionCount}`
      : inRange
        ? `Output asks ${questionCount} questions (within ${min}-${max})`
        : `Expected ${min}-${max} questions, but found ${questionCount}`

    const result: GraderResult = { pass, reason }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toAskQuestions')
    }
  }

  /**
   * Assert using an LLM judge
   */
  async toPassJudge(promptOrOptions: string | JudgeOptions): Promise<void> {
    if (!this.judgeProvider) {
      throw new Error('LLM judge not configured. Set judge config in agenteval.config.ts')
    }

    const options: JudgeOptions =
      typeof promptOrOptions === 'string'
        ? { prompt: promptOrOptions }
        : promptOrOptions

    const { prompt, threshold = 0.5 } = options

    // Call the judge
    const judgeResult = await this.judgeProvider.chat({
      system: `You are an evaluation judge. Analyze the AI output and determine if it meets the given criteria.
Respond with a JSON object containing:
- "pass": boolean (true if the output meets the criteria)
- "score": number between 0 and 1 (confidence score)
- "reason": string (brief explanation of your judgment)

Be objective and precise in your evaluation.`,
      messages: [
        {
          role: 'user',
          content: `## Criteria
${prompt}

## AI Output to Evaluate
${this.result.content}

## Your Judgment (JSON)`,
        },
      ],
    })

    // Parse the judge response
    let judgment: { pass: boolean; score: number; reason: string }
    try {
      // Extract JSON from the response
      const jsonMatch = judgeResult.content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in judge response')
      }
      judgment = JSON.parse(jsonMatch[0])
    } catch {
      judgment = {
        pass: false,
        score: 0,
        reason: `Failed to parse judge response: ${judgeResult.content}`,
      }
    }

    // Apply threshold
    const passesThreshold = judgment.score >= threshold
    const pass = this.negated ? !passesThreshold : passesThreshold

    const result: GraderResult = {
      pass,
      score: judgment.score,
      reason: this.negated
        ? passesThreshold
          ? `Expected NOT to pass judge (score: ${judgment.score}). ${judgment.reason}`
          : `Did not pass judge (as expected). ${judgment.reason}`
        : passesThreshold
          ? `Passed judge (score: ${judgment.score}). ${judgment.reason}`
          : `Failed judge (score: ${judgment.score}, threshold: ${threshold}). ${judgment.reason}`,
      usage: judgeResult.usage,
    }
    this.graderResults.push(result)

    if (!pass) {
      throw new ExpectationError(result, 'toPassJudge')
    }
  }

  /**
   * Apply a custom grader function
   */
  to(grader: (result: ChatResult) => GraderResult | Promise<GraderResult>): Promise<void>
  to(grader: (result: ChatResult) => GraderResult): void
  to(
    grader: (result: ChatResult) => GraderResult | Promise<GraderResult>
  ): void | Promise<void> {
    const graderResult = grader(this.result)

    if (graderResult instanceof Promise) {
      return graderResult.then((res) => {
        const pass = this.negated ? !res.pass : res.pass
        const finalResult: GraderResult = {
          ...res,
          pass,
          reason: this.negated && res.pass !== pass ? `(negated) ${res.reason}` : res.reason,
        }
        this.graderResults.push(finalResult)

        if (!pass) {
          throw new ExpectationError(finalResult, 'custom')
        }
      })
    }

    const pass = this.negated ? !graderResult.pass : graderResult.pass
    const finalResult: GraderResult = {
      ...graderResult,
      pass,
      reason:
        this.negated && graderResult.pass !== pass
          ? `(negated) ${graderResult.reason}`
          : graderResult.reason,
    }
    this.graderResults.push(finalResult)

    if (!pass) {
      throw new ExpectationError(finalResult, 'custom')
    }
  }
}

/**
 * Create an expect instance for a ChatResult
 */
export function createExpect(
  result: ChatResult,
  graderResults: GraderResult[],
  judgeProvider?: AIProvider
): Expect {
  return new Expect(result, graderResults, judgeProvider)
}
