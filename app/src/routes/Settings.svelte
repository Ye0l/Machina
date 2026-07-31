<script lang="ts">
  import {
    ArrowLeft,
    CheckCircle2,
    CircleX,
    Globe2,
    KeyRound,
    Monitor,
    MoveDown,
    MoveUp,
    Pencil,
    Plus,
    RefreshCw,
    Save,
    Server,
    SlidersHorizontal,
    Star,
    Trash2,
    Wifi,
  } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { session } from '/app/lib/session.svelte'
  import { i18n, type Locale } from '/app/lib/i18n.svelte'
  import {
    DEFAULT_PROMPT_TEMPLATE,
    PROVIDER_TEMPLATES,
    findTemplate,
    findTemplateById,
    normalizePromptOrder,
    presetModel,
    providerLabel,
    settings,
    type JsonMode,
    type JsonSource,
    type PresetInput,
    type PromptOrder,
    type PromptSectionId,
    type ProviderInput,
  } from '/app/lib/settings.svelte'
  import { uiSettings } from '/app/lib/ui-settings.svelte'
  import {
    AVATAR_CORNERS,
    AVATAR_SIZES,
    CHAT_WIDTHS,
    FONT_FACES,
    UI_FONT,
    type AvatarCornerRadius,
    type AvatarSize,
    type ChatWidth,
    type FontSetting,
  } from '/common/types/ui'
  import type { ModelFormat } from '/common/presets/templates'
  import { BUILTIN_FORMATS } from '/common/presets/templates'
  import type { SettingsTab } from '/app/lib/router.svelte'

  // The visible tab is owned by the route (`/settings/:tab`) so it survives a reload and
  // can be linked to directly.
  let {
    tab = 'general',
    onTabChange,
  }: { tab?: SettingsTab; onTabChange: (tab: SettingsTab) => void } = $props()

  /** Drops transient feedback on any tab change, including browser back/forward. */
  $effect(() => {
    tab
    settings.clearError()
    displayMessage = ''
  })

  const providers = $derived(session.user?.providers ?? [])
  const presets = $derived(session.presets)
  const defaultPresetId = $derived(session.user?.defaultPreset)

  /* ----------------------------------------------------------------- providers */

  type ProviderForm = {
    _id?: string
    templateId: string
    name: string
    url: string
    key: string
    keySet: boolean
  }

  /** `null` = list, `'new'` = creating, otherwise the provider id being edited. */
  let editingProvider = $state<string | null>(null)
  let providerForm = $state<ProviderForm>(emptyProviderForm())
  let providerNameError = $state('')
  let providerTestStatus = $state<'idle' | 'testing' | 'success' | 'error'>('idle')
  let providerTestMessage = $state('')

  function resetProviderTest() {
    providerTestStatus = 'idle'
    providerTestMessage = ''
  }

  function emptyProviderForm(): ProviderForm {
    const tpl = PROVIDER_TEMPLATES[0]
    return { templateId: tpl.id, name: '', url: tpl.url, key: '', keySet: false }
  }

  function startAddProvider() {
    settings.clearError()
    const tpl = PROVIDER_TEMPLATES[0]
    providerForm = { templateId: tpl.id, name: '', url: tpl.url, key: '', keySet: false }
    providerNameError = ''
    editingProvider = 'new'
    resetProviderTest()
  }

  function startEditProvider(provider: AppSchema.Provider) {
    settings.clearError()
    const tpl = findTemplate(provider.provider)
    providerForm = {
      _id: provider._id,
      templateId: tpl?.id ?? 'custom',
      name: provider.name,
      url: provider.url,
      key: '',
      keySet: !!provider.keySet,
    }
    providerNameError = ''
    editingProvider = provider._id
    resetProviderTest()
  }

  function cancelProvider() {
    editingProvider = null
    providerNameError = ''
    resetProviderTest()
  }

  /** Refill URL when switching template, unless the user typed a custom URL. */
  function onProviderTemplate(templateId: string) {
    const tpl = findTemplateById(templateId)
    if (!tpl) return
    const previous = findTemplateById(providerForm.templateId)
    const wasTemplateUrl = !previous || providerForm.url === '' || providerForm.url === previous.url
    providerForm.templateId = templateId
    if (wasTemplateUrl) providerForm.url = tpl.url
    resetProviderTest()
  }

  async function testProviderConnection() {
    const url = providerForm.url.trim()
    if (!url) {
      providerTestStatus = 'error'
      providerTestMessage = i18n.t('Enter an API URL first.')
      return
    }

    providerTestStatus = 'testing'
    providerTestMessage = ''
    try {
      const result = await settings.testConnection({
        url,
        key: providerForm.key || undefined,
        providerId: providerForm._id,
      })
      if (result.success) {
        providerTestStatus = 'success'
        providerTestMessage = i18n.t('Connection successful. The model endpoint responded.')
        if (result.url) providerForm.url = result.url
      } else {
        providerTestStatus = 'error'
        providerTestMessage = i18n.t('Could not read a model list from this provider.')
      }
    } catch (ex) {
      providerTestStatus = 'error'
      providerTestMessage = ex instanceof Error ? ex.message : i18n.t('Connection test failed.')
    }
  }

  async function submitProvider(event: SubmitEvent) {
    event.preventDefault()
    const tpl = findTemplateById(providerForm.templateId)
    providerNameError = providerForm.name.trim() ? '' : i18n.t('Enter a name for this provider.')
    if (providerNameError || !tpl) return

    const input: ProviderInput = {
      _id: providerForm._id,
      name: providerForm.name,
      provider: tpl.provider,
      url: providerForm.url,
      key: providerForm.key,
      format: tpl.format,
    }
    if (await settings.saveProvider(input)) cancelProvider()
  }

  async function removeProvider(provider: AppSchema.Provider) {
    settings.clearError()
    if (!window.confirm(i18n.t('Delete provider “{name}”?', { name: provider.name }))) return
    await settings.deleteProvider(provider._id)
    if (editingProvider === provider._id) cancelProvider()
  }

  /* ------------------------------------------------------------------- presets */

  type PresetForm = {
    _id?: string
    name: string
    providerId: string
    model: string
    temp: number
    maxTokens: number
    maxContext: number
    jsonEnabled: JsonMode
    jsonSource: JsonSource
    useAdvancedPrompt: 'basic' | 'no-validation'
    modelFormat: ModelFormat
    promptOrder: PromptOrder
    gaslight: string
    promptTemplateId?: string
    systemPrompt: string
    ultimeJailbreak: string
    prefill: string
    ignoreCharacterSystemPrompt: boolean
    ignoreCharacterUjb: boolean
  }

  const MODEL_FORMAT_OPTIONS = Object.keys(BUILTIN_FORMATS) as ModelFormat[]

  const PROMPT_SECTION_LABELS: Record<PromptSectionId, string> = {
    system_prompt: 'System Prompt',
    scenario: 'Scenario',
    personality: 'Personality',
    impersonating: 'Impersonate Personality',
    chat_embed: 'Long-term Memory',
    memory: 'Memory',
    example_dialogue: 'Example Dialogue',
    history: 'Chat History',
    ujb: 'Jailbreak (UJB)',
  }

  const PLACEHOLDER_OPTIONS: { value: string; inserted: string }[] = [
    { value: 'char', inserted: '{{char}}' },
    { value: 'user', inserted: '{{user}}' },
    { value: 'system_prompt', inserted: '{{system_prompt}}' },
    { value: 'scenario', inserted: '{{scenario}}' },
    { value: 'personality', inserted: '{{personality}}' },
    { value: 'impersonating', inserted: '{{impersonating}}' },
    { value: 'memory', inserted: '{{memory}}' },
    { value: 'chat_embed', inserted: '{{chat_embed}}' },
    { value: 'example_dialogue', inserted: '{{example_dialogue}}' },
    { value: 'history', inserted: '{{history}}' },
    { value: 'ujb', inserted: '{{ujb}}' },
    { value: 'post', inserted: '{{post}}' },
  ]

  /** `null` = list, `'new'` = creating, otherwise the preset id being edited. */
  let editingPreset = $state<string | null>(null)
  let presetForm = $state<PresetForm>(emptyPresetForm())
  let presetNameError = $state('')
  let presetPromptError = $state('')
  let rawTemplateEl: HTMLTextAreaElement | null = null
  let modelOptions = $state<string[]>([])
  let modelLoading = $state(false)
  let modelMessage = $state('')
  let modelRequest = 0

  async function refreshModels() {
    const provider = providers.find((item) => item._id === presetForm.providerId)
    const request = ++modelRequest
    modelOptions = []
    modelMessage = ''
    modelLoading = false
    if (!provider?.url) {
      modelMessage = i18n.t('Select a provider with an API URL.')
      return
    }

    modelLoading = true
    try {
      const result = await settings.getProviderModels({
        providerId: provider._id,
        url: provider.url,
        id: 'new',
      })
      if (request !== modelRequest) return
      modelOptions = result.models
      if (!presetForm.model && modelOptions.length) presetForm.model = modelOptions[0]
      modelMessage = modelOptions.length
        ? i18n.t('{count} models loaded.', { count: modelOptions.length.toLocaleString() })
        : i18n.t('No models returned. Enter a model id manually.')
    } catch (ex) {
      if (request !== modelRequest) return
      modelMessage =
        ex instanceof Error
          ? `${ex.message} ${i18n.t('You can enter a model id manually.')}`
          : i18n.t('Model lookup failed.')
    } finally {
      if (request === modelRequest) modelLoading = false
    }
  }

  function emptyPresetForm(): PresetForm {
    const provider = providers[0]
    return {
      name: '',
      providerId: provider?._id ?? '',
      model: provider ? findTemplate(provider.provider)?.model ?? '' : '',
      temp: 0.8,
      maxTokens: 300,
      maxContext: 8192,
      jsonEnabled: 'off',
      jsonSource: 'character',
      useAdvancedPrompt: 'basic',
      modelFormat: 'None',
      promptOrder: normalizePromptOrder(),
      gaslight: DEFAULT_PROMPT_TEMPLATE,
      promptTemplateId: undefined,
      systemPrompt: '',
      ultimeJailbreak: '',
      prefill: '',
      ignoreCharacterSystemPrompt: false,
      ignoreCharacterUjb: false,
    }
  }

  function startAddPreset() {
    settings.clearError()
    presetForm = emptyPresetForm()
    presetNameError = ''
    presetPromptError = ''
    editingPreset = 'new'
    void refreshModels()
  }

  function startEditPreset(preset: AppSchema.UserGenPreset) {
    settings.clearError()
    presetForm = {
      _id: preset._id,
      name: preset.name,
      providerId: preset.providerId ?? providers[0]?._id ?? '',
      model: presetModel(preset),
      temp: preset.temp,
      maxTokens: preset.maxTokens,
      maxContext: preset.maxContextLength ?? 8192,
      jsonEnabled: (preset.jsonEnabled === true
        ? 'standard'
        : preset.jsonEnabled === 'separate'
        ? 'separate'
        : 'off') as JsonMode,
      jsonSource: (preset.jsonSource ?? 'character') as JsonSource,
      useAdvancedPrompt: preset.useAdvancedPrompt === 'basic' ? 'basic' : 'no-validation',
      modelFormat: preset.modelFormat ?? 'None',
      promptOrder: normalizePromptOrder(preset.promptOrder),
      gaslight: preset.gaslight || DEFAULT_PROMPT_TEMPLATE,
      promptTemplateId: preset.promptTemplateId,
      systemPrompt: preset.systemPrompt ?? '',
      ultimeJailbreak: preset.ultimeJailbreak ?? '',
      prefill: preset.prefill ?? '',
      ignoreCharacterSystemPrompt: !!preset.ignoreCharacterSystemPrompt,
      ignoreCharacterUjb: !!preset.ignoreCharacterUjb,
    }
    presetNameError = ''
    presetPromptError = ''
    editingPreset = preset._id
    void refreshModels()
  }

  function cancelPreset() {
    editingPreset = null
    presetNameError = ''
    modelRequest++
    modelLoading = false
    modelOptions = []
    modelMessage = ''
  }

  function onPresetProvider(providerId: string) {
    presetForm.providerId = providerId
    const provider = providers.find((item) => item._id === providerId)
    presetForm.model = provider ? findTemplate(provider.provider)?.model ?? '' : ''
    void refreshModels()
  }

  function movePromptSection(index: number, delta: number) {
    const next = presetForm.promptOrder.slice()
    const target = index + delta
    if (target < 0 || target >= next.length) return
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    presetForm.promptOrder = next
  }

  function togglePromptSection(index: number) {
    presetForm.promptOrder = presetForm.promptOrder.map((item, i) =>
      i === index ? { ...item, enabled: !item.enabled } : item
    )
  }

  function insertPlaceholder(inserted: string) {
    const el = rawTemplateEl
    if (!el) {
      presetForm.gaslight += inserted
      return
    }
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    presetForm.gaslight = el.value.slice(0, start) + inserted + el.value.slice(end)
    presetForm.promptTemplateId = undefined
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + inserted.length
      el.setSelectionRange(pos, pos)
    })
  }

  function onRawTemplateInput() {
    // Manual raw edits detach the preset from a built-in template id.
    presetForm.promptTemplateId = undefined
  }

  async function submitPreset(event: SubmitEvent) {
    event.preventDefault()
    presetNameError = presetForm.name.trim() ? '' : i18n.t('Enter a name for this preset.')
    presetPromptError =
      presetForm.useAdvancedPrompt === 'no-validation' && !presetForm.gaslight.trim()
        ? i18n.t('Enter at least one placeholder in the raw template.')
        : ''
    if (presetNameError || presetPromptError) return

    const input: PresetInput = {
      name: presetForm.name,
      providerId: presetForm.providerId,
      model: presetForm.model,
      temp: Number(presetForm.temp) || 0.8,
      maxTokens: Number(presetForm.maxTokens) || 300,
      maxContext: Number(presetForm.maxContext) || 8192,
      jsonEnabled: presetForm.jsonEnabled,
      jsonSource: presetForm.jsonSource,
      useAdvancedPrompt: presetForm.useAdvancedPrompt,
      modelFormat: presetForm.modelFormat,
      promptOrder: presetForm.promptOrder,
      gaslight: presetForm.gaslight,
      promptTemplateId: presetForm.promptTemplateId,
      systemPrompt: presetForm.systemPrompt,
      ultimeJailbreak: presetForm.ultimeJailbreak,
      prefill: presetForm.prefill,
      ignoreCharacterSystemPrompt: presetForm.ignoreCharacterSystemPrompt,
      ignoreCharacterUjb: presetForm.ignoreCharacterUjb,
    }
    const existing = presets.find((p) => p._id === presetForm._id)
    if (await settings.savePreset(input, existing)) cancelPreset()
  }

  async function removePreset(preset: AppSchema.UserGenPreset) {
    settings.clearError()
    if (!window.confirm(i18n.t('Delete preset “{name}”?', { name: preset.name }))) return
    await settings.deletePreset(preset._id)
    if (editingPreset === preset._id) cancelPreset()
  }

  async function makeDefault(preset: AppSchema.UserGenPreset) {
    settings.clearError()
    await settings.setDefaultPreset(preset._id)
  }

  /* ------------------------------------------------------------------- display */

  type DisplayForm = {
    chatWidth: ChatWidth
    font: FontSetting
    fontSize: number
    chatAvatarMode: boolean
    avatarSize: AvatarSize
    avatarCorners: AvatarCornerRadius
    customAvatarWidth: number
    customAvatarHeight: number
    msgOpacity: number
    chatAlternating: boolean
  }

  function displayFormFromSettings(): DisplayForm {
    const ui = uiSettings.settings
    return {
      chatWidth: ui.chatWidth ?? 'full',
      font: ui.font ?? 'default',
      fontSize: ui.fontSize ?? 14,
      chatAvatarMode: ui.chatAvatarMode ?? true,
      avatarSize: ui.avatarSize ?? 'md',
      avatarCorners: ui.avatarCorners ?? 'circle',
      customAvatarWidth: ui.customAvatarWidth ?? 48,
      customAvatarHeight: ui.customAvatarHeight ?? 48,
      msgOpacity: ui.msgOpacity ?? 0.8,
      chatAlternating: (ui.chatAlternating ?? 0) > 0,
    }
  }

  let displayForm = $state<DisplayForm>(displayFormFromSettings())
  let displaySaving = $state(false)
  let displayMessage = $state('')

  const displayDirty = $derived(
    JSON.stringify(displayForm) !== JSON.stringify(displayFormFromSettings())
  )

  function resetDisplayForm() {
    displayForm = displayFormFromSettings()
    displayMessage = ''
  }

  async function saveDisplay() {
    if (!displayDirty) {
      displayMessage = i18n.t('No changes to save.')
      return
    }
    displaySaving = true
    displayMessage = ''
    try {
      const ok = await uiSettings.save({
        chatWidth: displayForm.chatWidth,
        font: displayForm.font,
        fontSize: displayForm.fontSize,
        chatAvatarMode: displayForm.chatAvatarMode,
        avatarSize: displayForm.avatarSize,
        avatarCorners: displayForm.avatarCorners,
        customAvatarWidth: displayForm.customAvatarWidth,
        customAvatarHeight: displayForm.customAvatarHeight,
        msgOpacity: displayForm.msgOpacity,
        chatAlternating: displayForm.chatAlternating ? 10 : 0,
      })
      displayMessage = ok ? i18n.t('Display saved.') : i18n.t('Failed to save display settings.')
    } finally {
      displaySaving = false
    }
  }
</script>

<div class="flex h-full min-h-0 flex-col">
  <header class="flex shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4 py-4 sm:px-6">
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-base font-semibold text-white sm:text-lg">{i18n.t('Settings')}</h1>
      <p class="hidden text-xs text-neutral-500 sm:block">
        {i18n.t('Manage API providers and generation presets')}
      </p>
    </div>
    {#if tab === 'providers'}
      {#if editingProvider}
        <button class="button-secondary" type="button" onclick={cancelProvider}>
          <ArrowLeft size={17} />
          {i18n.t('Cancel')}
        </button>
      {:else}
        <button class="button-primary" type="button" onclick={startAddProvider}>
          <Plus size={17} />
          {i18n.t('Add provider')}
        </button>
      {/if}
    {:else if tab === 'presets'}
      {#if editingPreset}
        <button class="button-secondary" type="button" onclick={cancelPreset}>
          <ArrowLeft size={17} />
          {i18n.t('Cancel')}
        </button>
      {:else}
        <button
          class="button-primary"
          type="button"
          onclick={startAddPreset}
          disabled={!providers.length}
        >
          <Plus size={17} />
          {i18n.t('New preset')}
        </button>
      {/if}
    {/if}
  </header>

  <div class="shrink-0 border-b border-neutral-800/80 px-4 sm:px-6">
    <div
      class="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto"
      role="tablist"
      aria-label="Settings sections"
    >
      <button
        class="editor-tab shrink-0"
        class:tab-active={tab === 'general'}
        role="tab"
        aria-selected={tab === 'general'}
        onclick={() => onTabChange('general')}
      >
        <Globe2 size={16} />
        {i18n.t('General')}
      </button>
      <button
        class="editor-tab shrink-0"
        class:tab-active={tab === 'providers'}
        role="tab"
        aria-selected={tab === 'providers'}
        onclick={() => onTabChange('providers')}
      >
        <Server size={16} />
        {i18n.t('Providers')}
      </button>
      <button
        class="editor-tab shrink-0"
        class:tab-active={tab === 'presets'}
        role="tab"
        aria-selected={tab === 'presets'}
        onclick={() => onTabChange('presets')}
      >
        <SlidersHorizontal size={16} />
        {i18n.t('Presets')}
      </button>
      <button
        class="editor-tab shrink-0"
        class:tab-active={tab === 'display'}
        role="tab"
        aria-selected={tab === 'display'}
        onclick={() => onTabChange('display')}
      >
        <Monitor size={16} />
        {i18n.t('Display')}
      </button>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
      {#if settings.error}
        <div class="error-banner mb-5" role="alert">{settings.error}</div>
      {/if}

      {#if tab === 'general'}
        <section class="view-enter max-w-xl space-y-5" aria-labelledby="language-heading">
          <div>
            <h2 id="language-heading" class="text-sm font-semibold text-neutral-200">
              {i18n.t('Language')}
            </h2>
            <p class="mt-1 text-xs leading-5 text-neutral-500">
              {i18n.t('Choose the language used by this browser.')}
            </p>
          </div>
          <div class="field-group">
            <label class="field-label" for="app-language">{i18n.t('Language')}</label>
            <select
              id="app-language"
              class="field max-w-sm"
              value={i18n.locale}
              onchange={(event) => i18n.setLocale(event.currentTarget.value as Locale)}
            >
              <option value="en">{i18n.t('English')}</option>
              <option value="ko">{i18n.t('Korean')}</option>
            </select>
            <p class="field-hint">
              {i18n.t('Language preference is saved automatically on this device.')}
            </p>
          </div>
        </section>
      {:else if tab === 'display'}
        <section class="view-enter max-w-2xl space-y-5" aria-labelledby="display-heading">
          <div>
            <h2 id="display-heading" class="text-sm font-semibold text-neutral-200">
              {i18n.t('Chat appearance')}
            </h2>
            <p class="mt-1 text-xs leading-5 text-neutral-500">
              {i18n.t('This is a preview of your chat message styling.')}
            </p>
          </div>

          <div
            class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-4"
            style:font-family={FONT_FACES[displayForm.font].face === 'unset'
              ? undefined
              : FONT_FACES[displayForm.font].face}
            style:font-size={`${displayForm.fontSize}px`}
          >
            <div class="flex items-start gap-3">
              {#if displayForm.avatarSize !== 'hide'}
                <span
                  class="flex shrink-0 items-center justify-center overflow-hidden bg-neutral-800 font-semibold text-neutral-300"
                  class:rounded-full={displayForm.avatarCorners === 'circle'}
                  class:rounded-lg={displayForm.avatarCorners === 'md'}
                  class:rounded-sm={displayForm.avatarCorners === 'sm'}
                  class:rounded-none={displayForm.avatarCorners === 'none'}
                  class:rounded-xl={displayForm.avatarCorners === 'lg'}
                  style:width={`${
                    displayForm.avatarSize === 'custom'
                      ? displayForm.customAvatarWidth
                      : displayForm.avatarSize === 'xs'
                      ? 24
                      : displayForm.avatarSize === 'sm'
                      ? 32
                      : displayForm.avatarSize === 'md'
                      ? 40
                      : displayForm.avatarSize === 'lg'
                      ? 48
                      : 56
                  }px`}
                  style:height={`${
                    displayForm.avatarSize === 'custom'
                      ? displayForm.customAvatarHeight
                      : displayForm.avatarSize === 'xs'
                      ? 24
                      : displayForm.avatarSize === 'sm'
                      ? 32
                      : displayForm.avatarSize === 'md'
                      ? 40
                      : displayForm.avatarSize === 'lg'
                      ? 48
                      : 56
                  }px`}
                  aria-hidden="true"
                >
                  B
                </span>
              {/if}
              <div class="min-w-0 flex-1">
                <p class="text-xs text-neutral-500">{i18n.t('Bot')}</p>
                <p
                  class="mt-1 whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200"
                  style:opacity={displayForm.msgOpacity}
                >
                  {i18n.t('Preview message')}
                </p>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="display-chat-width">{i18n.t('Chat width')}</label>
              <select id="display-chat-width" class="field" bind:value={displayForm.chatWidth}>
                {#each CHAT_WIDTHS as width (width)}
                  <option value={width}>{i18n.t(width[0].toUpperCase() + width.slice(1))}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-font">{i18n.t('Font family')}</label>
              <select id="display-font" class="field" bind:value={displayForm.font}>
                {#each UI_FONT as font (font)}
                  <option value={font}>{FONT_FACES[font].label}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-font-size">{i18n.t('Font size')}</label>
              <input
                id="display-font-size"
                class="field"
                type="number"
                min="10"
                max="24"
                step="1"
                bind:value={displayForm.fontSize}
              />
            </div>
            <div class="field-group">
              <label class="field-label" for="display-opacity">{i18n.t('Message opacity')}</label>
              <div class="flex items-center gap-3">
                <input
                  id="display-opacity"
                  class="w-full accent-violet-500"
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  bind:value={displayForm.msgOpacity}
                />
                <span class="w-10 shrink-0 text-right text-xs text-neutral-400"
                  >{Math.round(displayForm.msgOpacity * 100)}%</span
                >
              </div>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-avatar-size">{i18n.t('Avatar size')}</label>
              <select id="display-avatar-size" class="field" bind:value={displayForm.avatarSize}>
                {#each AVATAR_SIZES as size (size)}
                  <option value={size}>{size}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-avatar-corners"
                >{i18n.t('Avatar corners')}</label
              >
              <select
                id="display-avatar-corners"
                class="field"
                bind:value={displayForm.avatarCorners}
              >
                {#each AVATAR_CORNERS as corner (corner)}
                  <option value={corner}>{corner}</option>
                {/each}
              </select>
            </div>
            {#if displayForm.avatarSize === 'custom'}
              <div class="field-group">
                <label class="field-label" for="display-avatar-w"
                  >{i18n.t('Custom avatar width')}</label
                >
                <input
                  id="display-avatar-w"
                  class="field"
                  type="number"
                  min="16"
                  max="256"
                  bind:value={displayForm.customAvatarWidth}
                />
              </div>
              <div class="field-group">
                <label class="field-label" for="display-avatar-h"
                  >{i18n.t('Custom avatar height')}</label
                >
                <input
                  id="display-avatar-h"
                  class="field"
                  type="number"
                  min="16"
                  max="256"
                  bind:value={displayForm.customAvatarHeight}
                />
              </div>
            {/if}
          </div>

          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                class="accent-violet-500"
                bind:checked={displayForm.chatAvatarMode}
              />
              {i18n.t('Show avatars')}
            </label>
            <label class="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                class="accent-violet-500"
                bind:checked={displayForm.chatAlternating}
              />
              {i18n.t('Alternating messages')}
            </label>
          </div>

          <div class="flex flex-wrap items-center gap-3 pt-1">
            <button
              class="button-primary"
              type="button"
              disabled={displaySaving}
              onclick={saveDisplay}
            >
              <Save size={17} />
              {displaySaving ? i18n.t('Saving display...') : i18n.t('Save display')}
            </button>
            <button
              class="button-secondary"
              type="button"
              disabled={displaySaving || !displayDirty}
              onclick={resetDisplayForm}
            >
              {i18n.t('Reset')}
            </button>
            {#if displayMessage}
              <span class="text-xs text-neutral-400" aria-live="polite">{displayMessage}</span>
            {/if}
          </div>
        </section>
      {:else if tab === 'providers'}
        {#if editingProvider}
          <!-- Provider editor -->
          <form class="view-enter space-y-5" onsubmit={submitProvider}>
            <section class="space-y-4" aria-labelledby="provider-heading">
              <h2 id="provider-heading" class="text-sm font-semibold text-neutral-200">
                {i18n.t(providerForm._id ? 'Edit provider' : 'New provider')}
              </h2>

              <div class="field-group">
                <label class="field-label" for="provider-template">{i18n.t('Type')}</label>
                <select
                  id="provider-template"
                  class="field"
                  value={providerForm.templateId}
                  onchange={(e) => onProviderTemplate(e.currentTarget.value)}
                >
                  {#each PROVIDER_TEMPLATES as tpl (tpl.id)}
                    <option value={tpl.id}>{tpl.label}</option>
                  {/each}
                </select>
                <p class="field-hint">{i18n.t('Determines the API format and default URL.')}</p>
              </div>

              <div class="field-group">
                <label class="field-label" for="provider-name">{i18n.t('Name')}</label>
                <input
                  id="provider-name"
                  class="field"
                  type="text"
                  placeholder={i18n.t('My AI provider')}
                  maxlength="120"
                  bind:value={providerForm.name}
                />
                {#if providerNameError}<p class="text-xs text-red-300">{providerNameError}</p>{/if}
              </div>

              <div class="field-group">
                <label class="field-label" for="provider-url">{i18n.t('API URL')}</label>
                <input
                  id="provider-url"
                  oninput={resetProviderTest}
                  class="field"
                  type="url"
                  inputmode="url"
                  placeholder="https://api.example.com/v1"
                  bind:value={providerForm.url}
                />
              </div>

              <div class="field-group">
                <label class="field-label" for="provider-key">{i18n.t('API key')}</label>
                <input
                  id="provider-key"
                  class="field"
                  type="password"
                  autocomplete="off"
                  placeholder={providerForm.keySet
                    ? i18n.t('Key set — leave blank to keep')
                    : 'sk-…'}
                  bind:value={providerForm.key}
                  oninput={resetProviderTest}
                />
                <p class="field-hint">
                  {i18n.t(
                    providerForm.keySet
                      ? 'A key is saved. Leave this blank to keep it; type a new value to replace it.'
                      : 'Stored encrypted on the server.'
                  )}
                </p>
              </div>

              {#if providerTestStatus !== 'idle'}
                <div
                  class="flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm {providerTestStatus ===
                  'success'
                    ? 'border-emerald-900/70 bg-emerald-950/40 text-emerald-200'
                    : providerTestStatus === 'error'
                    ? 'border-red-900/70 bg-red-950/40 text-red-200'
                    : 'border-neutral-800 bg-neutral-900/50 text-neutral-300'}"
                  role="status"
                >
                  {#if providerTestStatus === 'testing'}
                    <RefreshCw class="mt-0.5 shrink-0 animate-spin" size={16} />
                  {:else if providerTestStatus === 'success'}
                    <CheckCircle2 class="mt-0.5 shrink-0" size={16} />
                  {:else}
                    <CircleX class="mt-0.5 shrink-0" size={16} />
                  {/if}
                  <span>
                    {providerTestStatus === 'testing'
                      ? i18n.t('Testing connection...')
                      : providerTestMessage}
                  </span>
                </div>
              {/if}
            </section>

            <div class="flex flex-wrap items-center gap-3 pt-1">
              <button class="button-primary" type="submit" disabled={settings.providerSaving}>
                <Save size={17} />
                {settings.providerSaving ? i18n.t('Saving...') : i18n.t('Save provider')}
              </button>
              <button
                class="button-secondary"
                type="button"
                disabled={providerTestStatus === 'testing' || settings.providerSaving}
                onclick={testProviderConnection}
              >
                <Wifi size={17} />
                {providerTestStatus === 'testing'
                  ? i18n.t('Testing...')
                  : i18n.t('Test connection')}
              </button>
              <button class="button-secondary" type="button" onclick={cancelProvider}>
                {i18n.t('Cancel')}
              </button>
            </div>
          </form>
        {:else}
          <!-- Provider list -->
          {#if !providers.length}
            <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <span
                class="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-400"
              >
                <Server size={22} />
              </span>
              <p class="text-sm text-neutral-400">{i18n.t('No providers yet.')}</p>
              <p class="max-w-sm text-xs text-neutral-500">
                {i18n.t(
                  'Add an OpenAI, Anthropic, OpenRouter, Google, Mistral, DeepSeek or custom OpenAI-compatible provider to use generation presets.'
                )}
              </p>
              <button class="button-primary mt-1" type="button" onclick={startAddProvider}>
                <Plus size={17} />
                {i18n.t('Add provider')}
              </button>
            </div>
          {:else}
            <ul class="view-enter space-y-2">
              {#each providers as provider (provider._id)}
                <li
                  class="flex items-center gap-3 rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300"
                  >
                    <Server size={17} />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="truncate text-sm font-medium text-neutral-100"
                        >{provider.name}</span
                      >
                      <span
                        class="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-neutral-300"
                      >
                        {providerLabel(provider)}
                      </span>
                      {#if provider.keySet}
                        <span
                          class="inline-flex items-center gap-1 rounded bg-emerald-900/50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300"
                        >
                          <KeyRound size={11} />
                          {i18n.t('Key set')}
                        </span>
                      {:else}
                        <span
                          class="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] font-medium text-neutral-500"
                        >
                          {i18n.t('No key')}
                        </span>
                      {/if}
                    </div>
                    <p class="mt-0.5 truncate text-xs text-neutral-500">
                      {provider.url || i18n.t('No URL')}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      class="icon-button"
                      type="button"
                      aria-label={`Edit ${provider.name}`}
                      onclick={() => startEditProvider(provider)}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      class="icon-button hover:text-red-300"
                      type="button"
                      aria-label={`Delete ${provider.name}`}
                      onclick={() => removeProvider(provider)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        {/if}
      {:else if editingPreset}
        <!-- Preset editor -->
        <form class="view-enter space-y-5" onsubmit={submitPreset}>
          <section class="space-y-4" aria-labelledby="preset-heading">
            <h2 id="preset-heading" class="text-sm font-semibold text-neutral-200">
              {i18n.t(presetForm._id ? 'Edit preset' : 'New preset')}
            </h2>

            {#if !providers.length}
              <div class="error-banner">
                {i18n.t('Add a provider first — presets route generation through a provider.')}
              </div>
            {/if}

            <div class="field-group">
              <label class="field-label" for="preset-name">{i18n.t('Name')}</label>
              <input
                id="preset-name"
                class="field"
                type="text"
                placeholder="My GPT-4o preset"
                maxlength="120"
                bind:value={presetForm.name}
              />
              {#if presetNameError}<p class="text-xs text-red-300">{presetNameError}</p>{/if}
            </div>

            <div class="field-group">
              <label class="field-label" for="preset-provider">{i18n.t('Provider')}</label>
              <select
                id="preset-provider"
                class="field"
                value={presetForm.providerId}
                onchange={(e) => onPresetProvider(e.currentTarget.value)}
              >
                {#each providers as provider (provider._id)}
                  <option value={provider._id}>{provider.name} · {providerLabel(provider)}</option>
                {/each}
              </select>
            </div>

            <div class="field-group">
              <label class="field-label" for="preset-model">{i18n.t('Model')}</label>
              <div class="flex items-center gap-2">
                <input
                  id="preset-model"
                  class="field min-w-0 flex-1"
                  type="text"
                  list="provider-model-options"
                  placeholder="provider/model-name"
                  autocomplete="off"
                  bind:value={presetForm.model}
                />
                <button
                  class="icon-button border border-neutral-700 bg-neutral-900"
                  type="button"
                  aria-label={i18n.t('Refresh model list')}
                  title={i18n.t('Refresh model list')}
                  disabled={modelLoading || !presetForm.providerId}
                  onclick={refreshModels}
                >
                  <RefreshCw class={modelLoading ? 'animate-spin' : ''} size={17} />
                </button>
              </div>
              <datalist id="provider-model-options">
                {#each modelOptions as model (model)}
                  <option value={model}>{model}</option>
                {/each}
              </datalist>
              <p
                class="field-hint"
                class:text-emerald-400={modelOptions.length > 0}
                aria-live="polite"
              >
                {modelLoading
                  ? i18n.t('Loading models...')
                  : i18n.t(
                      modelMessage ||
                        'Choose a discovered model or enter the exact model id manually.'
                    )}
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div class="field-group">
                <label class="field-label" for="preset-temp">{i18n.t('Temperature')}</label>
                <input
                  id="preset-temp"
                  class="field"
                  type="number"
                  step="0.05"
                  min="0"
                  max="2"
                  inputmode="decimal"
                  bind:value={presetForm.temp}
                />
              </div>
              <div class="field-group">
                <label class="field-label" for="preset-max-tokens">{i18n.t('Max tokens')}</label>
                <input
                  id="preset-max-tokens"
                  class="field"
                  type="number"
                  step="1"
                  min="1"
                  inputmode="numeric"
                  bind:value={presetForm.maxTokens}
                />
              </div>
              <div class="field-group">
                <label class="field-label" for="preset-max-context">{i18n.t('Max context')}</label>
                <input
                  id="preset-max-context"
                  class="field"
                  type="number"
                  step="1"
                  min="1"
                  inputmode="numeric"
                  bind:value={presetForm.maxContext}
                />
              </div>
            </div>

            <details class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
              <summary class="cursor-pointer text-sm font-medium text-neutral-200">
                {i18n.t('JSON mode')}
              </summary>
              <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="field-group">
                  <label class="field-label" for="preset-json-enabled"
                    >{i18n.t('JSON output')}</label
                  >
                  <select
                    id="preset-json-enabled"
                    class="field"
                    bind:value={presetForm.jsonEnabled}
                  >
                    <option value="off">{i18n.t('Off')}</option>
                    <option value="standard">{i18n.t('Standard (structured reply)')}</option>
                    <option value="separate">{i18n.t('Separate (out-of-band)')}</option>
                  </select>
                </div>
                <div class="field-group">
                  <label class="field-label" for="preset-json-source"
                    >{i18n.t('Schema source')}</label
                  >
                  <select id="preset-json-source" class="field" bind:value={presetForm.jsonSource}>
                    <option value="character">{i18n.t('Character')}</option>
                    <option value="preset">{i18n.t('Preset')}</option>
                    <option value="json-preset">{i18n.t('JSON preset')}</option>
                  </select>
                  <p class="field-hint">
                    {i18n.t("Use “Character” to activate a character's JSON schema.")}
                  </p>
                </div>
              </div>
            </details>

            <details
              class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3"
              open
            >
              <summary class="cursor-pointer text-sm font-medium text-neutral-200">
                {i18n.t('Prompt')}
              </summary>
              <div class="mt-3 space-y-4">
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="field-group">
                    <label class="field-label" for="preset-prompt-mode"
                      >{i18n.t('Use advanced prompt')}</label
                    >
                    <select
                      id="preset-prompt-mode"
                      class="field"
                      bind:value={presetForm.useAdvancedPrompt}
                    >
                      <option value="basic">{i18n.t('Basic prompt order')}</option>
                      <option value="no-validation">{i18n.t('Raw prompt template')}</option>
                    </select>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="preset-model-format"
                      >{i18n.t('Prompt format')}</label
                    >
                    <select
                      id="preset-model-format"
                      class="field"
                      bind:value={presetForm.modelFormat}
                    >
                      {#each MODEL_FORMAT_OPTIONS as format (format)}
                        <option value={format}>{format}</option>
                      {/each}
                    </select>
                  </div>
                </div>

                {#if presetForm.useAdvancedPrompt === 'basic'}
                  <div class="field-group">
                    <span class="field-label">{i18n.t('Prompt ordering')}</span>
                    <p class="field-hint">
                      {i18n.t('Drag or use the arrows to reorder. Disable sections to omit them.')}
                    </p>
                    <ul class="space-y-1.5">
                      {#each presetForm.promptOrder as item, index (item.placeholder)}
                        <li
                          class="flex items-center gap-2 rounded-md border border-neutral-800/80 px-2 py-1.5 {item.enabled
                            ? 'bg-neutral-900/60'
                            : 'bg-neutral-900/20 opacity-60'}"
                        >
                          <button
                            class="icon-button"
                            type="button"
                            aria-label={i18n.t('Move up')}
                            title={i18n.t('Move up')}
                            disabled={index === 0}
                            onclick={() => movePromptSection(index, -1)}
                          >
                            <MoveUp size={15} />
                          </button>
                          <button
                            class="icon-button"
                            type="button"
                            aria-label={i18n.t('Move down')}
                            title={i18n.t('Move down')}
                            disabled={index === presetForm.promptOrder.length - 1}
                            onclick={() => movePromptSection(index, 1)}
                          >
                            <MoveDown size={15} />
                          </button>
                          <span class="min-w-0 flex-1 truncate text-sm text-neutral-200">
                            {i18n.t(
                              PROMPT_SECTION_LABELS[item.placeholder as PromptSectionId] ??
                                item.placeholder
                            )}
                          </span>
                          <label
                            class="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400"
                          >
                            <input
                              type="checkbox"
                              class="accent-violet-500"
                              checked={item.enabled}
                              onchange={() => togglePromptSection(index)}
                            />
                            {i18n.t('Enabled')}
                          </label>
                        </li>
                      {/each}
                    </ul>
                  </div>
                {:else}
                  <div class="field-group">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <label class="field-label" for="preset-gaslight"
                        >{i18n.t('Raw prompt template')}</label
                      >
                      <select
                        class="field w-auto py-1 text-xs"
                        value=""
                        onchange={(e) => {
                          if (e.currentTarget.value) insertPlaceholder(e.currentTarget.value)
                          e.currentTarget.value = ''
                        }}
                      >
                        <option value="">{i18n.t('Insert placeholder')}</option>
                        {#each PLACEHOLDER_OPTIONS as ph (ph.value)}
                          <option value={ph.inserted}>{ph.value}</option>
                        {/each}
                      </select>
                    </div>
                    <textarea
                      id="preset-gaslight"
                      bind:this={rawTemplateEl}
                      class="field min-h-40 resize-y font-mono text-xs leading-5"
                      spellcheck="false"
                      bind:value={presetForm.gaslight}
                      oninput={onRawTemplateInput}
                    />
                    {#if presetPromptError}
                      <p class="text-xs text-red-300">{presetPromptError}</p>
                    {/if}
                  </div>
                {/if}

                <div class="grid grid-cols-1 gap-4">
                  <div class="field-group">
                    <label class="field-label" for="preset-system-prompt"
                      >{i18n.t('Global system prompt')}</label
                    >
                    <textarea
                      id="preset-system-prompt"
                      class="field min-h-20 resize-y"
                      bind:value={presetForm.systemPrompt}
                    />
                    <label class="flex items-center gap-2 text-xs text-neutral-400">
                      <input
                        type="checkbox"
                        class="accent-violet-500"
                        bind:checked={presetForm.ignoreCharacterSystemPrompt}
                      />
                      <span>
                        {i18n.t('Ignore character system prompt')} —
                        {i18n.t('Overrides any character system prompt with the global one above.')}
                      </span>
                    </label>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="preset-ujb"
                      >{i18n.t('Global jailbreak / UJB')}</label
                    >
                    <textarea
                      id="preset-ujb"
                      class="field min-h-20 resize-y"
                      bind:value={presetForm.ultimeJailbreak}
                    />
                    <label class="flex items-center gap-2 text-xs text-neutral-400">
                      <input
                        type="checkbox"
                        class="accent-violet-500"
                        bind:checked={presetForm.ignoreCharacterUjb}
                      />
                      <span>
                        {i18n.t('Ignore character jailbreak')} —
                        {i18n.t('Overrides any character jailbreak with the global one above.')}
                      </span>
                    </label>
                  </div>
                  <div class="field-group">
                    <label class="field-label" for="preset-prefill"
                      >{i18n.t('Bot response prefill')}</label
                    >
                    <textarea
                      id="preset-prefill"
                      class="field min-h-16 resize-y"
                      bind:value={presetForm.prefill}
                    />
                  </div>
                </div>
              </div>
            </details>
          </section>

          <div class="flex items-center gap-3 pt-1">
            <button class="button-primary" type="submit" disabled={settings.presetSaving}>
              <Save size={17} />
              {settings.presetSaving ? i18n.t('Saving...') : i18n.t('Save preset')}
            </button>
            <button class="button-secondary" type="button" onclick={cancelPreset}
              >{i18n.t('Cancel')}</button
            >
          </div>
        </form>
      {:else}
        <!-- Preset list -->
        {#if !presets.length}
          <div class="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span
              class="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800/80 text-neutral-400"
            >
              <SlidersHorizontal size={22} />
            </span>
            <p class="text-sm text-neutral-400">{i18n.t('No presets yet')}</p>
            <p class="max-w-sm text-xs text-neutral-500">
              {i18n.t(
                'A preset ties a provider to a model and sampling defaults, and is what a chat generates with.'
              )}
            </p>
            {#if providers.length}
              <button class="button-primary mt-1" type="button" onclick={startAddPreset}>
                <Plus size={17} />
                {i18n.t('New preset')}
              </button>
            {/if}
          </div>
        {:else}
          <ul class="view-enter space-y-2">
            {#each presets as preset (preset._id)}
              {@const isDefault = preset._id === defaultPresetId}
              {@const provider = providers.find((p) => p._id === preset.providerId)}
              <li
                class="flex items-center gap-3 rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3"
              >
                <span
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 text-neutral-300"
                >
                  <SlidersHorizontal size={17} />
                </span>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="truncate text-sm font-medium text-neutral-100">{preset.name}</span>
                    {#if isDefault}
                      <span
                        class="inline-flex items-center gap-1 rounded bg-violet-900/50 px-1.5 py-0.5 text-[11px] font-medium text-violet-300"
                      >
                        <Star size={11} />
                        {i18n.t('Default')}
                      </span>
                    {/if}
                    {#if preset.jsonEnabled && preset.jsonEnabled !== 'off'}
                      <span
                        class="rounded bg-sky-900/50 px-1.5 py-0.5 text-[11px] font-medium text-sky-300"
                      >
                        JSON · {preset.jsonSource ?? 'character'}
                      </span>
                    {/if}
                  </div>
                  <p class="mt-0.5 truncate text-xs text-neutral-500">
                    {provider ? provider.name + ' · ' : ''}{presetModel(preset) ||
                      i18n.t('No model')}{#if preset.service} · {preset.service}{/if}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-1">
                  {#if !isDefault}
                    <button
                      class="icon-button"
                      type="button"
                      title={i18n.t('Set as default')}
                      onclick={() => makeDefault(preset)}
                      disabled={settings.defaultSaving}
                    >
                      <Star size={17} />
                    </button>
                  {/if}
                  <button
                    class="icon-button"
                    type="button"
                    aria-label={`${i18n.t('Edit')} ${preset.name}`}
                    onclick={() => startEditPreset(preset)}
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    class="icon-button hover:text-red-300"
                    type="button"
                    aria-label={`${i18n.t('Delete')} ${preset.name}`}
                    onclick={() => removePreset(preset)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      {/if}
    </div>
  </div>
</div>
