import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'

async function sendAndCapturePrompt(app: Page, state: { prompts: string[] }, text: string) {
  const before = state.prompts.length
  await app.fill('textarea[placeholder="Send a message"]', text)
  await app.press('textarea[placeholder="Send a message"]', 'Enter')
  await expect.poll(() => state.prompts.length, { timeout: 15000 }).toBeGreaterThan(before)
  return state.prompts.at(-1)!
}

test.describe('personas', () => {
  test('defaults to speaking as the account profile', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('')
  })

  test("only offers the user's other characters", async ({ app }) => {
    await app.goto('/chat/chat-1')
    const options = await app.locator('select[aria-label="Speak as"] option').allTextContents()
    // The chat's own character cannot also be the one speaking for the user.
    expect(options).not.toContain('Aria')
    expect(options).toContain('Borin')
  })

  test('sends the persona and puts its name and persona in the prompt', async ({ app, stub }) => {
    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'char-2')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('char-2')

    const prompt = await sendAndCapturePrompt(app, stub.state, 'Hello from the persona.')

    // The user's own message, not the bot persist that follows it -- that one carries the
    // replying character as `impersonate` instead.
    const userSend = stub.state.sends.find((send) => !send.bot)
    expect(userSend?.impersonate?._id).toBe('char-2')
    // Borin's persona text reaches the prompt as the impersonated personality.
    expect(prompt).toContain('gruff')
  })

  test('renders an impersonated message as the user own, not as a bot', async ({ app, stub }) => {
    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'char-2')
    await sendAndCapturePrompt(app, stub.state, 'Spoken as Borin.')

    // The server stamps it with a characterId; authorship comes from userId instead.
    const row = app.locator('li', { hasText: 'Spoken as Borin.' }).first()
    await expect(row).toHaveClass(/flex-row-reverse/)
  })

  test('survives a reload', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'char-2')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('char-2')

    await app.reload()
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('char-2')
  })

  test("injects the persona's own memory book", async ({ app, stub }) => {
    // Borin carries lore of his own, which must reach the prompt when speaking as him.
    stub.state.personaBookFor = {
      'char-2': {
        kind: 'memory',
        _id: 'b',
        userId: 'user-1',
        name: 'Borin lore',
        description: '',
        entries: [
          {
            name: 'Forge',
            keywords: ['forge'],
            entry: 'PERSONA-FORGE-FACT',
            priority: 0,
            weight: 0,
            enabled: true,
          },
        ],
      },
    }

    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'char-2')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('char-2')

    const prompt = await sendAndCapturePrompt(app, stub.state, 'Tell me about the forge.')
    expect(prompt).toContain('PERSONA-FORGE-FACT')
  })
})
