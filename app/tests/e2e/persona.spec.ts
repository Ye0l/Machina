import { expect, test } from './fixtures'
import type { Page } from '@playwright/test'

async function sendAndCapturePrompt(app: Page, state: { prompts: string[] }, text: string) {
  const before = state.prompts.length
  await app.fill('textarea[placeholder="Send a message"]', text)
  await app.press('textarea[placeholder="Send a message"]', 'Enter')
  await expect.poll(() => state.prompts.length, { timeout: 15000 }).toBeGreaterThan(before)
  return state.prompts.at(-1)!
}

const WREN = {
  kind: 'persona',
  _id: 'persona-1',
  userId: 'user-1',
  name: 'Wren',
  persona: { kind: 'text', attributes: { text: ['PERSONA-TIRED-COURIER'] } },
  createdAt: '',
  updatedAt: '',
}

test.describe('personas', () => {
  test('are created, listed and edited on their own route', async ({ app, stub }) => {
    await app.goto('/persona')
    // Exact: the empty state's "No personas yet" is a substring match otherwise.
    await expect(app.getByRole('heading', { name: 'Personas', exact: true })).toBeVisible()

    await app.click('a:has-text("New persona")')
    await app.fill('input[placeholder="The name the character calls you"]', 'Wren')
    await app.fill(
      'textarea[placeholder="Appearance, background, how you speak..."]',
      'PERSONA-TIRED-COURIER'
    )
    await app.click('button:has-text("Save persona")')

    await expect.poll(() => stub.state.personas.length).toBe(1)
    expect(stub.state.personas[0]).toMatchObject({
      name: 'Wren',
      persona: { kind: 'text', attributes: { text: ['PERSONA-TIRED-COURIER'] } },
    })

    // Saving returns to the list, which now shows it.
    await expect(app).toHaveURL(/\/persona$/)
    await expect(app.getByRole('heading', { name: 'Wren', exact: true })).toBeVisible()

    await app.click('a[aria-label="Edit Wren"]')
    await expect(app.locator('input[placeholder="The name the character calls you"]')).toHaveValue(
      'Wren'
    )
  })

  test('are not characters: the library never lists them', async ({ app, stub }) => {
    stub.state.personas = [{ ...WREN }]

    await app.goto('/')
    await expect(app.locator('h2:text-is("Aria")')).toBeVisible()
    await expect(app.locator('h2:text-is("Wren")')).toHaveCount(0)
  })

  test('defaults to speaking as the account profile', async ({ app, stub }) => {
    stub.state.personas = [{ ...WREN }]

    await app.goto('/chat/chat-1')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('')
  })

  test('the picker stays on screen with nothing to pick, and says where to add one', async ({
    app,
  }) => {
    await app.goto('/chat/chat-1')
    const picker = app.locator('select[aria-label="Speak as"]')
    await expect(picker).toBeVisible()
    await expect(picker).toBeDisabled()
    await expect(picker).toContainText('add a persona')
  })

  test('are sent as the impersonated character and reach the prompt', async ({ app, stub }) => {
    stub.state.personas = [{ ...WREN }]

    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'persona-1')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('persona-1')

    const prompt = await sendAndCapturePrompt(app, stub.state, 'Hello from the persona.')

    // The user's own message, not the bot persist that follows it -- that one carries the
    // replying character as `impersonate` instead.
    const userSend = stub.state.sends.find((send) => !send.bot)
    // The `temp-` prefix is what lets a non-character ride `impersonate`: the server would
    // otherwise reject the id as a character that is not the caller's.
    expect(userSend?.impersonate?._id).toBe('temp-persona-persona-1')
    expect(userSend?.impersonate?.name).toBe('Wren')
    expect(prompt).toContain('PERSONA-TIRED-COURIER')
  })

  test('render an impersonated message as the user own, not as a bot', async ({ app, stub }) => {
    stub.state.personas = [{ ...WREN }]

    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'persona-1')
    await sendAndCapturePrompt(app, stub.state, 'Spoken as Wren.')

    // The server stamps it with a characterId; authorship comes from userId instead.
    const row = app.locator('li', { hasText: 'Spoken as Wren.' }).first()
    await expect(row).toHaveClass(/flex-row-reverse/)
  })

  test('the selection survives a reload', async ({ app, stub }) => {
    stub.state.personas = [{ ...WREN }]

    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'persona-1')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('persona-1')

    await app.reload()
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('persona-1')
  })

  test('a deleted persona stops applying rather than lingering', async ({ app, stub }) => {
    stub.state.personas = [{ ...WREN }]

    await app.goto('/chat/chat-1')
    await app.selectOption('select[aria-label="Speak as"]', 'persona-1')

    app.once('dialog', (dialog) => dialog.accept())
    await app.goto('/persona/persona-1')
    await app.click('button:has-text("Delete persona")')

    await expect.poll(() => stub.state.personas.length).toBe(0)

    await app.goto('/chat/chat-1')
    await expect(app.locator('select[aria-label="Speak as"]')).toHaveValue('')
  })
})
