import { describe, evalTask as e } from '../src/index.js'

describe('hello-world', {
  system: 'You are a friendly assistant. Keep responses brief.',
}, () => {

  e('responds to greeting', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'Hello!' }
    ])

    expect(result).toContain('hello', { caseSensitive: false })
  })

  e('answers math questions', async ({ ai, expect }) => {
    const result = await ai.chat([
      { role: 'user', content: 'What is 2 + 2? Just give me the number.' }
    ])

    expect(result).toMatch(/4/)
  })

  e('maintains conversation context', async ({ ai, expect }) => {
    await ai.chat([
      { role: 'user', content: 'My favorite color is blue.' }
    ])

    const result = await ai.chat([
      { role: 'user', content: 'What is my favorite color?' }
    ])

    expect(result).toContain('blue', { caseSensitive: false })
  })
})
