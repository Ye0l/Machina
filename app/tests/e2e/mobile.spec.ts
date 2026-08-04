import { expect, test } from './fixtures'

test.describe('mobile layout', () => {
  test('the drawer routes and closes', async ({ app }) => {
    await app.goto('/')
    // The card heading, not the sidebar entry -- the sidebar is hidden at this width.
    await app.waitForSelector('h2:text-is("Aria")')

    await app.click('button[aria-label="Open menu"]')
    const drawerLink = app.getByRole('link', { name: 'Settings' })
    await expect(drawerLink).toBeVisible()

    await drawerLink.click()

    await expect(app).toHaveURL(/\/settings$/)
    // The drawer is the only thing that shows nav links at this width, so none being
    // visible is exactly "the drawer closed".
    await expect(app.getByRole('link', { name: 'Settings' })).toHaveCount(0)
  })

  // Chat controls must not consume vertical space until the user explicitly asks for them.
  test('does not reserve space for a mobile chat title header', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()

    await expect(app.getByTestId('desktop-chat-header')).not.toBeVisible()
    await expect(app.getByTestId('mobile-chat-options')).toBeVisible()
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(0)

    const chatBox = await app.getByTestId('chat-view').boundingBox()
    const messagesBox = await app.locator('ol[aria-live="polite"]').boundingBox()
    expect(Math.abs((messagesBox?.y ?? 0) - (chatBox?.y ?? 0))).toBeLessThanOrEqual(1)

    await app.getByTestId('mobile-chat-options').click()
    await expect(app.getByTestId('chat-controls')).toBeVisible()
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(1)

    const expandedMessagesBox = await app.locator('ol[aria-live="polite"]').boundingBox()
    expect(Math.abs((expandedMessagesBox?.y ?? 0) - (messagesBox?.y ?? 0))).toBeLessThanOrEqual(0.5)
    expect(
      Math.abs((expandedMessagesBox?.height ?? 0) - (messagesBox?.height ?? 0))
    ).toBeLessThanOrEqual(0.5)
  })

  test('blocks global zoom and does not add bottom safe-area padding to chat', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()

    const viewport = await app.locator('meta[name="viewport"]').getAttribute('content')
    expect(viewport).toContain('maximum-scale=1')
    expect(viewport).toContain('user-scalable=no')
    expect(viewport).toContain('interactive-widget=resizes-content')

    const composerPaddingBottom = await app
      .getByTestId('chat-view')
      .locator('form')
      .evaluate((form) => getComputedStyle(form.parentElement!).paddingBottom)
    expect(Number.parseFloat(composerPaddingBottom)).toBe(0)

    const inputFontSize = await app
      .getByPlaceholder('Send a message')
      .evaluate((input) => getComputedStyle(input).fontSize)
    expect(Number.parseFloat(inputFontSize)).toBeGreaterThanOrEqual(16)
  })

  test('no view scrolls the page horizontally', async ({ app }) => {
    for (const path of ['/', '/settings/display', '/memory', '/character/new']) {
      await app.goto(path)
      await app.waitForLoadState('networkidle')

      const overflows = await app.evaluate(
        () => document.body.scrollWidth > document.body.clientWidth
      )
      expect(overflows, `${path} scrolls horizontally`).toBe(false)
    }
  })
})
