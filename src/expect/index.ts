import type { ChatResult, GraderResult, ToolCall, AIProvider, AIConfig } from '../types.js'

export class ExpectationError extends Error {
  constructor(
    public graderResult: GraderResult,
    public expectationType: string
  ) {
    super(graderResult.reason)
    this.name = 'ExpectationError'
  }
}

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

export interface JudgeOptions {
  criteria: string
  threshold?: number
  judge?: AIConfig
}

export class Expect {
  private negated: boolean = false
  private _toolCalls: ToolCallsExpect

  constructor(
    private result: ChatResult,
    private graderResults: GraderResult[],
    private judgeProvider?: AIProvider,
    private judgeConfig?: AIConfig
  ) {
    this._toolCalls = new ToolCallsExpect(result.toolCalls, graderResults)
  }

  get not(): Expect {
    const instance = new Expect(this.result, this.graderResults, this.judgeProvider, this.judgeConfig)
    instance.negated = !this.negated
    instance._toolCalls = this._toolCalls.not
    return instance
  }

  get toolCalls(): ToolCallsExpect {
    return this.negated ? this._toolCalls.not : this._toolCalls
  }

  toContain(text: string, options?: { caseSensitive?: boolean }): this {
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

    return this
  }

  toMatch(pattern: RegExp | string): this {
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

    return this
  }

  toAskQuestions(options: { min?: number; max?: number }): this {
    const { min = 0, max = Infinity } = options
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

    return this
  }

  async toPassJudge(criteriaOrOptions: string | JudgeOptions): Promise<this> {
    if (!this.judgeProvider) {
      throw new Error('LLM judge not configured. Make sure provider API keys are set.')
    }

    const options: JudgeOptions =
      typeof criteriaOrOptions === 'string'
        ? { criteria: criteriaOrOptions }
        : criteriaOrOptions

    const { criteria, threshold = 0.5 } = options

    // Call the judge
    const judgeResult = await this.judgeProvider.chat({
      model: options.judge?.model ?? this.judgeConfig?.model,
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
${criteria}

## AI Output to Evaluate
${this.result.content}

## Your Judgment (JSON)`,
        },
      ],
    })

    // Parse the judge response
    let judgment: { pass: boolean; score: number; reason: string }
    try {
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

    return this
  }

  to(grader: (result: ChatResult) => GraderResult | Promise<GraderResult>): Promise<this>
  to(grader: (result: ChatResult) => GraderResult): this
  to(
    grader: (result: ChatResult) => GraderResult | Promise<GraderResult>
  ): this | Promise<this> {
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

        return this
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

    return this
  }
}

export function createExpect(
  result: ChatResult,
  graderResults: GraderResult[],
  judgeProvider?: AIProvider,
  judgeConfig?: AIConfig
): Expect {
  return new Expect(result, graderResults, judgeProvider, judgeConfig)
}
