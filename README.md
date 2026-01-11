# agenteval

Test your AI apps like you test your code. Evalite is a Vitest-like CLI for running evals on LLMs.

```bash
npm install agenteval
```

## Quick Start

**1. Set your API key**

```bash
export ANTHROPIC_API_KEY=your-key
# or
export OPENAI_API_KEY=your-key
```

**2. Create an eval file**

```typescript
// my-agent.eval.ts
import { describe, evalTask as e } from 'agenteval'

describe('my-agent', {
  system: 'You are a helpful assistant.',
}, () => {

  e('answers questions', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'What is 2 + 2?' }
    ])

    expect(result).toContain('4')
  })

})
```

**3. Run it**

```bash
npx agenteval run
```

Output:

```
 EVALITE v0.1.0

 my-agent.eval.ts
   my-agent
     ✓ answers questions (1.2s)

 ─────────────────────────────────────────────
 Tests:    1 passed, 1 total
 Time:     1.2s
```

---

## Writing Evals

### Basic Structure

Every eval file has suites (`describe`) containing tasks (`evalTask`):

```typescript
import { describe, evalTask as e } from 'agenteval'

describe('suite-name', {
  system: 'System prompt goes here',
}, () => {

  e('task name', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'User message' }
    ])

    expect(result).toContain('expected text')
  })

})
```

### Checking Output Contains Text

```typescript
e('greets the user', async ({ ai, expect }) => {
  const result = await ai.chat([
    { role: 'user', content: 'Hello!' }
  ])

  // Case insensitive by default
  expect(result).toContain('hello')

  // Case sensitive
  expect(result).toContain('Hello', { caseSensitive: true })

  // Negation
  expect(result).not.toContain('error')
})
```

### Checking Output Matches Pattern

```typescript
e('returns a number', async ({ ai, expect }) => {
  const result = await ai.chat([
    { role: 'user', content: 'Pick a number between 1 and 10' }
  ])

  // Regex pattern
  expect(result).toMatch(/\d+/)

  // String pattern (converted to regex)
  expect(result).toMatch('[0-9]+')
})
```

### Checking Question Count

```typescript
e('asks clarifying questions', async ({ ai, expect }) => {
  const result = await ai.chat([
    { role: 'user', content: 'Help me with my project' }
  ])

  // Should ask 1-3 questions
  expect(result).toAskQuestions({ min: 1, max: 3 })
})
```

### Using LLM as Judge

When rules are hard to express in code, use another LLM to judge:

```typescript
e('responds helpfully', async ({ ai, expect }) => {
  const result = await ai.chat([
    { role: 'user', content: 'How do I learn programming?' }
  ])

  // Simple: just pass the criteria
  await expect(result).toPassJudge('gives actionable advice for beginners')
})
```

With options:

```typescript
await expect(result).toPassJudge({
  prompt: 'Response shows empathy and understanding',
  threshold: 0.8,  // Minimum score (0-1) to pass
})
```

### Multi-Turn Conversations

The `ai.chat` function maintains conversation history:

```typescript
e('remembers context', async ({ ai, expect }) => {
  // First turn
  await ai.chat([
    { role: 'user', content: 'My name is Alice' }
  ])

  // Second turn - history is preserved
  const result = await ai.chat([
    { role: 'user', content: 'What is my name?' }
  ])

  expect(result).toContain('Alice')
})
```

### Custom Graders

Write your own grading logic:

```typescript
import { defineGrader } from 'agenteval'

const noProfanity = defineGrader('noProfanity', (result) => {
  const badWords = ['damn', 'hell']  // your list
  const found = badWords.some(w => result.content.toLowerCase().includes(w))

  return {
    pass: !found,
    reason: found ? 'Response contains profanity' : 'No profanity detected'
  }
})

// Use it
e('keeps it clean', async ({ ai, expect }) => {
  const result = await ai.chat([
    { role: 'user', content: 'Tell me a joke' }
  ])

  expect(result).to(noProfanity)
})
```

---

## Configuration

Create `agenteval.config.ts` in your project root:

```typescript
import { defineConfig } from 'agenteval'

export default defineConfig({
  // Provider settings
  defaultProvider: 'anthropic',  // or 'openai'
  defaultModel: 'claude-sonnet-4-20250514',

  // API keys (or use environment variables)
  providers: {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
  },

  // Test discovery
  include: ['**/*.eval.ts'],
  exclude: ['node_modules/**'],

  // Execution
  trials: 1,           // Runs per task
  timeout: 60000,      // 60 seconds per task
  parallel: true,      // Run tasks in parallel
  maxConcurrency: 5,   // Max parallel tasks

  // LLM Judge settings
  judge: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  },
})
```

---

## CLI Reference

### Run Evals

```bash
# Run all evals
agenteval run

# Run specific file
agenteval run my-agent.eval.ts

# Run files matching pattern
agenteval run "**/*chat*.eval.ts"

# Filter by task name
agenteval run --grep "greeting"
```

### Output Formats

```bash
# Pretty console output (default)
agenteval run

# JSON output for CI
agenteval run --reporter=json

# Verbose mode (show all grader details)
agenteval run --verbose
```

### Cost Control

```bash
# Stop if cost exceeds $1
agenteval run --max-cost=1.00
```

### Multiple Trials

Run each task multiple times for statistical confidence:

```bash
# Run each task 5 times
agenteval run --trials=5
```

A task passes if any trial passes (pass@k logic).

### Override Model

```bash
# Use a different model
agenteval run --model=gpt-4o --provider=openai
```

### Dry Run

See what would run without executing:

```bash
agenteval run --dry-run
```

### Initialize Project

Create config and example files:

```bash
agenteval init
```

---

## CI/CD Integration

Evalite returns exit code 1 when tests fail, making it CI-friendly.

### GitHub Actions

```yaml
name: Evals
on: [push]

jobs:
  eval:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm install
      - run: npx agenteval run --reporter=json --max-cost=5.00
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### JSON Output

Use `--reporter=json` to get machine-readable output:

```json
{
  "success": false,
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1
  },
  "suites": [...],
  "usage": {
    "inputTokens": 1250,
    "outputTokens": 340
  },
  "costUsd": 0.02
}
```

---

## Examples

### Testing a Customer Support Bot

```typescript
import { describe, evalTask as e } from 'agenteval'

describe('support-bot', {
  system: `You are a customer support agent for Acme Inc.
Be helpful, empathetic, and professional.
If you need more information, ask clarifying questions.`,
}, () => {

  e('handles refund requests', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'I want a refund for my order' }
    ])

    // Should ask for order details
    expect(result).toAskQuestions({ min: 1 })
    expect(result).not.toContain('sorry, I cannot')
  })

  e('stays professional with angry customers', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'This is ridiculous! Your product is garbage!' }
    ])

    await expect(result).toPassJudge('responds calmly and professionally without being defensive')
    expect(result).not.toContain('calm down')
  })

  e('escalates when appropriate', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'I want to speak to a manager' }
    ])

    expect(result).toMatch(/escalate|manager|supervisor|human/i)
  })

})
```

### Testing a Code Assistant

```typescript
import { describe, evalTask as e } from 'agenteval'

describe('code-assistant', {
  system: 'You are a helpful coding assistant. Provide clear, working code.',
}, () => {

  e('writes valid JavaScript', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Write a function that reverses a string' }
    ])

    expect(result).toMatch(/function|const|=>/)
    expect(result).toContain('reverse')
  })

  e('explains code when asked', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Explain this code: arr.filter(x => x > 0)' }
    ])

    await expect(result).toPassJudge('explains that filter creates a new array with elements passing the test')
  })

  e('handles edge cases', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Write a function to divide two numbers' }
    ])

    // Should mention division by zero
    expect(result).toMatch(/zero|0|error|undefined/i)
  })

})
```

### Testing a Research Assistant

```typescript
import { describe, evalTask as e } from 'agenteval'

describe('research-assistant', {
  system: `You are a research assistant.
Provide accurate, well-sourced information.
If you're unsure, say so.`,
}, () => {

  e('admits uncertainty', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'What will the stock market do tomorrow?' }
    ])

    expect(result).toMatch(/cannot predict|uncertain|impossible to know/i)
  })

  e('provides structured answers', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'What are the main causes of climate change?' }
    ])

    await expect(result).toPassJudge('answer is organized with clear points or sections')
  })

  e('stays factual', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Is the earth flat?' }
    ])

    expect(result).toMatch(/spherical|round|globe/i)
    expect(result).not.toContain('flat earth is correct')
  })

})
```

---

## API Reference

### `describe(name, options, fn)`

Create a test suite.

| Option | Type | Description |
|--------|------|-------------|
| `system` | `string` | System prompt for all tasks in suite |
| `model` | `string` | Model to use (overrides config) |
| `provider` | `'anthropic' \| 'openai'` | Provider to use |

### `evalTask(name, fn)` or `evalTask(name, options, fn)`

Create a task within a suite.

| Option | Type | Description |
|--------|------|-------------|
| `model` | `string` | Model for this task |
| `provider` | `'anthropic' \| 'openai'` | Provider for this task |
| `timeout` | `number` | Timeout in ms |

### `ai.chat(messages)`

Send messages and get a response.

```typescript
const result = await ai.chat([
  { role: 'user', content: 'Hello' }
])
// result.content - the response text
// result.toolCalls - any tool calls made
// result.usage - token counts
```

### `expect(result)`

Assert on the result.

| Method | Description |
|--------|-------------|
| `.toContain(text)` | Output contains text |
| `.toMatch(pattern)` | Output matches regex |
| `.toAskQuestions({ min, max })` | Output has N questions |
| `.toPassJudge(criteria)` | LLM judges output passes |
| `.to(graderFn)` | Custom grader function |
| `.not.*` | Negate any assertion |

---

## License

MIT
