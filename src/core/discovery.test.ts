import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { discoverEvalFiles, filterByPattern } from './discovery.js'

describe('discoverEvalFiles', () => {
  let testDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `agenteval-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  it('finds eval files', async () => {
    writeFileSync(join(testDir, 'test.eval.ts'), '')
    writeFileSync(join(testDir, 'another.eval.ts'), '')
    writeFileSync(join(testDir, 'not-an-eval.ts'), '')

    const files = await discoverEvalFiles({
      cwd: testDir,
      include: ['**/*.eval.ts'],
    })

    expect(files).toHaveLength(2)
    expect(files.some(f => f.includes('test.eval.ts'))).toBe(true)
    expect(files.some(f => f.includes('another.eval.ts'))).toBe(true)
  })

  it('respects exclude patterns', async () => {
    mkdirSync(join(testDir, 'node_modules'), { recursive: true })
    writeFileSync(join(testDir, 'test.eval.ts'), '')
    writeFileSync(join(testDir, 'node_modules', 'dep.eval.ts'), '')

    const files = await discoverEvalFiles({
      cwd: testDir,
      include: ['**/*.eval.ts'],
      exclude: ['**/node_modules/**'],
    })

    expect(files).toHaveLength(1)
    expect(files[0]).toContain('test.eval.ts')
  })

  it('finds nested eval files', async () => {
    mkdirSync(join(testDir, 'nested', 'deep'), { recursive: true })
    writeFileSync(join(testDir, 'root.eval.ts'), '')
    writeFileSync(join(testDir, 'nested', 'middle.eval.ts'), '')
    writeFileSync(join(testDir, 'nested', 'deep', 'bottom.eval.ts'), '')

    const files = await discoverEvalFiles({
      cwd: testDir,
      include: ['**/*.eval.ts'],
    })

    expect(files).toHaveLength(3)
  })

  it('returns empty array when no files found', async () => {
    const files = await discoverEvalFiles({
      cwd: testDir,
      include: ['**/*.eval.ts'],
    })

    expect(files).toHaveLength(0)
  })

  it('returns sorted files', async () => {
    writeFileSync(join(testDir, 'z.eval.ts'), '')
    writeFileSync(join(testDir, 'a.eval.ts'), '')
    writeFileSync(join(testDir, 'm.eval.ts'), '')

    const files = await discoverEvalFiles({
      cwd: testDir,
      include: ['**/*.eval.ts'],
    })

    expect(files[0]).toContain('a.eval.ts')
    expect(files[2]).toContain('z.eval.ts')
  })
})

describe('filterByPattern', () => {
  it('filters files by pattern', () => {
    const files = ['/path/to/auth.eval.ts', '/path/to/user.eval.ts', '/path/to/payment.eval.ts']

    const filtered = filterByPattern(files, 'auth')

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toContain('auth')
  })

  it('is case insensitive', () => {
    const files = ['/path/to/Auth.eval.ts', '/path/to/user.eval.ts']

    const filtered = filterByPattern(files, 'auth')

    expect(filtered).toHaveLength(1)
  })

  it('supports regex patterns', () => {
    const files = ['/path/to/auth.eval.ts', '/path/to/auth2.eval.ts', '/path/to/user.eval.ts']

    const filtered = filterByPattern(files, 'auth\\d')

    expect(filtered).toHaveLength(1)
    expect(filtered[0]).toContain('auth2')
  })

  it('returns all files when pattern matches all', () => {
    const files = ['/path/to/test1.eval.ts', '/path/to/test2.eval.ts']

    const filtered = filterByPattern(files, 'test')

    expect(filtered).toHaveLength(2)
  })

  it('returns empty array when nothing matches', () => {
    const files = ['/path/to/auth.eval.ts', '/path/to/user.eval.ts']

    const filtered = filterByPattern(files, 'nonexistent')

    expect(filtered).toHaveLength(0)
  })
})
