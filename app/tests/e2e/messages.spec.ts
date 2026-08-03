import { expect, expectNoPageErrors, test } from './fixtures'

test.describe('message rendering', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('/chat/chat-1')
    await app.waitForSelector('.rendered-markdown')
  })

  test('renders markdown as real elements', async ({ app }) => {
    const body = await app.evaluate(() =>
      [...document.querySelectorAll('.rendered-markdown')].map((n) => n.innerHTML).join('\n')
    )

    expect(body).toContain('<strong>bold</strong>')
    expect(body).toContain('<em>italic</em>')
    expect(body).toContain('<code>inline code</code>')
    await expect(app.locator('.rendered-markdown li')).toHaveCount(2)
    await expect(app.locator('.rendered-markdown a[href="https://example.com"]')).toHaveCount(1)
  })

  test('wraps quoted dialogue in <q> with <qem> emphasis', async ({ app }) => {
    const body = await app.evaluate(() =>
      [...document.querySelectorAll('.rendered-markdown')].map((n) => n.innerHTML).join('\n')
    )

    expect(body).toMatch(/<q>"A quoted line with <qem>emphasis<\/qem> inside\."<\/q>/)
  })

  test('sanitises embedded scripts and event handlers', async ({ app }) => {
    const result = await app.evaluate(() => {
      const body = [...document.querySelectorAll('.rendered-markdown')]
        .map((n) => n.innerHTML)
        .join('\n')
      return {
        scriptTag: !!document.querySelector('.rendered-markdown script'),
        onerror: body.includes('onerror'),
        // Set by both XSS attempts in the fixture message if either had run.
        xssRan: (window as any).__xss === 1,
      }
    })

    expect(result).toEqual({ scriptTag: false, onerror: false, xssRan: false })
    expectNoPageErrors(app)
  })
})

test.describe('message editing', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('/chat/chat-1')
    await app.waitForSelector('.rendered-markdown')
    await app
      .locator('li', { hasText: 'Greetings from Aria.' })
      .first()
      .locator('button[aria-label="Edit message"]')
      .click()
    await app.waitForSelector('textarea[aria-label="Edit message"]')
  })

  test('opens with the stored message text', async ({ app }) => {
    await expect(app.locator('textarea[aria-label="Edit message"]')).toHaveValue(
      'Greetings from Aria.'
    )
  })

  test('message editor opens at media-block height', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await app.locator('button[aria-label="Edit message"]').first().click()

    const editor = app.locator('textarea[aria-label="Edit message"]')
    await expect(editor).toBeVisible()
    await expect(editor).toHaveCSS('min-height', '288px')
    expect(
      await editor.evaluate((element) => element.getBoundingClientRect().height)
    ).toBeGreaterThan(400)
  })

  test('Escape cancels and persists nothing', async ({ app, stub }) => {
    await app.press('textarea[aria-label="Edit message"]', 'Escape')

    await expect(app.locator('textarea[aria-label="Edit message"]')).toHaveCount(0)
    expect(stub.state.edits).toEqual([])
  })

  test('saving PUTs the edit and re-renders it as markdown', async ({ app, stub }) => {
    await app.fill('textarea[aria-label="Edit message"]', 'Edited **text** here.')
    await app.click('button:has-text("Save")')

    await expect(app.locator('textarea[aria-label="Edit message"]')).toHaveCount(0)
    expect(stub.state.edits).toEqual([{ id: 'msg-1', message: 'Edited **text** here.' }])

    const body = await app.evaluate(() =>
      [...document.querySelectorAll('.rendered-markdown')].map((n) => n.innerHTML).join('\n')
    )
    expect(body).toContain('Edited <strong>text</strong> here.')
  })
})
