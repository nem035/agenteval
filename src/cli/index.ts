#!/usr/bin/env node
import { Command } from 'commander'
import { runCommand } from './commands/run.js'
import { initCommand } from './commands/init.js'

const program = new Command()

program
  .name('agenteval')
  .description('A Vitest-like CLI for AI agent evaluations')
  .version('0.1.0')

program
  .command('run', { isDefault: true })
  .description('Run eval files')
  .argument('[patterns...]', 'Glob patterns or file names to run')
  .option('-c, --config <path>', 'Path to config file')
  .option('-g, --grep <pattern>', 'Filter tasks by name pattern')
  .option('-t, --trials <n>', 'Number of trials per task', parseInt)
  .option('--max-cost <usd>', 'Maximum cost limit in USD', parseFloat)
  .option('-r, --reporter <type>', 'Reporter type: console, json', 'console')
  .option('-v, --verbose', 'Show detailed output')
  .option('-m, --model <model>', 'Override default model')
  .option('-p, --provider <name>', 'Override default provider: anthropic, openai')
  .option('--dry-run', 'Show what would be run without executing')
  .action(async (patterns: string[], options) => {
    const exitCode = await runCommand(patterns, options)
    process.exit(exitCode)
  })

program
  .command('init')
  .description('Initialize agenteval in the current directory')
  .action(async () => {
    const exitCode = await initCommand()
    process.exit(exitCode)
  })

program.parse()
