import { expect, test } from './fixtures'

/**
 * The preset editor's prompt-template controls.
 *
 * Providers and presets are seeded per-test rather than in the stub's fixed payload: a preset
 * reaches prompt assembly, so serving one everywhere would change the prompts the chat specs
 * assert on.
 */
const PROVIDER = {
  _id: 'prov-1',
  name: 'Test provider',
  provider: 'known-openai',
  url: 'https://api.openai.com/v1',
  keySet: true,
  format: { type: 'service', value: 'openai' },
}

const PRESET = {
  _id: 'preset-1',
  kind: 'gen-setting',
  userId: 'user-1',
  name: 'Test preset',
  service: 'openai',
  providerId: 'prov-1',
  providerModels: { 'prov-1': 'gpt-4o' },
  temp: 0.8,
  maxTokens: 300,
  maxContextLength: 8192,
  useAdvancedPrompt: 'no-validation',
  gaslight: 'PRESET-RAW-TEMPLATE {{char}}',
}

async function openPresetEditor(app: any) {
  await app.goto('/settings/presets')
  await app.click('button[aria-label="Edit Test preset"]')
  await expect(app.locator('#preset-template-pick')).toBeVisible()
}

test.describe('prompt templates', () => {
  // `app` is requested here only for its ordering: creating that fixture resets the stub, so
  // seeding before it exists would be wiped.
  test.beforeEach(async ({ app, stub }) => {
    void app
    stub.state.providers = [PROVIDER]
    stub.state.presets = [{ ...PRESET }]
  })

  test('a built-in template can be picked and is saved onto the preset', async ({ app, stub }) => {
    await openPresetEditor(app)

    await app.selectOption('#preset-template-pick', 'Universal')
    // The editor shows what will actually be sent, not the preset's own text.
    await expect(app.locator('#preset-gaslight')).toHaveValue(/\{\{#if system_prompt\}\}/)

    await app.click('button:has-text("Save preset")')

    await expect.poll(() => stub.state.presetUpdates.length).toBe(1)
    expect(stub.state.presetUpdates[0].body.promptTemplateId).toBe('Universal')
  })

  test('the raw template is saved as a reusable template and attached', async ({ app, stub }) => {
    await openPresetEditor(app)

    await app.fill('input[placeholder="Reusable across presets"]', 'Shared one')
    await app.click('button:has-text("Save as template")')

    await expect.poll(() => stub.state.templateCalls.length).toBe(1)
    expect(stub.state.templateCalls[0].body).toMatchObject({
      name: 'Shared one',
      template: PRESET.gaslight,
    })

    // Saving it attaches it, so the preset now generates from the shared copy.
    await app.click('button:has-text("Save preset")')
    await expect.poll(() => stub.state.presetUpdates.length).toBe(1)
    expect(stub.state.presetUpdates[0].body.promptTemplateId).toBe('tpl-1')
  })

  test('an existing saved template is listed, editable and removable', async ({ app, stub }) => {
    stub.state.promptTemplates = [
      {
        kind: 'prompt-template',
        _id: 'tpl-9',
        userId: 'user-1',
        name: 'Existing',
        template: 'EXISTING-TEMPLATE',
        createdAt: '',
        updatedAt: '',
      },
    ]

    await openPresetEditor(app)
    await app.selectOption('#preset-template-pick', 'tpl-9')
    await expect(app.locator('#preset-gaslight')).toHaveValue('EXISTING-TEMPLATE')

    // Editing keeps the preset attached, so the edit is flagged as not yet applied.
    await app.fill('#preset-gaslight', 'EXISTING-TEMPLATE-EDITED')
    await expect(app.getByText('“Update template” applies it')).toBeVisible()

    await app.click('button:has-text("Update template")')

    await expect.poll(() => stub.state.templateCalls.length).toBe(1)
    expect(stub.state.templateCalls[0].path).toBe('/api/user/templates/tpl-9')
    expect(stub.state.templateCalls[0].body.template).toBe('EXISTING-TEMPLATE-EDITED')

    app.once('dialog', (dialog: any) => dialog.accept())
    await app.click('button:has-text("Delete template")')

    await expect.poll(() => stub.state.templateCalls.length).toBe(2)
    expect(stub.state.templateCalls[1].method).toBe('DELETE')
    // The text stays behind, now owned by the preset alone.
    await expect(app.locator('#preset-gaslight')).toHaveValue('EXISTING-TEMPLATE-EDITED')
    await expect(app.locator('#preset-template-pick')).toHaveValue('')
  })

  test('the prompt is previewed with sample data and a token count', async ({ app }) => {
    await openPresetEditor(app)

    await app.click('button:has-text("Preview prompt")')

    const rendered = app.getByTestId('prompt-preview')
    // The sample cast fills the placeholders, so the raw `{{char}}` is gone.
    await expect(rendered).toContainText('PRESET-RAW-TEMPLATE Robot')
    await expect(rendered).not.toContainText('{{char}}')
    await expect(app.getByText(/\d+ tokens/)).toBeVisible()

    await app.click('button:has-text("Hide preview")')
    await expect(rendered).toHaveCount(0)
  })

  test('editing the template drops a stale preview', async ({ app }) => {
    await openPresetEditor(app)
    await app.click('button:has-text("Preview prompt")')
    await expect(app.getByTestId('prompt-preview')).toBeVisible()

    await app.fill('#preset-gaslight', 'CHANGED {{char}}')
    await expect(app.getByTestId('prompt-preview')).toHaveCount(0)
  })

  test('switching to the basic prompt order detaches the template', async ({ app, stub }) => {
    await openPresetEditor(app)
    await app.selectOption('#preset-template-pick', 'Universal')

    // The section list would otherwise be a lie: a template id outranks it.
    await app.selectOption('#preset-prompt-mode', 'basic')
    await app.click('button:has-text("Save preset")')

    await expect.poll(() => stub.state.presetUpdates.length).toBe(1)
    expect(stub.state.presetUpdates[0].body.promptTemplateId).toBeUndefined()
  })
})
