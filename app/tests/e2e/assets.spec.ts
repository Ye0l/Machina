import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'
import { BASE_PNG } from './stub-server'

async function sendAndCapturePrompt(app: Page, state: { prompts: string[] }, text: string) {
  const before = state.prompts.length
  await app.fill('textarea[placeholder="Send a message"]', text)
  await app.press('textarea[placeholder="Send a message"]', 'Enter')
  await expect.poll(() => state.prompts.length, { timeout: 15000 }).toBeGreaterThan(before)
  return state.prompts.at(-1)!
}

async function addAsset(app: Page, name: string) {
  await app.goto('/character/char-1/assets')
  await app.setInputFiles('input[type=file]', {
    name: `${name}.png`,
    mimeType: 'image/png',
    buffer: BASE_PNG,
  })
  await app.fill('input[placeholder="e.g. smiling"]', name)
  await app.click('button:has-text("Add asset")')
  await expect(app.locator(`main code:text-is("{{asset:${name}}}")`)).toBeVisible()
}

test.describe('character assets', () => {
  test('are uploaded from the workspace and listed with their tag', async ({ app }) => {
    await addAsset(app, 'smiling')

    // The tag is the whole interface to the model, so the list shows it rather than a filename.
    await expect(app.locator('main img[alt="smiling"]')).toBeVisible()
  })

  test('are removed again', async ({ app }) => {
    await addAsset(app, 'smiling')

    app.once('dialog', (dialog) => dialog.accept())
    await app.click('button[aria-label="Remove smiling"]')

    await expect(app.locator('main img[alt="smiling"]')).toHaveCount(0)
    await expect(app.getByText('No assets.')).toBeVisible()
  })

  /**
   * The point of the feature: the model cannot show an asset it was never told about, so the
   * instruction has to reach the prompt without the user editing a template.
   */
  test('put their names and the tag rule into the assembled prompt', async ({ app, stub }) => {
    await addAsset(app, 'smiling')

    await app.goto('/chat/chat-1')
    const prompt = await sendAndCapturePrompt(app, stub.state, 'Say hello.')

    expect(prompt).toContain('{{asset:name}}')
    expect(prompt).toContain('- smiling')
  })

  test('leave the prompt untouched when the character has none', async ({ app, stub }) => {
    await app.goto('/chat/chat-1')
    const prompt = await sendAndCapturePrompt(app, stub.state, 'Say hello.')

    expect(prompt).not.toContain('{{asset:name}}')
  })

  test('a tag in a reply renders as the image it names', async ({ app, stub }) => {
    await addAsset(app, 'smiling')

    stub.state.extraMessages = [
      {
        _id: 'msg-asset',
        kind: 'chat-message',
        chatId: 'chat-1',
        characterId: 'char-1',
        msg: 'Here you go. {{asset:smiling}}',
        retries: [],
        createdAt: '',
        updatedAt: '',
      },
    ]

    await app.goto('/chat/chat-1')
    const rendered = app.locator('.rendered-markdown img.chat-asset')
    await expect(rendered).toBeVisible()
    await expect(rendered).toHaveAttribute('alt', 'smiling')
  })

  test('a tag naming nothing is left visible rather than silently dropped', async ({
    app,
    stub,
  }) => {
    stub.state.extraMessages = [
      {
        _id: 'msg-asset',
        kind: 'chat-message',
        chatId: 'chat-1',
        characterId: 'char-1',
        msg: 'Look: {{asset:invented}}',
        retries: [],
        createdAt: '',
        updatedAt: '',
      },
    ]

    await app.goto('/chat/chat-1')
    // Scoped by content: the greeting is the first rendered message in this chat.
    await expect(app.locator('.rendered-markdown', { hasText: 'Look:' })).toContainText(
      '{{asset:invented}}'
    )
    await expect(app.locator('img.chat-asset')).toHaveCount(0)
  })
})
