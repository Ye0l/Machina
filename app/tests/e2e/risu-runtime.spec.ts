import { presetDefaults } from '../../../common/default-preset'
import { withRisuToggleConfig, withRisuToggleDefaults } from '../../../common/risu-toggles'
import { expect, test } from './fixtures'

test('resolves imported Risu macros in the actual inference request', async ({ app, stub }) => {
  const source = 'mode=Mode=select=Disabled,Enabled (기본)'
  const template = [
    '<system>',
    '{{#if_pure {{? {{getglobalvar::toggle_mode}}=1}}}}RISU-RUNTIME-ENABLED{{#else}}RISU-RUNTIME-DISABLED{{/if}}',
    '{{history:0:end}}',
    '</system>',
    '<bot>{{post}}</bot>',
  ].join('\n')
  const configured = withRisuToggleDefaults(
    withRisuToggleConfig({ ...presetDefaults, gaslight: template }, source, template),
    { mode: '1' }
  )

  stub.state.chatPreset = 'preset-risu-runtime'
  stub.state.presets = [
    {
      ...configured,
      _id: 'preset-risu-runtime',
      kind: 'gen-setting',
      userId: 'user-1',
      name: 'Risu runtime',
      service: 'openai',
    },
  ]

  await app.goto('/chat/chat-1')
  await app.getByRole('button', { name: 'Resend last message' }).click()
  await expect.poll(() => stub.state.inferenceRequests.length).toBe(1)

  const request = stub.state.inferenceRequests[0]
  const serialized = JSON.stringify({ prompt: request.prompt, messages: request.messages })
  expect(serialized).toContain('RISU-RUNTIME-ENABLED')
  expect(serialized).not.toContain('RISU-RUNTIME-DISABLED')
  expect(serialized).not.toContain('getglobalvar')
  expect(serialized).not.toContain('#if_pure')
  expect(serialized).not.toContain('{{history:')
})
