from pathlib import Path

p=Path('app/src/shared/AppShell.svelte'); s=p.read_text()
s=s.replace("import { Menu, PanelLeftOpen } from '@lucide/svelte'", "import { Menu, PanelLeftOpen, Settings2, SlidersHorizontal } from '@lucide/svelte'")
s=s.replace("import { APP_VERSION, BUILD_DETAILS, BUILD_LABEL } from '/app/lib/build'", "import { APP_VERSION, BUILD_DETAILS } from '/app/lib/build'")
mark="""  function setSidebarCollapsed(collapsed: boolean) {
    sidebarCollapsed = collapsed
    localStorage.setItem('machina-sidebar-collapsed', collapsed ? '1' : '0')
  }
"""
s=s.replace(mark,mark+"""

  const toggleChatOptions = () => window.dispatchEvent(new Event('togglechatoptions'))
  const togglePromptToggles = () => window.dispatchEvent(new Event('toggleprompttoggles'))
""",1)
old="""      <span class=\"text-sm font-semibold tracking-wide text-white\">Machina</span>
      <span
        class=\"ml-auto rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-violet-200\"
        data-testid=\"build-version\"
        title={BUILD_DETAILS}>{BUILD_LABEL}</span
      >
"""
new="""      <span class=\"text-sm font-semibold tracking-wide text-white\">Machina</span>
      {#if route.name === 'chat'}
        <div class=\"ml-auto flex items-center gap-1\">
          <button class=\"icon-button\" type=\"button\" aria-label={i18n.t('Prompt toggles')} title={i18n.t('Prompt toggles')} onclick={togglePromptToggles}><SlidersHorizontal size={18} /></button>
          <button class=\"icon-button\" type=\"button\" aria-label={i18n.t('Chat options')} title={i18n.t('Chat options')} onclick={toggleChatOptions}><Settings2 size={18} /></button>
        </div>
      {/if}
"""
if old not in s: raise SystemExit('mobile header marker missing')
p.write_text(s.replace(old,new,1))

p=Path('app/src/routes/Chat.svelte'); s=p.read_text()
s=s.replace('    ScrollText,\n    Send,', '    ScrollText,\n    Send,\n    SlidersHorizontal,')
s=s.replace("<svelte:window\n  onkeydown={(event) => {", "<svelte:window\n  ontogglechatoptions={() => (mobileHeaderOpen = !mobileHeaderOpen)}\n  onkeydown={(event) => {")
start=s.index('  <button\n    class="absolute right-2 top-2 z-20'); end=s.index('\n\n  <header',start); s=s[:start]+s[end+2:]
needle="""    <button
      class=\"icon-button text-neutral-500 hover:text-neutral-200\"
      class:text-violet-400={showSummary}
"""
add="""    <button class=\"icon-button text-neutral-500 hover:text-neutral-200\" type=\"button\" aria-label={i18n.t('Prompt toggles')} title={i18n.t('Prompt toggles')} onclick={() => window.dispatchEvent(new Event('toggleprompttoggles'))}><SlidersHorizontal size={17} /></button>
    <button class=\"icon-button text-neutral-500 hover:text-neutral-200\" class:text-violet-400={mobileHeaderOpen} type=\"button\" aria-label={i18n.t('Chat options')} title={i18n.t('Chat options')} aria-expanded={mobileHeaderOpen} onclick={() => (mobileHeaderOpen = !mobileHeaderOpen)}><Settings2 size={17} /></button>
"""
if needle not in s: raise SystemExit('desktop header marker missing')
s=s.replace(needle,add+needle,1)
s=s.replace('id="mobile-chat-controls"\n      data-testid="mobile-chat-controls"\n      class="absolute right-2 top-12 z-30 grid w-[min(20rem,calc(100vw-1rem))] gap-2 rounded-xl border border-neutral-700/80 bg-[#0d1118]/95 p-2 shadow-2xl backdrop-blur sm:hidden"','id="chat-controls"\n      data-testid="chat-controls"\n      class="absolute right-2 top-2 z-30 grid w-[min(20rem,calc(100vw-1rem))] gap-2 rounded-xl border border-neutral-700/80 bg-[#0d1118]/95 p-2 shadow-2xl backdrop-blur sm:top-16"')
p.write_text(s)

p=Path('app/src/shared/RisuTogglePanel.svelte'); s=p.read_text()
s=s.replace("</script>\n\n{#if settingsMode || (route.name === 'chat' && activeConfig && interactiveDefinitions.length)}", "</script>\n\n<svelte:window ontoggleprompttoggles={() => { if (route.name === 'chat' && activeConfig && interactiveDefinitions.length) open = !open }} />\n\n{#if settingsMode}")
s=s.replace("    {settingsMode\n      ? text('Risu toggle setup', 'Risu 토글 설정')\n      : text('Prompt toggles', '프롬프트 토글')}\n    {#if !settingsMode}<span class=\"text-xs text-violet-300\">{interactiveDefinitions.length}</span\n      >{/if}","    {text('Risu toggle setup', 'Risu 토글 설정')}")
s=s.replace('class="fixed bottom-[calc(9.5rem+env(safe-area-inset-bottom))] right-4 z-40 max-h-[calc(100vh-11rem)] w-[min(25rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:right-5"','class="fixed right-2 top-[4.25rem] z-40 max-h-[calc(100vh-5rem)] w-[min(25rem,calc(100vw-1rem))] overflow-y-auto rounded-xl border border-neutral-700 bg-[#10151d] shadow-2xl sm:right-5 sm:top-20"')
p.write_text(s)
