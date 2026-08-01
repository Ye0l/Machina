import { expect, expectNoPageErrors, test, waitForLibrary } from './fixtures'

const path = (page: import('@playwright/test').Page) => page.evaluate(() => location.pathname)

test.describe('deep links', () => {
  test('the root renders the character library', async ({ app }) => {
    await app.goto('/')
    await waitForLibrary(app)
    expectNoPageErrors(app)
  })

  test('/chat/:id loads the chat on a cold load', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()
    expect(await path(app)).toBe('/chat/chat-1')
  })

  test('a chat deep link still populates the sidebar chat list', async ({ app }) => {
    // The list load is not tied to the library mounting; a chat can be the entry point.
    await app.goto('/chat/chat-1')
    await expect(app.locator('a[href="/chat/chat-2"]')).toBeVisible()
  })

  test('/settings/:tab selects that tab', async ({ app }) => {
    await app.goto('/settings/display')
    await expect(app.getByRole('tab', { name: 'Display' })).toHaveAttribute('aria-selected', 'true')
    expect(await path(app)).toBe('/settings/display')
  })

  test('/character/:id opens that character workspace on its chats', async ({ app }) => {
    await app.goto('/character/char-2')
    await expect(app.getByRole('heading', { name: 'Borin' })).toBeVisible()
    await expect(app.getByRole('tab', { name: 'Chats' })).toHaveAttribute('aria-selected', 'true')
  })

  test('/character/:id/edit opens the editor for that character', async ({ app }) => {
    await app.goto('/character/char-2/edit')
    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Borin')
  })

  test('/character/:id/book opens that character own memory book', async ({ app }) => {
    await app.goto('/character/char-1/book')
    await expect(app.getByRole('tab', { name: 'Memory book' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  test('/character/new opens an empty editor', async ({ app }) => {
    await app.goto('/character/new')
    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('')
  })

  test('an unknown path canonicalises to the library', async ({ app }) => {
    await app.goto('/does-not-exist')
    await waitForLibrary(app)
    expect(await path(app)).toBe('/')
  })

  test('a chat that cannot be loaded does not keep its URL', async ({ app, stub }) => {
    await app.goto('/chat/nope')
    await waitForLibrary(app)
    expect(await path(app)).toBe('/')
    // The only 4xx the client should have provoked is the missing chat itself.
    expect(stub.state.failedResponses).toEqual(['404 /api/chat/nope'])
  })
})

test.describe('navigation', () => {
  test('sidebar entries are real anchors', async ({ app }) => {
    await app.goto('/')
    await waitForLibrary(app)
    await expect(app.locator('a:has-text("AI settings")')).toHaveAttribute('href', '/settings')
  })

  test('back returns to the previous chat and re-renders it', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()

    await app.click('a:has-text("AI settings")')
    await expect(app).toHaveURL(/\/settings$/)

    await app.goBack()
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()
    expect(await path(app)).toBe('/chat/chat-1')

    await app.goForward()
    await expect(app).toHaveURL(/\/settings$/)
  })

  test('switching a settings tab updates the URL', async ({ app }) => {
    await app.goto('/settings/display')
    await app.getByRole('tab', { name: 'Presets' }).click()
    expect(await path(app)).toBe('/settings/presets')
  })
})

test.describe('unsaved-changes guard', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('/character/new')
    await app.fill('input[placeholder="Character name"]', 'Dirty draft')
    // The dirty flag is derived, so give it a tick to propagate.
    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Dirty draft')
  })

  test('dismissing keeps both the URL and the editor', async ({ app }) => {
    app.once('dialog', (dialog) => dialog.dismiss())
    await app.click('a:has-text("Characters")')

    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Dirty draft')
    expect(await path(app)).toBe('/character/new')
  })

  test('the browser back button is guarded too', async ({ app }) => {
    app.once('dialog', (dialog) => dialog.dismiss())
    // history.back() rather than page.goBack(): a refused same-document pop never fires the
    // `load` event that goBack() waits for.
    await app.evaluate(() => history.back())
    await app.waitForTimeout(500)

    expect(await path(app)).toBe('/character/new')
    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Dirty draft')
  })

  test('accepting navigates away', async ({ app }) => {
    app.once('dialog', (dialog) => dialog.accept())
    await app.click('a:has-text("Characters")')

    await waitForLibrary(app)
    expect(await path(app)).toBe('/')
  })
})
