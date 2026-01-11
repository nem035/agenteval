import { glob } from 'glob'
import { defaultConfig } from '../config/defaults.js'

export interface DiscoveryOptions {
  cwd?: string
  include?: string[]
  exclude?: string[]
}

/**
 * Discover eval files based on glob patterns
 */
export async function discoverEvalFiles(
  options: DiscoveryOptions = {}
): Promise<string[]> {
  const {
    cwd = process.cwd(),
    include = defaultConfig.include,
    exclude = defaultConfig.exclude,
  } = options

  const files = await glob(include, {
    cwd,
    ignore: exclude,
    absolute: true,
    nodir: true,
  })

  // Sort for consistent ordering
  return files.sort()
}

/**
 * Filter files by pattern (for --grep)
 */
export function filterByPattern(files: string[], pattern: string): string[] {
  const regex = new RegExp(pattern, 'i')
  return files.filter((file) => regex.test(file))
}
