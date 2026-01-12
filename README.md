# agenteval

Test your AI apps like you test your code. A Vitest-like CLI for running evals on LLMs.

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
import { describe, evalTask as e, anthropic } from 'agenteval'

describe('my-agent', {
  ai: anthropic('claude-sonnet-4-20250514'),
  system: 'You are a helpful assistant.',
}, () => {

  e('answers questions', async ({ ai, expect }) => {
    const result = await ai.prompt('What is 2 + 2?')

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
 AGENTEVAL v0.1.0

 my-agent.eval.ts
   my-agent
     ✓ answers questions (1.2s)

 ─────────────────────────────────────────────
 Tests:    1 passed, 1 total
 Time:     1.2s
```

---

## Explicit Provider Configuration

agenteval requires you to explicitly specify which AI provider and model to use. No magic defaults.

```typescript
import { describe, evalTask as e, anthropic, openai } from 'agenteval'

// Use Anthropic
describe('claude-tests', {
  ai: anthropic('claude-sonnet-4-20250514'),
  system: 'You are helpful.',
}, () => { ... })

// Use OpenAI
describe('gpt-tests', {
  ai: openai('gpt-5'),
  system: 'You are helpful.',
}, () => { ... })
```

### Override at Task Level

```typescript
describe('my-tests', {
  ai: anthropic('claude-sonnet-4-20250514'),
  system: 'You are helpful.',
}, () => {

  // Uses anthropic (inherited from describe)
  e('test 1', async ({ ai, expect }) => { ... })

  // Uses openai (override for this task)
  e('test 2', {
    ai: openai('gpt-5'),
  }, async ({ ai, expect }) => { ... })

})
```

### Separate AI for Judging

Use a different (potentially smarter) model for LLM-as-judge evaluations:

```typescript
describe('my-tests', {
  ai: anthropic('claude-sonnet-4-20250514'),      // AI being tested
  judge: anthropic('claude-opus-4-20250514'),     // AI that judges
  system: 'You are helpful.',
}, () => {

  e('test', async ({ ai, expect }) => {
    const result = await ai.prompt('How do I learn programming?')

    // Uses the judge AI
    await expect(result).toPassJudge('responds helpfully')
  })

})
```

---

## Writing Evals

### Checking Output Contains Text

```typescript
e('greets the user', async ({ ai, expect }) => {
  const result = await ai.prompt('Hello!')

  // Case insensitive by default
  expect(result).toContain('hello')

  // Case sensitive
  expect(result).toContain('Hello', { caseSensitive: true })

  // Negation
  expect(result).not.toContain('error')

  // Fluent chaining
  expect(result)
    .toContain('hello')
    .not.toContain('error')
})
```

### Checking Output Matches Pattern

```typescript
e('returns a number', async ({ ai, expect }) => {
  const result = await ai.prompt('Pick a number between 1 and 10')

  expect(result).toMatch(/\d+/)
})
```

### Checking Question Count

```typescript
e('asks clarifying questions', async ({ ai, expect }) => {
  const result = await ai.prompt('Help me with my project')

  expect(result).toAskQuestions({ min: 1, max: 3 })
})
```

### Using LLM as Judge

When rules are hard to express in code:

```typescript
e('responds helpfully', async ({ ai, expect }) => {
  const result = await ai.prompt('How do I learn programming?')

  await expect(result).toPassJudge('gives actionable advice for beginners')
})
```

With options:

```typescript
await expect(result).toPassJudge({
  criteria: 'Response shows empathy and understanding',
  threshold: 0.8,  // Minimum score (0-1) to pass
})
```

### Multi-Turn Conversations

Both `ai.prompt()` and `ai.chat()` maintain conversation history:

```typescript
e('remembers context', async ({ ai, expect }) => {
  await ai.prompt('My name is Alice')

  const result = await ai.prompt('What is my name?')

  expect(result).toContain('Alice')
})
```

### Custom Graders

```typescript
import { defineGrader } from 'agenteval'

const noProfanity = defineGrader('noProfanity', (result) => {
  const badWords = ['damn', 'hell']
  const found = badWords.some(w => result.content.toLowerCase().includes(w))

  return {
    pass: !found,
    reason: found ? 'Response contains profanity' : 'No profanity detected'
  }
})

e('keeps it clean', async ({ ai, expect }) => {
  const result = await ai.prompt('Tell me a joke')

  expect(result).to(noProfanity)
})
```

---

## Configuration

Create `agenteval.config.ts` for shared settings:

```typescript
import { defineConfig } from 'agenteval'

export default defineConfig({
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
  trials: 1,
  timeout: 60000,
  parallel: true,
  maxConcurrency: 5,
})
```

---

## CLI Reference

```bash
# Run all evals
agenteval run

# Run specific file
agenteval run my-agent.eval.ts

# Filter by task name
agenteval run --grep "greeting"

# JSON output for CI
agenteval run --reporter=json

# Stop if cost exceeds $1
agenteval run --max-cost=1.00

# Run each task 5 times
agenteval run --trials=5

# See what would run without executing
agenteval run --dry-run

# Create config and example files
agenteval init
```

---

## CI/CD Integration

agenteval returns exit code 1 when tests fail.

```yaml
# .github/workflows/evals.yml
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

---

## API Reference

### `describe(name, options, fn)`

| Option | Type | Description |
|--------|------|-------------|
| `ai` | `AIConfig` | AI provider config (required) - use `anthropic()` or `openai()` |
| `judge` | `AIConfig` | AI for judging (optional, defaults to `ai`) |
| `system` | `string` | System prompt for all tasks |

### `evalTask(name, fn)` or `evalTask(name, options, fn)`

| Option | Type | Description |
|--------|------|-------------|
| `ai` | `AIConfig` | Override AI for this task |
| `judge` | `AIConfig` | Override judge for this task |
| `timeout` | `number` | Timeout in ms |

### `anthropic(model, options?)` and `openai(model, options?)`

```typescript
anthropic('claude-sonnet-4-20250514')
anthropic('claude-sonnet-4-20250514', { apiKey: 'sk-...' })

openai('gpt-5')
openai('gpt-5', { apiKey: 'sk-...' })
```

### `ai.prompt(content)` and `ai.chat(messages)`

```typescript
// Simple single-turn (recommended)
const result = await ai.prompt('Hello')

// Full control with messages array
const result = await ai.chat([
  { role: 'user', content: 'Hello' },
  { role: 'assistant', content: 'Hi!' },
  { role: 'user', content: 'How are you?' }
])

// Both return:
// result.content - the response text
// result.toolCalls - any tool calls made
// result.usage - token counts
```

### `expect(result)`

All assertions support fluent chaining:

```typescript
expect(result)
  .toContain('hello')
  .toMatch(/greeting/)
  .not.toContain('error')
```

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
