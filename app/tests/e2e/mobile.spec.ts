import { expect, test } from './fixtures'

test.describe('mobile layout', () => {
  test('the drawer routes and closes', async ({ app }) => {
    await app.goto('/')
    // The card heading, not the sidebar entry -- the sidebar is hidden at this width.
    await app.waitForSelector('h2:text-is("Aria")')

    await app.click('button[aria-label="Open menu"]')
    // The desktop sidebar is still in the DOM behind a breakpoint, so scope to the visible one.
    const drawerLink = app.locator('a:has-text("AI settings"):visible')
    await expect(drawerLink).toBeVisible()

    await drawerLink.click()

    await expect(app).toHaveURL(/\/settings$/)
    // The drawer is the only thing that shows nav links at this width, so none being
    // visible is exactly "the drawer closed".
    await expect(app.locator('a:has-text("AI settings"):visible')).toHaveCount(0)
  })

  // Chat controls must not consume vertical space until the user explicitly asks for them.
  test('keeps the mobile chat header compact until options are opened', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()

    const header = app.getByTestId('chat-header')
    const box = await header.boundingBox()
    expect(box?.height).toBeLessThanOrEqual(52)
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(0)

    await app.getByTestId('mobile-chat-options').click()
    await expect(app.getByTestId('mobile-chat-controls')).toBeVisible()
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(1)
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
