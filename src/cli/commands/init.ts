import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import pc from 'picocolors'

const CONFIG_TEMPLATE = `import { defineConfig } from 'agenteval'

export default defineConfig({
  // Provider configuration
  // API keys can also be set via environment variables:
  // ANTHROPIC_API_KEY, OPENAI_API_KEY
  providers: {
    anthropic: {
      // apiKey: process.env.ANTHROPIC_API_KEY,
    },
    openai: {
      // apiKey: process.env.OPENAI_API_KEY,
    },
  },

  // Default provider and model
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',

  // Test discovery patterns
  include: ['**/*.eval.ts', '**/*.eval.js'],
  exclude: ['node_modules/**', 'dist/**'],

  // Execution settings
  trials: 1,           // Runs per task (for pass@k)
  timeout: 60000,      // Per-task timeout (ms)
  parallel: true,      // Run tasks in parallel
  maxConcurrency: 5,   // Max concurrent tasks

  // LLM Judge configuration
  judge: {
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  },

  // Output reporters
  reporters: ['console'],
})
`

const EXAMPLE_EVAL_TEMPLATE = `import { describe, eval, expect } from 'agenteval'

describe('example-agent', {
  system: 'You are a helpful assistant.',
}, () => {

  eval('responds to greeting', async ({ ai }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Hello!' }
    ])

    expect(result).toContain('hello')
    expect(result).not.toContain('error')
  })

  eval('answers questions', async ({ ai }) => {
    const result = await ai.chat([
      { role: 'user', content: 'What is 2 + 2?' }
    ])

    expect(result).toMatch(/4|four/i)
  })

  eval('is helpful', async ({ ai }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Can you help me?' }
    ])

    // Use LLM judge for nuanced evaluation
    await expect(result).toPassJudge('Responds helpfully and offers assistance')
  })
})
`

export async function initCommand(): Promise<number> {
  const cwd = process.cwd()

  console.log()
  console.log(pc.bold(pc.cyan(' EVALITE')) + ' - Initializing project')
  console.log()

  // Create config file
  const configPath = resolve(cwd, 'agenteval.config.ts')
  if (existsSync(configPath)) {
    console.log(pc.yellow('  ⚠ agenteval.config.ts already exists, skipping'))
  } else {
    writeFileSync(configPath, CONFIG_TEMPLATE)
    console.log(pc.green('  ✓ Created agenteval.config.ts'))
  }

  // Create example eval file
  const examplePath = resolve(cwd, 'example.eval.ts')
  if (existsSync(examplePath)) {
    console.log(pc.yellow('  ⚠ example.eval.ts already exists, skipping'))
  } else {
    writeFileSync(examplePath, EXAMPLE_EVAL_TEMPLATE)
    console.log(pc.green('  ✓ Created example.eval.ts'))
  }

  console.log()
  console.log(' Next steps:')
  console.log(pc.dim('  1. Set your API key:'))
  console.log('     export ANTHROPIC_API_KEY=your-key')
  console.log()
  console.log(pc.dim('  2. Run the example eval:'))
  console.log('     npx agenteval run')
  console.log()

  return 0
}
