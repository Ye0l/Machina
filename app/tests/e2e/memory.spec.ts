import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'

/** Creates a book through the UI and returns once the list shows it. */
async function createBook(app: Page) {
  await app.goto('/memory/new')
  await app.waitForSelector('input[placeholder="Book name"]')

  await app.fill('input[placeholder="Book name"]', 'Lore')
  await app.fill('input[placeholder="What this book covers"]', 'World facts')
  await app.fill('input[placeholder="For your reference only"]', 'Dragons')
  await app.fill('input[placeholder="Add keyword…"]', 'dragon')
  await app.press('input[placeholder="Add keyword…"]', 'Enter')
  await app.fill(
    'textarea[placeholder="Text injected into the prompt when a keyword matches"]',
    'MEMORY-DRAGON-FACT: dragons fear iron bells.'
  )
  await app.click('button:has-text("Save book")')
  await expect(app.getByRole('heading', { name: 'Lore', exact: true })).toBeVisible()
}

/** Sends a message and returns the prompt the client assembled for it. */
async function sendAndCapturePrompt(app: Page, state: { prompts: string[] }, text: string) {
  const before = state.prompts.length
  await app.fill('textarea[placeholder="Send a message"]', text)
  await app.press('textarea[placeholder="Send a message"]', 'Enter')
  await expect.poll(() => state.prompts.length, { timeout: 15000 }).toBeGreaterThan(before)
  return state.prompts.at(-1)!
}

test.describe('memory books', () => {
  test('the empty state and the new-book route render', async ({ app }) => {
    await app.goto('/memory')
    await expect(app.getByText('No memory books yet')).toBeVisible()

    await app.click('a:has-text("Create memory book")')
    await expect(app).toHaveURL(/\/memory\/new$/)
  })

  test('creating a book persists its entry', async ({ app, stub }) => {
    await createBook(app)

    await expect(app).toHaveURL(/\/memory$/)
    expect(stub.state.memoryBooks).toHaveLength(1)
    expect(stub.state.memoryBooks[0].name).toBe('Lore')
    expect(stub.state.memoryBooks[0].entries).toHaveLength(1)
    expect(stub.state.memoryBooks[0].entries[0].keywords).toEqual(['dragon'])
  })

  test('a book deep link loads its stored values', async ({ app, stub }) => {
    await createBook(app)

    // A direct load: the shell and the editor both request the list on the same tick.
    await app.goto(`/memory/${stub.state.memoryBooks[0]._id}`)
    await expect(app.locator('input[placeholder="Book name"]')).toHaveValue('Lore')
  })

  test('attaching a book writes memoryId on the chat', async ({ app, stub }) => {
    await createBook(app)
    await app.goto('/chat/chat-1')
    await app.waitForSelector('select[aria-label="Memory book"]')

    await app.selectOption('select[aria-label="Memory book"]', stub.state.memoryBooks[0]._id)

    await expect
      .poll(() => stub.state.chatUpdates.map((update) => update.body.memoryId))
      .toEqual([stub.state.memoryBooks[0]._id])
  })

  /**
   * The point of the feature: the entry has to reach the model. The stub records the prompt
   * the client assembled, so this asserts on the prompt itself rather than on the UI.
   */
  test('a matched keyword injects the entry into the assembled prompt', async ({ app, stub }) => {
    await createBook(app)
    await app.goto('/chat/chat-1')
    await app.waitForSelector('select[aria-label="Memory book"]')
    await app.selectOption('select[aria-label="Memory book"]', stub.state.memoryBooks[0]._id)
    await expect.poll(() => stub.state.chatUpdates.length).toBe(1)

    // Unmatched first: memory scans recent history, so once the keyword has been said it
    // stays matched on later turns.
    const unmatched = await sendAndCapturePrompt(app, stub.state, 'Just a sentence about nothing.')
    expect(unmatched).not.toContain('MEMORY-DRAGON-FACT')

    const matched = await sendAndCapturePrompt(app, stub.state, 'Tell me about the dragon.')
    expect(matched).toContain('MEMORY-DRAGON-FACT')

    // Detaching stops it, even though the keyword is still in recent history.
    await app.selectOption('select[aria-label="Memory book"]', '')
    await expect.poll(() => stub.state.chatUpdates.length).toBe(2)

    const detached = await sendAndCapturePrompt(app, stub.state, 'What about the dragon now?')
    expect(detached).not.toContain('MEMORY-DRAGON-FACT')
  })
})
