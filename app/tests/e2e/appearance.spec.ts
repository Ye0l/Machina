import { expect, test } from './fixtures'

test('uses the Machina brand and applies a saved light theme', async ({ app }) => {
  await app.goto('/settings/display')
  await expect(app.getByText('Machina', { exact: true }).first()).toBeVisible()

  await app.locator('#display-theme').selectOption('tokyo-night')
  await app.locator('#display-mode').selectOption('light')
  await app.getByRole('button', { name: 'Save display' }).click()

  await expect(app.locator('html')).toHaveAttribute('data-theme', 'tokyo-night')
  await expect(app.locator('html')).toHaveAttribute('data-mode', 'light')
})

test('can hide partial streaming text while generation continues', async ({ app, stub }) => {
  stub.state.extraMessages = [
    {
      _id: 'msg-awaiting-reply',
      kind: 'chat-message',
      chatId: 'chat-1',
      userId: 'user-1',
      parent: 'msg-2',
      msg: 'Continue without showing partial text.',
      retries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  stub.state.inferenceDelayMs = 1_000
  stub.state.inferenceResponse = 'Completed without visible partial output.'

  await app.goto('/settings/display')
  await app.getByLabel('Streaming output').uncheck()
  await app.getByRole('button', { name: 'Save display' }).click()
  await app.goto('/chat/chat-1')
  await app.getByRole('button', { name: 'Resend last message' }).click()

  await expect(app.getByTestId('streaming-hidden')).toBeVisible()
  await expect(app.getByText('Completed without visible partial output.')).toBeVisible()
})
