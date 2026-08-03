import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before)
  if (index < 0) throw new Error(`Could not find ${label}`)
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected one ${label}`)
  }
  return source.slice(0, index) + after + source.slice(index + before.length)
}

// --------------------------------------------------------------------------- Chat
const chatPath = 'app/src/routes/Chat.svelte'
let chat = readFileSync(chatPath, 'utf8')

chat = replaceOnce(
  chat,
  "  import { renderMarkdown } from '/app/lib/markdown'\n",
  "  import { renderMarkdown } from '/app/lib/markdown'\n  import { applyPresetDisplayRegex } from '/common/display-regex'\n",
  'Chat display regex import'
)

chat = replaceOnce(
  chat,
  "  const detail = $derived(chats.detail!)\n  const ui = $derived(uiSettings.settings)\n",
  "  const detail = $derived(chats.detail!)\n  const activePreset = $derived(\n    session.presets.find((preset) => preset._id === detail.chat.genPreset)\n  )\n  const ui = $derived(uiSettings.settings)\n",
  'active preset derivation'
)

chat = replaceOnce(
  chat,
  `  const displayMessage = (text: string, speaker?: AppSchema.Character) =>
    text
      .replace(
        /\\{\\{user\\}\\}/gi,
        personas.selected?.name ||
          session.profile?.handle ||
          session.user?.username ||
          i18n.t('You')
      )
      .replace(/\\{\\{char\\}\\}/gi, speaker?.name || detail.character?.name || detail.chat.name)
`,
  `  const displayMessage = (
    text: string,
    speaker?: AppSchema.Character,
    transformBotOutput = false
  ) => {
    const resolved = text
      .replace(
        /\\{\\{user\\}\\}/gi,
        personas.selected?.name ||
          session.profile?.handle ||
          session.user?.username ||
          i18n.t('You')
      )
      .replace(/\\{\\{char\\}\\}/gi, speaker?.name || detail.character?.name || detail.chat.name)

    return transformBotOutput ? applyPresetDisplayRegex(resolved, activePreset) : resolved
  }
`,
  'displayMessage function'
)

chat = replaceOnce(
  chat,
  `  const renderBody = (text: string, speaker?: AppSchema.Character): RenderedBodyPart[] => {
    const displayed = displayMessage(text, speaker)
`,
  `  const renderBody = (
    text: string,
    speaker?: AppSchema.Character,
    transformBotOutput = false
  ): RenderedBodyPart[] => {
    const displayed = displayMessage(text, speaker, transformBotOutput)
`,
  'renderBody signature'
)

chat = chat.replace(
  '{#each renderBody(message.msg, character) as part}',
  '{#each renderBody(message.msg, character, !isUser) as part}'
)
chat = chat.replace(
  '{#each renderBody(chats.partial, detail.character) as part}',
  '{#each renderBody(chats.partial, detail.character, true) as part}'
)
writeFileSync(chatPath, chat)

// ---------------------------------------------------------------- Settings store
const storePath = 'app/src/lib/settings.svelte.ts'
let store = readFileSync(storePath, 'utf8')

store = replaceOnce(
  store,
  "import type { SummaryCategory } from '/common/summary'\n",
  "import type { SummaryCategory } from '/common/summary'\nimport { withDisplayRegexRules, type DisplayRegexRule } from '/common/display-regex'\n",
  'settings display regex import'
)

store = replaceOnce(
  store,
  "  secondaryProviderId: string\n  secondaryModel: string\n}\n",
  "  secondaryProviderId: string\n  secondaryModel: string\n  displayRegexRules: DisplayRegexRule[]\n}\n",
  'PresetInput display regex field'
)

store = replaceOnce(
  store,
  `        secondaryProviderModels: {
          ...(existing?.secondaryProviderModels ?? {}),
          ...(input.secondaryProviderId
            ? { [input.secondaryProviderId]: input.secondaryModel.trim() }
            : {}),
        },
`,
  `        secondaryProviderModels: {
          ...(existing?.secondaryProviderModels ?? {}),
          ...(input.secondaryProviderId
            ? { [input.secondaryProviderId]: input.secondaryModel.trim() }
            : {}),
        },
        temporary: withDisplayRegexRules(existing ?? {}, input.displayRegexRules).temporary,
`,
  'display regex persistence'
)
writeFileSync(storePath, store)

// --------------------------------------------------------------------- Settings UI
const settingsPath = 'app/src/routes/Settings.svelte'
let settings = readFileSync(settingsPath, 'utf8')

settings = replaceOnce(
  settings,
  "  import { renderPromptPreview, type PromptPreview } from '/app/lib/prompt-preview'\n",
  `  import { renderPromptPreview, type PromptPreview } from '/app/lib/prompt-preview'
  import {
    applyDisplayRegexRules,
    displayRegexError,
    getDisplayRegexRules,
    type DisplayRegexRule,
  } from '/common/display-regex'
`,
  'Settings display regex import'
)

settings = replaceOnce(
  settings,
  "    secondaryProviderId: string\n    secondaryModel: string\n  }\n",
  "    secondaryProviderId: string\n    secondaryModel: string\n    displayRegexRules: DisplayRegexRule[]\n  }\n",
  'PresetForm display regex field'
)

settings = replaceOnce(
  settings,
  "  let previewError = $state('')\n",
  `  let previewError = $state('')
  let displayRegexPreviewSource = $state('<think>hidden thought</think>\\nVisible response')
  const displayRegexPreviewOutput = $derived(
    applyDisplayRegexRules(displayRegexPreviewSource, presetForm.displayRegexRules)
  )

  const newDisplayRegexRule = (): DisplayRegexRule => ({
    id: crypto.randomUUID(),
    name: '',
    enabled: true,
    pattern: '',
    flags: 'g',
    replacement: '',
  })

  function addDisplayRegexRule() {
    presetForm.displayRegexRules = [...presetForm.displayRegexRules, newDisplayRegexRule()]
  }

  function removeDisplayRegexRule(index: number) {
    presetForm.displayRegexRules = presetForm.displayRegexRules.filter((_, at) => at !== index)
  }

  function moveDisplayRegexRule(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= presetForm.displayRegexRules.length) return
    const next = presetForm.displayRegexRules.slice()
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    presetForm.displayRegexRules = next
  }
`,
  'display regex state and actions'
)

settings = replaceOnce(
  settings,
  "      secondaryProviderId: '',\n      secondaryModel: '',\n",
  "      secondaryProviderId: '',\n      secondaryModel: '',\n      displayRegexRules: [],\n",
  'empty preset display regex'
)

settings = replaceOnce(
  settings,
  `      secondaryModel: preset.secondaryProviderId
        ? preset.secondaryProviderModels?.[preset.secondaryProviderId] ?? ''
        : '',
`,
  `      secondaryModel: preset.secondaryProviderId
        ? preset.secondaryProviderModels?.[preset.secondaryProviderId] ?? ''
        : '',
      displayRegexRules: getDisplayRegexRules(preset),
`,
  'edit preset display regex'
)

settings = replaceOnce(
  settings,
  "      secondaryProviderId: presetForm.secondaryProviderId,\n      secondaryModel: presetForm.secondaryModel,\n",
  "      secondaryProviderId: presetForm.secondaryProviderId,\n      secondaryModel: presetForm.secondaryModel,\n      displayRegexRules: presetForm.displayRegexRules,\n",
  'submit display regex rules'
)

const regexUi = `
            <details
              class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3"
              data-testid="display-regex-settings"
            >
              <summary class="cursor-pointer text-sm font-medium text-neutral-200">
                {i18n.t('Display regex')}
              </summary>
              <div class="mt-3 space-y-4">
                <p class="field-hint">
                  {i18n.t(
                    'Transforms bot replies only while they are displayed. Stored messages, retries, summaries and prompts remain unchanged.'
                  )}
                </p>

                {#each presetForm.displayRegexRules as rule, index (rule.id)}
                  {@const ruleError = displayRegexError(rule)}
                  <section
                    class="space-y-3 rounded-lg border border-neutral-800 bg-[#0d1118]/60 p-3"
                    data-testid="display-regex-rule"
                  >
                    <div class="flex items-center gap-2">
                      <input
                        type="checkbox"
                        class="accent-violet-500"
                        bind:checked={rule.enabled}
                        aria-label={i18n.t('Enabled')}
                      />
                      <input
                        class="field min-w-0 flex-1"
                        type="text"
                        bind:value={rule.name}
                        placeholder={i18n.t('Rule name')}
                        aria-label={i18n.t('Rule name')}
                      />
                      <button
                        class="icon-button h-8 w-8"
                        type="button"
                        disabled={index === 0}
                        aria-label={i18n.t('Move up')}
                        title={i18n.t('Move up')}
                        onclick={() => moveDisplayRegexRule(index, -1)}
                      >
                        <MoveUp size={15} />
                      </button>
                      <button
                        class="icon-button h-8 w-8"
                        type="button"
                        disabled={index === presetForm.displayRegexRules.length - 1}
                        aria-label={i18n.t('Move down')}
                        title={i18n.t('Move down')}
                        onclick={() => moveDisplayRegexRule(index, 1)}
                      >
                        <MoveDown size={15} />
                      </button>
                      <button
                        class="icon-button h-8 w-8 text-neutral-500 hover:text-red-300"
                        type="button"
                        aria-label={i18n.t('Delete rule')}
                        title={i18n.t('Delete rule')}
                        onclick={() => removeDisplayRegexRule(index)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <label class="field-group">
                        <span class="field-label">{i18n.t('Pattern')}</span>
                        <textarea
                          class="field min-h-20 resize-y font-mono text-xs leading-5"
                          bind:value={rule.pattern}
                          spellcheck="false"
                          placeholder="<think>[\\s\\S]*?</think>\\s*"
                        ></textarea>
                      </label>
                      <label class="field-group">
                        <span class="field-label">{i18n.t('Flags')}</span>
                        <input
                          class="field font-mono text-xs"
                          type="text"
                          bind:value={rule.flags}
                          spellcheck="false"
                          placeholder="gi"
                        />
                      </label>
                    </div>

                    <label class="field-group">
                      <span class="field-label">{i18n.t('Replacement')}</span>
                      <textarea
                        class="field min-h-16 resize-y font-mono text-xs leading-5"
                        bind:value={rule.replacement}
                        spellcheck="false"
                        placeholder="$1"
                      ></textarea>
                    </label>
                    {#if ruleError}
                      <p class="text-xs text-red-300" role="alert">{ruleError}</p>
                    {/if}
                  </section>
                {:else}
                  <p class="rounded-lg border border-dashed border-neutral-800 px-3 py-4 text-center text-xs text-neutral-500">
                    {i18n.t('No display regex rules.')}
                  </p>
                {/each}

                <button class="button-secondary" type="button" onclick={addDisplayRegexRule}>
                  <Plus size={16} />
                  {i18n.t('Add rule')}
                </button>

                {#if presetForm.displayRegexRules.length}
                  <div class="grid gap-3 sm:grid-cols-2">
                    <label class="field-group">
                      <span class="field-label">{i18n.t('Preview input')}</span>
                      <textarea
                        class="field min-h-28 resize-y font-mono text-xs leading-5"
                        bind:value={displayRegexPreviewSource}
                        spellcheck="false"
                        data-testid="display-regex-preview-input"
                      ></textarea>
                    </label>
                    <div class="field-group">
                      <span class="field-label">{i18n.t('Preview output')}</span>
                      <pre
                        class="min-h-28 whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-[#0d1118] px-3 py-2 font-mono text-xs leading-5 text-neutral-300"
                        data-testid="display-regex-preview-output"
                      >{displayRegexPreviewOutput}</pre>
                    </div>
                  </div>
                {/if}
              </div>
            </details>
`

settings = replaceOnce(
  settings,
  `
            <details class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
              <summary class="cursor-pointer text-sm font-medium text-neutral-200">
                {i18n.t('JSON mode')}
`,
  `${regexUi}
            <details class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
              <summary class="cursor-pointer text-sm font-medium text-neutral-200">
                {i18n.t('JSON mode')}
`,
  'display regex settings panel'
)
writeFileSync(settingsPath, settings)

// ------------------------------------------------------------------------- i18n
const i18nPath = 'app/src/lib/i18n.svelte.ts'
let i18n = readFileSync(i18nPath, 'utf8')
i18n = replaceOnce(
  i18n,
  "  'Story summary': '스토리 요약',\n",
  `  'Story summary': '스토리 요약',
  'Display regex': '표시 정규식',
  'Transforms bot replies only while they are displayed. Stored messages, retries, summaries and prompts remain unchanged.':
    '봇 답변을 화면에 표시할 때만 변환합니다. 저장된 원문, 재생성, 요약, 프롬프트는 바뀌지 않습니다.',
  'Rule name': '규칙 이름',
  Pattern: '정규식',
  Flags: '플래그',
  Replacement: '치환 문자열',
  'Add rule': '규칙 추가',
  'Delete rule': '규칙 삭제',
  'No display regex rules.': '표시 정규식 규칙이 없습니다.',
  'Preview input': '미리보기 입력',
  'Preview output': '미리보기 결과',
  Enabled: '활성화',
`,
  'display regex translations'
)
writeFileSync(i18nPath, i18n)

// ----------------------------------------------------------------------- version
const packagePath = 'package.json'
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
pkg.version = '1.0.32'
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
