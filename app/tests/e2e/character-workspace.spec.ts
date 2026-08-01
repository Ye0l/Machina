import { expect, test } from './fixtures'

test.describe('character workspace', () => {
  test('the chats tab lists that character chats only', async ({ app, stub }) => {
    stub.state.extraChats = [
      { _id: 'x-1', name: 'Second Aria chat', characterId: 'char-1', updatedAt: '', genPreset: '' },
      { _id: 'x-2', name: 'A Borin chat', characterId: 'char-2', updatedAt: '', genPreset: '' },
    ]

    await app.goto('/character/char-1')
    await expect(app.getByRole('heading', { name: 'Aria' })).toBeVisible()

    // Scoped to the workspace: the sidebar lists recent chats across all characters.
    const list = app.locator('main')
    await expect(list.locator('a[href="/chat/chat-1"]')).toBeVisible()
    await expect(list.locator('a[href="/chat/x-1"]')).toBeVisible()
    // Another character's chat must not appear here.
    await expect(list.locator('a[href="/chat/x-2"]')).toHaveCount(0)
  })

  test('a long chat list renders incrementally as it is scrolled', async ({ app, stub }) => {
    // More than one page, so the first render is a window rather than the whole list.
    stub.state.extraChats = Array.from({ length: 45 }, (_, i) => ({
      _id: `bulk-${i}`,
      name: `Bulk chat ${i}`,
      characterId: 'char-1',
      updatedAt: '',
      genPreset: '',
    }))

    await app.goto('/character/char-1')
    // Scoped to the workspace, so the sidebar's recent chats are not counted.
    const rows = app.locator('main a[href^="/chat/"]')
    await expect(rows.first()).toBeVisible()

    const first = await rows.count()
    expect(first).toBeLessThan(46)

    // Scrolling to the end of the rendered window grows it.
    await rows.last().scrollIntoViewIfNeeded()
    await expect.poll(() => rows.count()).toBeGreaterThan(first)
  })

  test('the tabs are deep-linkable and switch the URL', async ({ app }) => {
    await app.goto('/character/char-1')
    await expect(app.getByRole('tab', { name: 'Chats' })).toHaveAttribute('aria-selected', 'true')

    await app.getByRole('tab', { name: 'Memory book' }).click()
    await expect(app).toHaveURL(/\/character\/char-1\/book$/)

    await app.getByRole('tab', { name: 'Character' }).click()
    await expect(app).toHaveURL(/\/character\/char-1\/edit$/)
    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Aria')
  })

  test('the editor tab can be saved on a wide screen, where there is no header', async ({
    app,
    stub,
  }) => {
    await app.goto('/character/char-1/edit')
    await app.fill('input[placeholder="Character name"]', 'Aria Renamed')

    // The workspace supplies the header, so the editor's own save button lives in its footer
    // -- which used to be small-screen only, leaving this tab with no way to save at all.
    await app.click('button:has-text("Save character")')

    await expect.poll(() => stub.state.characterUpdates.length).toBeGreaterThan(0)
    expect(stub.state.characterUpdates[0].id).toBe('char-1')
    // Leaving is no longer guarded, because the edit was saved rather than abandoned.
    await app.click('a:has-text("Characters")')
    await expect(app).toHaveURL(/\/$/)
  })

  test("a character's own memory book saves onto the character", async ({ app, stub }) => {
    await app.goto('/character/char-1/book')
    await app.waitForSelector('button:has-text("Add entry")')

    await app.click('button:has-text("Add entry")')
    await app.fill('input[placeholder="For your reference only"]', 'Homeland')
    await app.fill('input[placeholder="Add keyword…"]', 'valley')
    await app.press('input[placeholder="Add keyword…"]', 'Enter')
    await app.fill(
      'textarea[placeholder="Text injected into the prompt when a keyword matches"]',
      'ARIA-VALLEY-FACT'
    )
    await app.click('button:has-text("Save memory book")')

    await expect.poll(() => stub.state.characterUpdates.length).toBe(1)
    const update = stub.state.characterUpdates[0]
    expect(update.id).toBe('char-1')
    expect(update.body.characterBook.entries).toHaveLength(1)
    expect(update.body.characterBook.entries[0].keywords).toEqual(['valley'])
    expect(update.body.characterBook.entries[0].entry).toContain('ARIA-VALLEY-FACT')
  })

  test('exporting is reachable from the workspace, not only the editor', async ({ app }) => {
    await app.goto('/character/char-1')
    await expect(app.locator('select[aria-label="Export character"]')).toBeVisible()

    // Still there on the other tabs, since it applies to the character.
    await app.goto('/character/char-1/edit')
    await expect(app.locator('select[aria-label="Export character"]')).toBeVisible()
  })
})
