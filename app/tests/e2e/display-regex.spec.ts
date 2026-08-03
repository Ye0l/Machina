import { expect, test } from './fixtures'

test.describe('display regex', () => {
  test('transforms only the rendered bot view and keeps the stored text editable', async ({
    app,
    stub,
  }) => {
    stub.state.chatPreset = 'preset-regex'
    stub.state.presets = [
      {
        _id: 'preset-regex',
        name: 'Display regex preset',
        temporary: {
          displayRegex: {
            version: 1,
            rules: [
              {
                id: 'replace-visible-text',
                name: 'Replace visible text',
                enabled: true,
                pattern: 'Greetings|Some',
                flags: 'g',
                replacement: 'FILTERED',
              },
            ],
          },
        },
      },
    ]

    await app.goto('/chat/chat-1')

    const botMessage = app.locator('li', { hasText: 'FILTERED from Aria.' }).first()
    await expect(botMessage).toBeVisible()
    await expect(app.locator('li', { hasText: 'Some bold and italic' })).toBeVisible()

    await botMessage.locator('button[aria-label="Edit message"]').click()
    await expect(app.locator('textarea[aria-label="Edit message"]')).toHaveValue(
      'Greetings from Aria.'
    )
  })
})
