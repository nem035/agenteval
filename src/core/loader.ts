import { pathToFileURL } from 'node:url'
import type { Suite } from '../types.js'
import {
  resetRegistry,
  setCurrentFile,
  getCollectedSuites,
} from './registry.js'

/**
 * Load eval files and collect their suites
 */
export async function loadEvalFiles(files: string[]): Promise<Suite[]> {
  const allSuites: Suite[] = []

  for (const file of files) {
    resetRegistry()
    setCurrentFile(file)

    // Import the file - this will execute describe/eval calls
    // which populate the registry
    const fileUrl = pathToFileURL(file).href
    await import(fileUrl)

    // Collect suites from this file
    const suites = getCollectedSuites()
    allSuites.push(...suites)
  }

  resetRegistry()
  return allSuites
}
