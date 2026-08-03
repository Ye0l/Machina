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

async function addAsset(app: Page, name: string, folder = '') {
  await app.goto('/character/char-1/assets')
  await app.setInputFiles('input[type=file]', {
    name: `${name}.png`,
    mimeType: 'image/png',
    buffer: BASE_PNG,
  })
  await app.fill('input[placeholder="e.g. smiling"]', name)
  if (folder) await app.fill('input[placeholder="e.g. Scenes/Night"]', folder)
  await app.click('button:has-text("Add asset")')
  await expect(app.locator(`main li code:text-is("{{asset::${name}}}")`)).toBeVisible()
}

test.describe('character assets', () => {
  test('are uploaded from the workspace and listed with their tag', async ({ app }) => {
    await addAsset(app, 'smiling')

    // The tag is the whole interface to the model, so the list shows it rather than a filename.
    await expect(app.locator('main img[alt="smiling"]')).toBeVisible()
  })

  test('groups assets by nested folder and moves them between folders', async ({ app }) => {
    await addAsset(app, 'smiling', 'Scenes// Night')

    const scenes = app.getByRole('region', { name: 'Scenes/Night' })
    await expect(scenes.locator('img[alt="smiling"]')).toBeVisible()
    const folderInput = scenes.getByLabel('Folder for smiling')
    await folderInput.fill('Portraits/Closeups')
    await folderInput.press('Tab')

    const portraits = app.getByRole('region', { name: 'Portraits/Closeups' })
    await expect(portraits.locator('img[alt="smiling"]')).toBeVisible()
    await expect(app.getByRole('region', { name: 'Scenes/Night' })).toHaveCount(0)
  })

  test('accepts an image pasted from the clipboard', async ({ app }) => {
    await app.goto('/character/char-1/assets')
    const textPasteAllowed = await app.evaluate(() => {
      const clipboard = new DataTransfer()
      clipboard.setData('text/plain', 'ordinary text')
      return window.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboard,
        })
      )
    })
    expect(textPasteAllowed).toBe(true)
    await app.evaluate((bytes) => {
      const clipboard = new DataTransfer()
      clipboard.items.add(new File([new Uint8Array(bytes)], 'image.png', { type: 'image/png' }))
      window.dispatchEvent(
        new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: clipboard,
        })
      )
    }, Array.from(BASE_PNG))

    const nameInput = app.locator('input[placeholder="e.g. smiling"]')
    await expect(nameInput).toHaveValue('pasted-image')
    await expect(app.locator('img[alt="pasted-image"]')).toBeVisible()
    await nameInput.fill('clipboard-art')
    await app.getByRole('button', { name: 'Add asset' }).click()
    await expect(app.locator('main img[alt="clipboard-art"]')).toBeVisible()
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

    expect(prompt).toContain('{{asset::name}}')
    expect(prompt).toContain('- smiling')
  })

  test('leave the prompt untouched when the character has none', async ({ app, stub }) => {
    await app.goto('/chat/chat-1')
    const prompt = await sendAndCapturePrompt(app, stub.state, 'Say hello.')

    expect(prompt).not.toContain('{{asset::name}}')
  })

  test('renders an asset in the first message as a native media block', async ({ app }) => {
    await addAsset(app, 'smiling')
    await app.goto('/chat/chat-1')

    await app.locator('button[aria-label="Edit message"]').first().click()
    await app.locator('textarea[aria-label="Edit message"]').fill('Opening {{asset::smiling}}')
    await app.click('button:has-text("Save")')

    const rendered = app.locator('button.chat-asset-frame img.chat-asset').first()
    await expect(rendered).toBeVisible()
    await expect(rendered).toHaveAttribute('alt', 'smiling')
    const body = rendered.locator(
      'xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " chat-message-body ")][1]'
    )
    await expect(body).toContainText('Opening')
    await expect(body.locator('img.chat-asset')).toHaveCount(1)
    const row = body.locator('xpath=ancestor::li[1]')
    const viewport = app.locator('ol[aria-live="polite"]')
    const [imageBox, bodyBox, rowBox, viewportBox] = await Promise.all([
      rendered.boundingBox(),
      body.boundingBox(),
      row.boundingBox(),
      viewport.boundingBox(),
    ])
    if (!imageBox || !bodyBox || !rowBox || !viewportBox) {
      throw new Error('The rendered asset layout has no measurable bounds')
    }
    expect(imageBox.x).toBeGreaterThanOrEqual(bodyBox.x)
    expect(imageBox.x + imageBox.width).toBeLessThanOrEqual(bodyBox.x + bodyBox.width)
    expect(imageBox.y).toBeGreaterThanOrEqual(bodyBox.y)
    expect(imageBox.y + imageBox.height).toBeLessThanOrEqual(bodyBox.y + bodyBox.height)
    expect(bodyBox.x).toBeGreaterThanOrEqual(rowBox.x)
    expect(bodyBox.x + bodyBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width)
    expect(bodyBox.x).toBeGreaterThanOrEqual(viewportBox.x)
    expect(bodyBox.x + bodyBox.width).toBeLessThanOrEqual(viewportBox.x + viewportBox.width)
    await expect(rendered).toHaveCSS('object-fit', 'contain')
    await expect(
      rendered.locator('xpath=ancestor::div[contains(@class,"rendered-markdown")]')
    ).toHaveCount(0)

    await rendered.click()
    await expect(app.getByRole('dialog', { name: 'smiling' })).toBeVisible()
    await app.keyboard.press('Escape')
    await expect(app.getByRole('dialog', { name: 'smiling' })).toHaveCount(0)
  })

  test('a tag in a reply renders as the image it names', async ({ app, stub }) => {
    await addAsset(app, 'smiling')

    stub.state.extraMessages = [
      {
        _id: 'msg-asset',
        kind: 'chat-message',
        chatId: 'chat-1',
        characterId: 'char-1',
        msg: 'Here you go. {{asset::smiling}}',
        retries: [],
        createdAt: '',
        updatedAt: '',
      },
    ]

    await app.goto('/chat/chat-1')
    const rendered = app.locator('button.chat-asset-frame img.chat-asset')
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
        msg: 'Look: {{asset::invented}}',
        retries: [],
        createdAt: '',
        updatedAt: '',
      },
    ]

    await app.goto('/chat/chat-1')
    await expect(app.locator('.rendered-markdown', { hasText: 'Look:' })).toContainText('Look:')
    const unresolved = app.locator('.asset-tag-missing')
    await expect(unresolved).toBeVisible()
    await expect(unresolved).toContainText('{{asset::invented}}')
    await expect(app.locator('img.chat-asset')).toHaveCount(0)
  })
})
