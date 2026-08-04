from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# App shell: mobile chat controls live in the real header, replacing the version badge only in chat.
p = Path('app/src/shared/AppShell.svelte')
s = p.read_text()
s = replace_once(
    s,
    "import { Menu, PanelLeftOpen } from '@lucide/svelte'",
    "import { Menu, PanelLeftOpen, Settings2, SlidersHorizontal } from '@lucide/svelte'",
    'AppShell icons',
)
s = replace_once(
    s,
    "import { normalizeAppTheme } from '/common/types/ui'",
    "import { normalizeAppTheme } from '/common/types/ui'\n  import { getRisuToggleConfig, parseRisuToggleSyntax } from '/common/risu-toggles'\n  import { chatControls } from '/app/lib/chat-controls.svelte'",
    'AppShell control imports',
)
current_marker = """  const current = $derived(
    route.name === 'character' || route.name === 'character-new'
      ? 'characters'
      : route.name === 'book'
      ? 'books'
      : route.name === 'persona'
      ? 'personas'
      : route.name
  )
"""
current_add = current_marker + """
  const activeChatPreset = $derived(
    route.name === 'chat'
      ? session.presets.find((preset) => preset._id === chats.detail?.chat.genPreset)
      : undefined
  )
  const hasPromptToggles = $derived(
    parseRisuToggleSyntax(getRisuToggleConfig(activeChatPreset)?.source ?? '').some(
      (definition) => 'key' in definition
    )
  )

  $effect(() => {
    route.name
    if (route.name !== 'chat') chatControls.closeAll()
  })
"""
s = replace_once(s, current_marker, current_add, 'AppShell derived state')
old_mobile = """      <span class=\"text-sm font-semibold tracking-wide text-white\">Machina</span>
      <span
        class=\"ml-auto rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-violet-200\"
        data-testid=\"build-version\"
        title={BUILD_DETAILS}>{BUILD_LABEL}</span
      >
"""
new_mobile = """      <span class=\"text-sm font-semibold tracking-wide text-white\">Machina</span>
      {#if route.name === 'chat'}
        <div class=\"ml-auto flex items-center gap-1\">
          {#if hasPromptToggles}
            <button
              class=\"icon-button\"
              class:text-violet-300={chatControls.promptOpen}
              type=\"button\"
              data-testid=\"mobile-prompt-toggles\"
              aria-label={i18n.t('Prompt toggles')}
              title={i18n.t('Prompt toggles')}
              aria-pressed={chatControls.promptOpen}
              onclick={() => chatControls.togglePrompt()}
            >
              <SlidersHorizontal size={18} />
            </button>
          {/if}
          <button
            class=\"icon-button\"
            class:text-violet-300={chatControls.optionsOpen}
            type=\"button\"
            data-testid=\"mobile-chat-options\"
            aria-label={i18n.t('Chat options')}
            title={i18n.t('Chat options')}
            aria-expanded={chatControls.optionsOpen}
            onclick={() => chatControls.toggleOptions()}
          >
            <Settings2 size={18} />
          </button>
        </div>
      {:else}
        <span
          class=\"ml-auto rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-violet-200\"
          data-testid=\"build-version\"
          title={BUILD_DETAILS}>{BUILD_LABEL}</span
        >
      {/if}
"""
s = replace_once(s, old_mobile, new_mobile, 'AppShell mobile header')
p.write_text(s)

# Chat: remove the floating mobile gear and use the shared header controls on all screen sizes.
p = Path('app/src/routes/Chat.svelte')
s = p.read_text()
s = replace_once(s, "    ScrollText,\n    Send,", "    ScrollText,\n    Send,\n    SlidersHorizontal,", 'Chat prompt icon')
s = replace_once(
    s,
    "  import { expandMessageWindow, findMessageWindowStart } from '/common/message-window'",
    "  import { expandMessageWindow, findMessageWindowStart } from '/common/message-window'\n  import { getRisuToggleConfig, parseRisuToggleSyntax } from '/common/risu-toggles'\n  import { chatControls } from '/app/lib/chat-controls.svelte'",
    'Chat control imports',
)
s = replace_once(
    s,
    "  const ui = $derived(uiSettings.settings)",
    "  const ui = $derived(uiSettings.settings)\n  const hasPromptToggles = $derived(\n    parseRisuToggleSyntax(getRisuToggleConfig(activePreset)?.source ?? '').some(\n      (definition) => 'key' in definition\n    )\n  )",
    'Chat prompt toggle derived',
)
s = s.replace("  let mobileHeaderOpen = $state(false)\n", "")
s = s.replace('mobileHeaderOpen', 'chatControls.optionsOpen')
# Remove the old floating mobile settings button.
start = s.find('  <button\n    class="absolute right-2 top-2 z-20')
if start < 0:
    raise SystemExit('missing marker: floating chat options')
end = s.find('\n\n  <header', start)
if end < 0:
    raise SystemExit('missing marker: desktop header after floating chat options')
s = s[:start] + s[end + 2 :]
# Add header actions before the summary button.
summary_button = """    <button
      class=\"icon-button text-neutral-500 hover:text-neutral-200\"
      class:text-violet-400={showSummary}
"""
header_actions = """    {#if hasPromptToggles}
      <button
        class=\"icon-button text-neutral-500 hover:text-neutral-200\"
        class:text-violet-400={chatControls.promptOpen}
        type=\"button\"
        data-testid=\"desktop-prompt-toggles\"
        aria-label={i18n.t('Prompt toggles')}
        title={i18n.t('Prompt toggles')}
        aria-pressed={chatControls.promptOpen}
        onclick={() => chatControls.togglePrompt()}
      >
        <SlidersHorizontal size={17} />
      </button>
    {/if}
    <button
      class=\"icon-button text-neutral-500 hover:text-neutral-200\"
      class:text-violet-400={chatControls.optionsOpen}
      type=\"button\"
      data-testid=\"desktop-chat-options\"
      aria-label={i18n.t('Chat options')}
      title={i18n.t('Chat options')}
      aria-expanded={chatControls.optionsOpen}
      onclick={() => chatControls.toggleOptions()}
    >
      <Settings2 size={17} />
    </button>
"""
s = replace_once(s, summary_button, header_actions + summary_button, 'Chat desktop actions')
s = s.replace('id="mobile-chat-controls"', 'id="chat-controls"')
s = s.replace('data-testid="mobile-chat-controls"', 'data-testid="chat-controls"')
s = s.replace(
    'class="absolute right-2 top-12 z-30 grid w-[min(20rem,calc(100vw-1rem))] gap-2 rounded-xl border border-neutral-700/80 bg-[#0d1118]/95 p-2 shadow-2xl backdrop-blur sm:hidden"',
    'class="absolute right-2 top-2 z-30 grid w-[min(20rem,calc(100vw-1rem))] gap-2 rounded-xl border border-neutral-700/80 bg-[#0d1118]/95 p-2 shadow-2xl backdrop-blur sm:top-[4.5rem]"',
)
# Escape closes whichever chat panel is open.
s = s.replace(
    "    if (messageAction) messageAction = null\n    else if (generationDebug)",
    "    if (chatControls.optionsOpen) chatControls.closeOptions()\n    else if (chatControls.promptOpen) chatControls.closePrompt()\n    else if (messageAction) messageAction = null\n    else if (generationDebug)",
    1,
)
# Switching chats closes stale panels.
s = replace_once(
    s,
    "  $effect(() => {\n    detail.chat._id\n    wasAtBottom = true\n  })",
    "  $effect(() => {\n    detail.chat._id\n    wasAtBottom = true\n    chatControls.closeAll()\n  })",
    'Chat close controls on switch',
)
p.write_text(s)

# Risu prompt controls: retain the setup-page launcher, but chat controls are opened from headers.
p = Path('app/src/shared/RisuTogglePanel.svelte')
s = p.read_text()
s = replace_once(
    s,
    "  import { session } from '/app/lib/session.svelte'",
    "  import { session } from '/app/lib/session.svelte'\n  import { chatControls } from '/app/lib/chat-controls.svelte'",
    'Risu shared controls import',
)
s = s.replace('  let open = $state(false)\n', '  let setupOpen = $state(false)\n')
select_marker = """  const selectedConfig = $derived(getRisuToggleConfig(selectedPreset))

  const text ="""
select_add = """  const selectedConfig = $derived(getRisuToggleConfig(selectedPreset))
  const panelOpen = $derived(settingsMode ? setupOpen : chatControls.promptOpen)

  function setPanelOpen(value: boolean) {
    if (settingsMode) setupOpen = value
    else chatControls.promptOpen = value
  }

  const text ="""
s = replace_once(s, select_marker, select_add, 'Risu panel state')
s = s.replace(' open = false', ' setupOpen = false')
s = s.replace('aria-expanded={open}', 'aria-expanded={panelOpen}')
s = s.replace('onclick={() => (open = !open)}', 'onclick={() => setPanelOpen(!panelOpen)}')
s = s.replace('onclick={() => (open = false)}', 'onclick={() => setPanelOpen(false)}')
s = s.replace('{#if open && settingsMode}', '{#if panelOpen && settingsMode}')
s = s.replace("{#if open && route.name === 'chat' && activeConfig}", "{#if panelOpen && route.name === 'chat' && activeConfig}")
s = s.replace("{#if settingsMode || (route.name === 'chat' && activeConfig && interactiveDefinitions.length)}", "{#if settingsMode}")
# The setup launcher no longer needs chat-mode label/count branches.
s = s.replace(
    """    {settingsMode
      ? text('Risu toggle setup', 'Risu 토글 설정')
      : text('Prompt toggles', '프롬프트 토글')}
    {#if !settingsMode}<span class=\"text-xs text-violet-300\">{interactiveDefinitions.length}</span
      >{/if}
""",
    """    {text('Risu toggle setup', 'Risu 토글 설정')}
""",
)
s = s.replace(
    """    class=\"fixed right-4 z-30 flex items-center gap-2 rounded-full sm:right-5 {settingsMode
      ? 'bottom-5'
      : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]'} border border-violet-700/70 bg-violet-950/95 px-4 py-2.5 text-sm font-medium text-violet-100 shadow-xl backdrop-blur hover:bg-violet-900\"""",
    """    class=\"fixed bottom-5 right-4 z-30 flex items-center gap-2 rounded-full border border-violet-700/70 bg-violet-950/95 px-4 py-2.5 text-sm font-medium text-violet-100 shadow-xl backdrop-blur hover:bg-violet-900 sm:right-5\"""",
)
s = s.replace(
    'class="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-4 z-40 max-h-[calc(100vh-11rem)] w-[min(25rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:right-5"',
    'class="fixed right-2 top-[3.75rem] z-40 max-h-[calc(100vh-4.5rem)] w-[min(25rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:right-5 sm:top-[4.5rem] sm:max-h-[calc(100vh-5.25rem)]"',
)
# If a chat/preset no longer has toggles, do not leave an empty panel open.
effect_marker = """  $effect(() => {
    // Close a panel that no longer has a reason to be visible after navigation.
    if (!settingsMode && route.name !== 'chat') setupOpen = false
  })
"""
effect_new = """  $effect(() => {
    // Close panels that no longer have a reason to be visible after navigation or preset changes.
    if (!settingsMode && route.name !== 'chat') {
      setupOpen = false
      chatControls.closePrompt()
    }
    if (route.name === 'chat' && (!activeConfig || !interactiveDefinitions.length)) {
      chatControls.closePrompt()
    }
  })
"""
s = replace_once(s, effect_marker, effect_new, 'Risu close effect')
p.write_text(s)
