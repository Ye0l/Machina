import { expect, test } from './fixtures'

const toggleConfig = {
  version: 1,
  source: 'mode=Mode=select=Default,OOC',
  template: '{{#if_pure {{? {{getglobalvar::toggle_mode}}=1}}}}OOC{{/if}}{{history}}',
}

test('saves the current chat toggle values as preset defaults', async ({ app, stub }) => {
  stub.state.chatPreset = 'preset-toggle'
  stub.state.presets = [
    {
      _id: 'preset-toggle',
      kind: 'gen-presets',
      userId: 'user-1',
      name: 'Risu preset',
      gaslight: toggleConfig.template,
      temporary: { risuPromptToggles: toggleConfig },
      createdAt: '',
      updatedAt: '',
    },
  ]

  await app.goto('/chat/chat-1')
  await app.getByRole('button', { name: 'Prompt toggles' }).click()
  await app.getByLabel('Mode').selectOption('1')
  await app.getByRole('button', { name: 'Use as defaults' }).click()

  await expect.poll(() => stub.state.presetUpdates.length).toBe(1)
  expect(stub.state.presetUpdates[0].body.temporary.risuPromptToggles.defaults).toEqual({
    mode: '1',
  })
  await expect(app.getByText('Current values are now the preset defaults.')).toBeVisible()
})
