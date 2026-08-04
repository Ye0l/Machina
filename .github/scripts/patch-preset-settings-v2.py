from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# Settings store: preserve reasoning/custom provider payloads and support true duplication.
p = Path('app/src/lib/settings.svelte.ts')
s = p.read_text()
s = replace_once(
    s,
    "  displayRegexRules: DisplayRegexRule[]\n}",
    "  displayRegexRules: DisplayRegexRule[]\n  reasoning: NonNullable<AppSchema.GenSettings['reasoning']>\n  providerSettings: Record<string, any>\n}",
    'PresetInput advanced fields',
)
provider_save_end = """  async deleteProvider(providerId: string): Promise<boolean> {
"""
provider_duplicate = """  async duplicateProvider(provider: AppSchema.Provider, name: string): Promise<boolean> {
    this.providerSaving = true
    this.error = ''
    try {
      const user = await api.post<AppSchema.User>('/user/provider', {
        _id: '',
        name: name.trim(),
        provider: provider.provider,
        url: provider.url,
        key: '',
        subFormat: provider.subFormat,
        format: provider.format,
      })
      session.user = user
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to duplicate provider'
      return false
    } finally {
      this.providerSaving = false
    }
  }

""" + provider_save_end
s = replace_once(s, provider_save_end, provider_duplicate, 'duplicate provider store')
preset_delete_marker = """  async deletePreset(presetId: string): Promise<boolean> {
"""
preset_duplicate = """  async duplicatePreset(preset: AppSchema.UserGenPreset, name: string): Promise<boolean> {
    this.presetSaving = true
    this.error = ''
    try {
      const body: Record<string, any> = structuredClone(preset)
      delete body._id
      delete body.userId
      delete body.kind
      delete body.updatedAt
      delete body.thirdPartyKey
      delete body.thirdPartyKeySet
      body.name = name.trim()

      const created = await api.post<AppSchema.UserGenPreset>('/user/presets', body)
      session.presets = [...session.presets, created]
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to duplicate preset'
      return false
    } finally {
      this.presetSaving = false
    }
  }

""" + preset_delete_marker
s = replace_once(s, preset_delete_marker, preset_duplicate, 'duplicate preset store')
# Persist advanced values with both new and updated presets.
s = replace_once(
    s,
    """        temporary: withDisplayRegexRules(
          { temporary: existing?.temporary },
          input.displayRegexRules
        ).temporary,
""",
    """        temporary: withDisplayRegexRules(
          { temporary: existing?.temporary },
          input.displayRegexRules
        ).temporary,
        reasoning: input.reasoning,
        providerSettings: input.providerSettings,
""",
    'save advanced preset fields',
)
p.write_text(s)

# Settings route: copy actions plus reasoning and arbitrary provider payload controls.
p = Path('app/src/routes/Settings.svelte')
s = p.read_text()
s = replace_once(s, '    CircleX,\n', '    CircleX,\n    Copy,\n', 'Settings copy icon')
s = replace_once(
    s,
    "  import type { ModelFormat } from '/common/presets/templates'",
    "  import type { ModelFormat } from '/common/presets/templates'\n  import type { ReasoningEffort } from '/common/types/presets'",
    'ReasoningEffort import',
)
# Preset form fields.
s = replace_once(
    s,
    """    secondaryModel: string
    displayRegexRules: DisplayRegexRule[]
  }
""",
    """    secondaryModel: string
    displayRegexRules: DisplayRegexRule[]
    reasoningEnabled: boolean
    reasoningEffort: ReasoningEffort
    reasoningMaxTokens: number
    reasoningExclude: boolean
    reasoningStart: string
    reasoningEnd: string
    providerSettingsText: string
  }
""",
    'PresetForm advanced fields',
)
s = replace_once(
    s,
    """  let presetPromptError = $state('')
  let rawTemplateEl: HTMLTextAreaElement | null = null
""",
    """  let presetPromptError = $state('')
  let providerSettingsError = $state('')
  let rawTemplateEl: HTMLTextAreaElement | null = null
""",
    'custom settings error state',
)
# Defaults.
s = replace_once(
    s,
    """      secondaryProviderId: '',
      secondaryModel: '',
      displayRegexRules: [],
    }
""",
    """      secondaryProviderId: '',
      secondaryModel: '',
      displayRegexRules: [],
      reasoningEnabled: false,
      reasoningEffort: 'low',
      reasoningMaxTokens: 2048,
      reasoningExclude: false,
      reasoningStart: '<think>',
      reasoningEnd: '</think>',
      providerSettingsText: '{}',
    }
""",
    'preset advanced defaults',
)
# Existing preset -> form.
s = replace_once(
    s,
    """      displayRegexRules: getDisplayRegexRules(preset),
    }
""",
    """      displayRegexRules: getDisplayRegexRules(preset),
      reasoningEnabled: !!preset.reasoning?.enabled,
      reasoningEffort: preset.reasoning?.effort ?? 'low',
      reasoningMaxTokens: preset.reasoning?.maxTokens ?? 2048,
      reasoningExclude: !!preset.reasoning?.exclude,
      reasoningStart: preset.reasoning?.start ?? '<think>',
      reasoningEnd: preset.reasoning?.end ?? '</think>',
      providerSettingsText: JSON.stringify(preset.providerSettings ?? {}, null, 2),
    }
""",
    'preset advanced edit values',
)
# Clear errors.
s = s.replace("    presetPromptError = ''\n    seedTemplateName()", "    presetPromptError = ''\n    providerSettingsError = ''\n    seedTemplateName()", 2)
s = replace_once(
    s,
    """  function cancelPreset() {
    editingPreset = null
    presetNameError = ''
""",
    """  function cancelPreset() {
    editingPreset = null
    presetNameError = ''
    providerSettingsError = ''
""",
    'cancel preset custom error',
)
# Direct duplication functions.
remove_provider_marker = """  async function removeProvider(provider: AppSchema.Provider) {
"""
duplicate_provider_fn = """  async function duplicateProvider(provider: AppSchema.Provider) {
    settings.clearError()
    await settings.duplicateProvider(
      provider,
      i18n.t('{name} (copy)', { name: provider.name })
    )
  }

""" + remove_provider_marker
s = replace_once(s, remove_provider_marker, duplicate_provider_fn, 'provider duplicate action')
remove_preset_marker = """  async function removePreset(preset: AppSchema.UserGenPreset) {
"""
duplicate_preset_fn = """  async function duplicatePreset(preset: AppSchema.UserGenPreset) {
    settings.clearError()
    await settings.duplicatePreset(preset, i18n.t('{name} (copy)', { name: preset.name }))
  }

""" + remove_preset_marker
s = replace_once(s, remove_preset_marker, duplicate_preset_fn, 'preset duplicate action')
# Template duplication.
update_template_marker = """  async function updateSelectedTemplate() {
"""
duplicate_template_fn = """  async function duplicateSelectedTemplate() {
    const template = selectedTemplate
    if (!template || isBuiltinTemplate(template._id)) return

    const created = await promptTemplates.create(
      i18n.t('{name} (copy)', { name: template.name }),
      template.template
    )
    if (!created) {
      templateError = promptTemplates.error
      return
    }

    presetForm.promptTemplateId = created._id
    presetForm.gaslight = created.template
    templateName = created.name
    templateError = ''
  }

""" + update_template_marker
s = replace_once(s, update_template_marker, duplicate_template_fn, 'template duplicate action')
# Parse custom JSON in submit and include advanced settings.
submit_validation = """    if (presetNameError || presetPromptError) return

    const input: PresetInput = {
"""
submit_parse = """    if (presetNameError || presetPromptError) return

    let providerSettings: Record<string, any> = {}
    providerSettingsError = ''
    try {
      const parsed = JSON.parse(presetForm.providerSettingsText.trim() || '{}')
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        providerSettingsError = i18n.t('Custom request parameters must be a JSON object.')
        return
      }
      providerSettings = parsed
    } catch (ex) {
      providerSettingsError = i18n.t('Custom request parameters contain invalid JSON.')
      return
    }

    const input: PresetInput = {
"""
s = replace_once(s, submit_validation, submit_parse, 'custom JSON validation')
s = replace_once(
    s,
    """      displayRegexRules: presetForm.displayRegexRules,
    }
""",
    """      displayRegexRules: presetForm.displayRegexRules,
      reasoning: {
        enabled: presetForm.reasoningEnabled,
        effort: presetForm.reasoningEnabled ? presetForm.reasoningEffort : 'none',
        maxTokens: Math.max(1, Number(presetForm.reasoningMaxTokens) || 2048),
        exclude: presetForm.reasoningExclude,
        start: presetForm.reasoningStart || '<think>',
        end: presetForm.reasoningEnd || '</think>',
      },
      providerSettings,
    }
""",
    'submit advanced values',
)
# Provider list copy action.
provider_edit = """                    <button
                      class=\"icon-button\"
                      type=\"button\"
                      aria-label={`Edit ${provider.name}`}
                      onclick={() => startEditProvider(provider)}
                    >
"""
provider_copy = """                    <button
                      class=\"icon-button\"
                      type=\"button\"
                      aria-label={i18n.t('Duplicate {name}', { name: provider.name })}
                      title={i18n.t('Duplicate')}
                      disabled={settings.providerSaving}
                      onclick={() => duplicateProvider(provider)}
                    >
                      <Copy size={17} />
                    </button>
"""
s = replace_once(s, provider_edit, provider_copy + provider_edit, 'provider copy button')
# Preset list copy action.
preset_edit = """                  <button
                    class=\"icon-button\"
                    type=\"button\"
                    aria-label={`${i18n.t('Edit')} ${preset.name}`}
                    onclick={() => startEditPreset(preset)}
                  >
"""
preset_copy = """                  <button
                    class=\"icon-button\"
                    type=\"button\"
                    aria-label={i18n.t('Duplicate {name}', { name: preset.name })}
                    title={i18n.t('Duplicate')}
                    disabled={settings.presetSaving}
                    onclick={() => duplicatePreset(preset)}
                  >
                    <Copy size={17} />
                  </button>
"""
s = replace_once(s, preset_edit, preset_copy + preset_edit, 'preset copy button')
# Template copy button.
template_update_button = """                        <button
                          class=\"button-secondary\"
                          type=\"button\"
                          disabled={promptTemplates.saving}
                          onclick={updateSelectedTemplate}
                        >
                          {i18n.t('Update template')}
                        </button>
"""
template_copy_button = """                        <button
                          class=\"button-secondary\"
                          type=\"button\"
                          disabled={promptTemplates.saving}
                          onclick={duplicateSelectedTemplate}
                        >
                          <Copy size={15} />
                          {i18n.t('Duplicate template')}
                        </button>
"""
s = replace_once(s, template_update_button, template_copy_button + template_update_button, 'template copy button')
# Advanced model parameter UI after the basic three fields.
basic_grid = """            <div class=\"grid grid-cols-1 gap-4 sm:grid-cols-3\">
              <div class=\"field-group\">
                <label class=\"field-label\" for=\"preset-temp\">{i18n.t('Temperature')}</label>
                <input
                  id=\"preset-temp\"
                  class=\"field\"
                  type=\"number\"
                  step=\"0.05\"
                  min=\"0\"
                  max=\"2\"
                  inputmode=\"decimal\"
                  bind:value={presetForm.temp}
                />
              </div>
              <div class=\"field-group\">
                <label class=\"field-label\" for=\"preset-max-tokens\">{i18n.t('Max tokens')}</label>
                <input
                  id=\"preset-max-tokens\"
                  class=\"field\"
                  type=\"number\"
                  step=\"1\"
                  min=\"1\"
                  inputmode=\"numeric\"
                  bind:value={presetForm.maxTokens}
                />
              </div>
              <div class=\"field-group\">
                <label class=\"field-label\" for=\"preset-max-context\">{i18n.t('Max context')}</label>
                <input
                  id=\"preset-max-context\"
                  class=\"field\"
                  type=\"number\"
                  step=\"1\"
                  min=\"1\"
                  inputmode=\"numeric\"
                  bind:value={presetForm.maxContext}
                />
              </div>
            </div>
"""
advanced_ui = basic_grid + """

            <details
              class=\"rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3\"
              data-testid=\"advanced-model-parameters\"
            >
              <summary class=\"cursor-pointer text-sm font-medium text-neutral-200\">
                {i18n.t('Advanced model parameters')}
              </summary>
              <div class=\"mt-4 space-y-5\">
                <section class=\"space-y-3\">
                  <label class=\"flex items-center gap-2 text-sm text-neutral-300\">
                    <input
                      type=\"checkbox\"
                      class=\"accent-violet-500\"
                      bind:checked={presetForm.reasoningEnabled}
                    />
                    {i18n.t('Enable thinking / reasoning')}
                  </label>

                  <div class=\"grid gap-4 sm:grid-cols-2\" class:opacity-50={!presetForm.reasoningEnabled}>
                    <div class=\"field-group\">
                      <label class=\"field-label\" for=\"preset-reasoning-effort\">
                        {i18n.t('Thinking effort')}
                      </label>
                      <select
                        id=\"preset-reasoning-effort\"
                        class=\"field\"
                        bind:value={presetForm.reasoningEffort}
                        disabled={!presetForm.reasoningEnabled}
                      >
                        <option value=\"low\">{i18n.t('Low')}</option>
                        <option value=\"medium\">{i18n.t('Medium')}</option>
                        <option value=\"high\">{i18n.t('High')}</option>
                        <option value=\"custom\">{i18n.t('Custom token budget')}</option>
                      </select>
                    </div>
                    <div class=\"field-group\">
                      <label class=\"field-label\" for=\"preset-reasoning-tokens\">
                        {i18n.t('Thinking token budget')}
                      </label>
                      <input
                        id=\"preset-reasoning-tokens\"
                        class=\"field\"
                        type=\"number\"
                        min=\"1\"
                        step=\"1\"
                        bind:value={presetForm.reasoningMaxTokens}
                        disabled={!presetForm.reasoningEnabled || presetForm.reasoningEffort !== 'custom'}
                      />
                    </div>
                  </div>

                  <label class=\"flex items-center gap-2 text-xs text-neutral-400\">
                    <input
                      type=\"checkbox\"
                      class=\"accent-violet-500\"
                      bind:checked={presetForm.reasoningExclude}
                      disabled={!presetForm.reasoningEnabled}
                    />
                    {i18n.t('Exclude thinking from the final response')}
                  </label>

                  <div class=\"grid gap-4 sm:grid-cols-2\">
                    <div class=\"field-group\">
                      <label class=\"field-label\" for=\"preset-reasoning-start\">
                        {i18n.t('Reasoning start marker')}
                      </label>
                      <input
                        id=\"preset-reasoning-start\"
                        class=\"field font-mono text-xs\"
                        bind:value={presetForm.reasoningStart}
                      />
                    </div>
                    <div class=\"field-group\">
                      <label class=\"field-label\" for=\"preset-reasoning-end\">
                        {i18n.t('Reasoning end marker')}
                      </label>
                      <input
                        id=\"preset-reasoning-end\"
                        class=\"field font-mono text-xs\"
                        bind:value={presetForm.reasoningEnd}
                      />
                    </div>
                  </div>
                </section>

                <section class=\"field-group border-t border-neutral-800 pt-4\">
                  <label class=\"field-label\" for=\"preset-provider-settings\">
                    {i18n.t('Custom request parameters')}
                  </label>
                  <textarea
                    id=\"preset-provider-settings\"
                    class=\"field min-h-40 resize-y font-mono text-xs leading-5\"
                    spellcheck=\"false\"
                    bind:value={presetForm.providerSettingsText}
                    oninput={() => (providerSettingsError = '')}
                    placeholder={'{\n  "top_p": 0.9,\n  "seed": 42\n}'}
                  />
                  <p class=\"field-hint\">
                    {i18n.t(
                      'Enter a JSON object. These values are merged into the provider request last, so they can add or override provider-specific parameters.'
                    )}
                  </p>
                  {#if providerSettingsError}
                    <p class=\"text-xs text-red-300\">{providerSettingsError}</p>
                  {/if}
                </section>
              </div>
            </details>
"""
s = replace_once(s, basic_grid, advanced_ui, 'advanced model parameter UI')
p.write_text(s)
