import { presetDefaults } from '../../../common/default-preset'
import { expect, test } from './fixtures'

test('rerolls with current settings while replacing the visible response immediately', async ({
  app,
  stub,
}) => {
  stub.state.chatPreset = 'preset-current'
  stub.state.presets = [
    {
      ...presetDefaults,
      _id: 'preset-current',
      kind: 'gen-setting',
      userId: 'user-1',
      name: 'Current preset',
      service: 'openai',
      providerId: 'provider-current',
      providerModels: { 'provider-current': 'current/model-v2' },
      temp: 0.37,
      maxTokens: 777,
    },
  ]
  stub.state.extraMessages = [
    {
      _id: 'msg-reroll',
      kind: 'chat-message',
      chatId: 'chat-1',
      characterId: 'char-1',
      parent: 'msg-2',
      msg: 'Old generated reply.',
      retries: [],
      meta: { generation: { model: 'old/model-v1', outputTokens: 12 } },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  stub.state.inferenceDelayMs = 250
  stub.state.inferenceResponse = 'Fresh reroll reply.'

  await app.goto('/chat/chat-1')
  const oldReply = app.getByText('Old generated reply.')
  await expect(oldReply).toBeVisible()

  await app.getByRole('button', { name: 'Regenerate last response' }).click()

  await expect(oldReply).toBeHidden()
  await expect(app.getByTestId('streaming')).toBeVisible()
  await expect.poll(() => stub.state.inferenceRequests.length).toBe(1)

  const request = stub.state.inferenceRequests[0]
  expect(request.settings.providerModels['provider-current']).toBe('current/model-v2')
  expect(request.settings.temp).toBe(0.37)
  expect(request.settings.maxTokens).toBe(777)

  await expect(app.getByText('Fresh reroll reply.')).toBeVisible()
  const debug = app.getByTestId('generation-debug-msg-reroll')
  await expect(debug).toContainText('current/model-v2')
  await expect(debug).toContainText(/\d+ tokens/)

  await debug.click()
  const dialog = app.getByRole('dialog', { name: 'Generation request' })
  await expect(dialog).toBeVisible()
  await expect(app.getByTestId('generation-request-body')).toContainText('current/model-v2')
  await expect(app.getByTestId('generation-request-body')).toContainText('Fresh reroll reply.', {
    useInnerText: false,
  })
})
