<script lang="ts">
  import { Save, SlidersHorizontal, Trash2, X } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import {
    getRisuToggleConfig,
    parseRisuToggleSyntax,
    withRisuToggleConfig,
    withRisuToggleDefaults,
    withoutRisuToggleConfig,
    type RisuToggleDefinition,
  } from '/common/risu-toggles'
  import { api } from '/app/lib/api'
  import { chats } from '/app/lib/chats.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { router } from '/app/lib/router.svelte'
  import { session } from '/app/lib/session.svelte'
  import { chatControls } from '/app/lib/chat-controls.svelte'

  type ChatWithRisuToggles = AppSchema.Chat & { risuToggleValues?: Record<string, string> }

  let setupOpen = $state(false)
  let selectedPresetId = $state('')
  let loadedPresetId = $state('')
  let sourceDraft = $state('')
  let templateDraft = $state('')
  let saving = $state(false)
  let message = $state('')
  let defaultSaving = $state(false)
  let defaultStatus = $state('')

  const route = $derived(router.route)
  const settingsMode = $derived(route.name === 'settings' && route.tab === 'presets')
  const chat = $derived(chats.detail?.chat as ChatWithRisuToggles | undefined)
  const activePreset = $derived(session.presets.find((preset) => preset._id === chat?.genPreset))
  const activeConfig = $derived(getRisuToggleConfig(activePreset))
  const activeDefinitions = $derived(
    activeConfig ? parseRisuToggleSyntax(activeConfig.source) : ([] as RisuToggleDefinition[])
  )
  const interactiveDefinitions = $derived(
    activeDefinitions.filter((definition) => 'key' in definition)
  )
  const selectedPreset = $derived(session.presets.find((preset) => preset._id === selectedPresetId))
  const selectedConfig = $derived(getRisuToggleConfig(selectedPreset))
  const panelOpen = $derived(settingsMode ? setupOpen : chatControls.promptOpen)

  function setPanelOpen(value: boolean) {
    if (settingsMode) setupOpen = value
    else chatControls.promptOpen = value
  }

  const text = (english: string, korean: string) => (i18n.locale === 'ko' ? korean : english)

  $effect(() => {
    if (!settingsMode) return
    if (!selectedPresetId || !session.presets.some((preset) => preset._id === selectedPresetId)) {
      selectedPresetId = session.presets[0]?._id ?? ''
    }
  })

  $effect(() => {
    const preset = selectedPreset
    if (!preset || loadedPresetId === preset._id) return
    const config = getRisuToggleConfig(preset)
    sourceDraft = config?.source ?? ''
    templateDraft = config?.template ?? preset.gaslight ?? ''
    loadedPresetId = preset._id
    message = ''
  })

  $effect(() => {
    // Navigation closes the panel. Chat detail updates can briefly recalculate the active preset,
    // so a transient missing config must not close a panel the user just opened.
    if (!settingsMode && route.name !== 'chat') {
      setupOpen = false
      chatControls.closePrompt()
    }
  })

  function editablePresetBody(preset: AppSchema.UserGenPreset) {
    const body: Record<string, any> = { ...preset }
    delete body._id
    delete body.userId
    delete body.kind
    delete body.updatedAt
    return body
  }

  async function saveConfig() {
    const preset = selectedPreset
    if (!preset || saving) return
    if (!sourceDraft.trim()) {
      message = text('Enter the RisuAI toggle definition.', 'RisuAI 토글 정의를 입력하세요.')
      return
    }
    if (!templateDraft.trim()) {
      message = text(
        'Enter the toggle-aware prompt template.',
        '토글 매크로가 포함된 프롬프트 원문을 입력하세요.'
      )
      return
    }

    saving = true
    message = ''
    try {
      const configured = withRisuToggleConfig(
        editablePresetBody(preset) as Partial<AppSchema.GenSettings>,
        sourceDraft,
        templateDraft
      )
      const updated = await api.post<AppSchema.UserGenPreset>(`/user/presets/${preset._id}`, {
        ...configured,
        promptTemplateId: null,
      })
      session.presets = session.presets.map((item) => (item._id === updated._id ? updated : item))
      message = text('RisuAI toggles attached.', 'RisuAI 토글을 프리셋에 연결했습니다.')
    } catch (ex) {
      message =
        ex instanceof Error
          ? ex.message
          : text('Could not save toggles.', '토글을 저장하지 못했습니다.')
    } finally {
      saving = false
    }
  }

  async function detachConfig() {
    const preset = selectedPreset
    const config = getRisuToggleConfig(preset)
    if (!preset || !config || saving) return
    if (
      !window.confirm(
        text('Remove RisuAI toggles from this preset?', '이 프리셋에서 RisuAI 토글을 제거할까요?')
      )
    )
      return

    saving = true
    message = ''
    try {
      const detached = withoutRisuToggleConfig(
        editablePresetBody(preset) as Partial<AppSchema.GenSettings>
      )
      const updated = await api.post<AppSchema.UserGenPreset>(`/user/presets/${preset._id}`, {
        ...detached,
        gaslight: config.template,
        promptTemplateId: null,
      })
      session.presets = session.presets.map((item) => (item._id === updated._id ? updated : item))
      sourceDraft = ''
      templateDraft = updated.gaslight ?? config.template
      message = text('RisuAI toggles removed.', 'RisuAI 토글을 제거했습니다.')
    } catch (ex) {
      message =
        ex instanceof Error
          ? ex.message
          : text('Could not remove toggles.', '토글을 제거하지 못했습니다.')
    } finally {
      saving = false
    }
  }

  function currentValue(definition: Extract<RisuToggleDefinition, { key: string }>) {
    return (
      chat?.risuToggleValues?.[definition.key] ??
      activeConfig?.defaults?.[definition.key] ??
      definition.defaultValue
    )
  }

  async function setToggleValue(
    definition: Extract<RisuToggleDefinition, { key: string }>,
    value: string
  ) {
    const detail = chats.detail
    if (!detail) return

    defaultStatus = ''
    const previous = (detail.chat as ChatWithRisuToggles).risuToggleValues ?? {}
    const next = { ...previous, [definition.key]: value }
    chats.detail = {
      ...detail,
      chat: { ...detail.chat, risuToggleValues: next } as ChatWithRisuToggles,
    }

    try {
      await api.put(`/chat/${detail.chat._id}`, { risuToggleValues: next })
    } catch (ex) {
      chats.detail = {
        ...detail,
        chat: { ...detail.chat, risuToggleValues: previous } as ChatWithRisuToggles,
      }
      message =
        ex instanceof Error
          ? ex.message
          : text('Could not save toggle.', '토글값을 저장하지 못했습니다.')
    }
  }

  async function saveCurrentDefaults() {
    const preset = activePreset
    const config = activeConfig
    if (!preset || !config || defaultSaving) return

    const defaults = Object.fromEntries(
      interactiveDefinitions.map((definition) => [definition.key, currentValue(definition)])
    )
    defaultSaving = true
    defaultStatus = ''
    message = ''
    try {
      const configured = withRisuToggleDefaults(
        editablePresetBody(preset) as Partial<AppSchema.GenSettings>,
        defaults
      )
      const updated = await api.post<AppSchema.UserGenPreset>(`/user/presets/${preset._id}`, {
        ...configured,
        promptTemplateId: null,
      })
      session.presets = session.presets.map((item) => (item._id === updated._id ? updated : item))
      defaultStatus = text(
        'Current values are now the preset defaults.',
        '현재 값이 프리셋 기본값으로 저장되었습니다.'
      )
    } catch (ex) {
      message =
        ex instanceof Error
          ? ex.message
          : text('Could not save defaults.', '기본값을 저장하지 못했습니다.')
    } finally {
      defaultSaving = false
    }
  }

  function selectPreset(id: string) {
    selectedPresetId = id
    loadedPresetId = ''
  }
</script>

{#if settingsMode}
  <button
    class="fixed bottom-5 right-4 z-30 flex items-center gap-2 rounded-full border border-violet-700/70 bg-violet-950/95 px-4 py-2.5 text-sm font-medium text-violet-100 shadow-xl backdrop-blur hover:bg-violet-900 sm:right-5"
    type="button"
    aria-expanded={panelOpen}
    onclick={() => setPanelOpen(!panelOpen)}
  >
    <SlidersHorizontal size={17} />
    {text('Risu toggle setup', 'Risu 토글 설정')}
  </button>
{/if}

{#if panelOpen && settingsMode}
  <section
    class="fixed bottom-20 right-5 z-40 flex max-h-[78vh] w-[min(38rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl"
    aria-label={text('Risu toggle setup', 'Risu 토글 설정')}
  >
    <header class="flex items-center gap-2 border-b border-neutral-800 px-4 py-3">
      <SlidersHorizontal size={17} class="text-violet-300" />
      <h2 class="flex-1 text-sm font-semibold text-neutral-100">
        {text('RisuAI prompt toggles', 'RisuAI 프롬프트 토글')}
      </h2>
      <button
        class="icon-button"
        type="button"
        onclick={() => setPanelOpen(false)}
        aria-label={text('Close', '닫기')}
      >
        <X size={17} />
      </button>
    </header>

    <div class="space-y-4 overflow-y-auto p-4">
      <label class="field-group">
        <span class="field-label">{text('Preset', '프리셋')}</span>
        <select
          class="field"
          value={selectedPresetId}
          onchange={(event) => selectPreset(event.currentTarget.value)}
        >
          {#each session.presets as preset (preset._id)}
            <option value={preset._id}>{preset.name}</option>
          {/each}
        </select>
      </label>

      <label class="field-group">
        <span class="field-label">customPromptTemplateToggle</span>
        <textarea
          class="field min-h-40 resize-y font-mono text-xs leading-5"
          bind:value={sourceDraft}
          spellcheck="false"
          placeholder="key=label=select=option 1,option 2"
        />
        <span class="field-hint">
          {text(
            'Paste the toggle definition stored in the RisuAI preset. Selects use numeric indexes; text and checkboxes are also supported.',
            'RisuAI 프리셋의 토글 정의 원문입니다. 선택지는 숫자 인덱스, 텍스트와 체크박스도 지원합니다.'
          )}
        </span>
      </label>

      <label class="field-group">
        <span class="field-label"
          >{text('Toggle-aware prompt source', '토글 매크로 포함 프롬프트 원문')}</span
        >
        <textarea
          class="field min-h-64 resize-y font-mono text-xs leading-5"
          bind:value={templateDraft}
          spellcheck="false"
        />
        <span class="field-hint">
          {text(
            'The source is preserved. Risu macros are resolved only when a reply is generated.',
            '원문은 그대로 보존하고, 실제 답변을 생성할 때만 Risu 매크로를 계산합니다.'
          )}
        </span>
      </label>

      {#if sourceDraft.trim()}
        <p class="text-xs text-neutral-400">
          {text('Detected controls', '감지된 컨트롤')}: {parseRisuToggleSyntax(sourceDraft).filter(
            (item) => 'key' in item
          ).length}
        </p>
      {/if}

      {#if message}<p class="text-xs text-neutral-300" aria-live="polite">{message}</p>{/if}
    </div>

    <footer class="flex flex-wrap justify-end gap-2 border-t border-neutral-800 px-4 py-3">
      {#if selectedConfig}
        <button
          class="button-secondary text-red-200"
          type="button"
          disabled={saving}
          onclick={detachConfig}
        >
          <Trash2 size={16} />
          {text('Remove', '제거')}
        </button>
      {/if}
      <button
        class="button-primary"
        type="button"
        disabled={saving || !selectedPreset}
        onclick={saveConfig}
      >
        <Save size={16} />
        {saving ? text('Saving...', '저장 중...') : text('Save', '저장')}
      </button>
    </footer>
  </section>
{/if}

{#if panelOpen && route.name === 'chat' && activeConfig}
  <section
    class="fixed inset-x-2 top-[calc(3.75rem+env(safe-area-inset-top))] z-40 flex max-h-[calc(100dvh-4rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:inset-x-auto sm:right-5 sm:top-[4.5rem] sm:max-h-[calc(100dvh-5.25rem)] sm:w-[min(25rem,calc(100vw-2.5rem))]"
    aria-label={text('Prompt toggles', '프롬프트 토글')}
  >
    <header
      class="flex shrink-0 items-center gap-2 border-b border-neutral-800 bg-[#10151d] px-3 py-2.5 sm:px-4 sm:py-3"
    >
      <SlidersHorizontal size={17} class="text-violet-300" />
      <div class="min-w-0 flex-1">
        <h2 class="truncate text-sm font-semibold text-neutral-100">{activePreset?.name}</h2>
        <p class="text-xs text-neutral-500">
          {text('Values are saved per chat.', '토글값은 채팅별로 저장됩니다.')}
        </p>
      </div>
      <button
        class="icon-button"
        type="button"
        onclick={() => setPanelOpen(false)}
        aria-label={text('Close', '닫기')}
      >
        <X size={17} />
      </button>
    </header>

    <div
      class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 sm:space-y-4 sm:p-4"
    >
      {#each activeDefinitions as definition, index (`${definition.kind}-${'key' in definition ? definition.key : index}`)}
        {#if definition.kind === 'group'}
          <h3 class="pt-1 text-sm font-semibold text-violet-200">{definition.label}</h3>
        {:else if definition.kind === 'divider'}
          <div class="border-t border-neutral-800 pt-3 text-xs text-neutral-500">
            {definition.label}
          </div>
        {:else if definition.kind === 'select'}
          <label class="field-group">
            <span class="field-label">{definition.label}</span>
            <select
              class="field"
              value={currentValue(definition)}
              onchange={(event) => setToggleValue(definition, event.currentTarget.value)}
            >
              {#each definition.options as option, optionIndex (`${definition.key}-${optionIndex}`)}
                <option value={String(optionIndex)}>{option}</option>
              {/each}
            </select>
          </label>
        {:else if definition.kind === 'text'}
          <label class="field-group">
            <span class="field-label">{definition.label}</span>
            <input
              class="field"
              type="text"
              value={currentValue(definition)}
              onchange={(event) => setToggleValue(definition, event.currentTarget.value)}
            />
          </label>
        {:else}
          <label class="flex items-center justify-between gap-3 text-sm text-neutral-300">
            <span>{definition.label}</span>
            <input
              type="checkbox"
              class="h-4 w-4 accent-violet-500"
              checked={currentValue(definition) === '1'}
              onchange={(event) =>
                setToggleValue(definition, event.currentTarget.checked ? '1' : '0')}
            />
          </label>
        {/if}
      {/each}
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-4"
      >
        <p class="max-w-56 text-xs text-neutral-500">
          {text(
            'New chats use these values until changed.',
            '새 채팅은 변경하기 전까지 이 값을 사용합니다.'
          )}
        </p>
        <button
          class="button-secondary"
          type="button"
          disabled={defaultSaving}
          onclick={saveCurrentDefaults}
        >
          <Save size={15} />
          {defaultSaving
            ? text('Saving...', '저장 중...')
            : text('Use as defaults', '현재 값을 기본값으로')}
        </button>
      </div>
      {#if defaultStatus}
        <p class="text-xs text-emerald-300" aria-live="polite">{defaultStatus}</p>
      {/if}
      {#if message}<p class="text-xs text-red-300" aria-live="polite">{message}</p>{/if}
    </div>
  </section>
{/if}
