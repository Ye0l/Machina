from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if text.count(old) != 1:
        raise RuntimeError(f"Expected exactly one {label}, found {text.count(old)}")
    return text.replace(old, new, 1)


# Restore the application-wide mobile header that was changed by mistake.
app_shell_path = Path("app/src/shared/AppShell.svelte")
app_shell = app_shell_path.read_text()
app_shell = replace_once(
    app_shell,
    "import { APP_VERSION, BUILD_DETAILS } from '/app/lib/build'",
    "import { APP_VERSION, BUILD_DETAILS, BUILD_LABEL } from '/app/lib/build'",
    "AppShell build import",
)
app_shell = replace_once(
    app_shell,
    '''    <button
      class="fixed left-2 z-30 flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-700/80 bg-[#0d1118]/90 text-neutral-200 shadow-lg backdrop-blur hover:bg-neutral-800 md:hidden"
      style="top: max(0.5rem, env(safe-area-inset-top));"
      type="button"
      data-testid="mobile-menu-trigger"
      aria-label={i18n.t('Open menu')}
      aria-expanded={drawerOpen}
      title={i18n.t('Open menu')}
      onclick={() => (drawerOpen = true)}
    >
      <Menu size={19} />
    </button>''',
    '''    <header
      class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-800/80 bg-[#0d1118] px-3 md:hidden"
    >
      <button
        class="icon-button"
        type="button"
        aria-label={i18n.t('Open menu')}
        aria-expanded={drawerOpen}
        onclick={() => (drawerOpen = true)}
      >
        <Menu size={20} />
      </button>
      <span class="text-sm font-semibold tracking-wide text-white">Agnai</span>
      <span
        class="ml-auto rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-violet-200"
        data-testid="build-version"
        title={BUILD_DETAILS}>{BUILD_LABEL}</span
      >
    </header>''',
    "mistaken floating application menu",
)
app_shell_path.write_text(app_shell)

# Compact only the chat-specific mobile header.
chat_path = Path("app/src/routes/Chat.svelte")
chat = chat_path.read_text()
chat = replace_once(chat, "    Send,\n    Square,", "    Send,\n    Settings2,\n    Square,", "Settings2 import")
chat = replace_once(
    chat,
    "  let summaryDraft = $state('')\n",
    "  let summaryDraft = $state('')\n  let mobileHeaderOpen = $state(false)\n",
    "mobile header state",
)
chat = replace_once(
    chat,
    '''<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && expandedAsset) expandedAsset = null
  }}
/>''',
    '''<svelte:window
  onkeydown={(event) => {
    if (event.key !== 'Escape') return
    if (expandedAsset) expandedAsset = null
    else if (mobileHeaderOpen) mobileHeaderOpen = false
  }}
/>''',
    "Escape handler",
)

header_start = chat.index(
    '  <header\n    class="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800/80 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-5"\n  >'
)
header_end = chat.index("\n\n  {#if showSummary}", header_start)
new_header = '''  <header data-testid="chat-header" class="shrink-0 border-b border-neutral-800/80">
    <div class="flex h-12 items-center gap-2 px-2 sm:h-auto sm:min-h-16 sm:gap-3 sm:px-5 sm:py-2">
      <a
        class="icon-button"
        href={routes.characters()}
        aria-label={i18n.t('Back to characters')}
        onclick={backToCharacters}
      >
        <ArrowLeft size={19} />
      </a>
      <CharacterAvatar
        name={detail.character?.name ?? detail.chat.name}
        avatar={detail.character?.avatar}
        size="sm"
      />
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-sm font-semibold text-neutral-100 sm:text-base">
          {detail.chat.name}
        </h1>
        <p class="hidden truncate text-xs text-neutral-500 sm:block">
          {detail.character?.name ?? i18n.t('Conversation')}
        </p>
      </div>

      <button
        class="icon-button sm:hidden"
        class:text-violet-300={mobileHeaderOpen}
        type="button"
        data-testid="mobile-chat-options"
        aria-label={i18n.t('Chat options')}
        title={i18n.t('Chat options')}
        aria-expanded={mobileHeaderOpen}
        aria-controls="mobile-chat-controls"
        onclick={() => (mobileHeaderOpen = !mobileHeaderOpen)}
      >
        <Settings2 size={18} />
      </button>

      <div class="ml-auto hidden min-w-0 items-center gap-3 sm:flex">
        <button
          class="icon-button"
          type="button"
          aria-label={i18n.t('Start a new chat')}
          title={i18n.t('New chat')}
          disabled={chats.generating || !detail.character}
          onclick={startFreshChat}
        >
          <Plus size={18} />
        </button>
        <select
          class="field h-9 w-auto max-w-[10rem] py-1 text-xs"
          value={personas.selectedId}
          onchange={selectPersona}
          aria-label={i18n.t('Speak as')}
          disabled={chats.generating || personas.loading || !personas.list.length}
        >
          <option value="">{i18n.t('Speak as yourself')}</option>
          {#each personas.list as option (option._id)}
            <option value={option._id}>{option.name}</option>
          {/each}
          {#if !personas.list.length}
            <option value="" disabled>{i18n.t('— add a persona in the sidebar')}</option>
          {/if}
        </select>
        {#if books.books.length}
          <select
            class="field h-9 w-auto max-w-[10rem] py-1 text-xs"
            value={selectedBookId}
            onchange={selectBook}
            aria-label={i18n.t('Memory book')}
            disabled={chats.generating}
          >
            <option value="">{i18n.t('No memory book')}</option>
            {#each bookGroups as group (group.folder)}
              {#if group.folder}
                <optgroup label={group.folder}>
                  {#each group.items as book (book._id)}
                    <option value={book._id}>{book.name}</option>
                  {/each}
                </optgroup>
              {:else}
                {#each group.items as book (book._id)}
                  <option value={book._id}>{book.name}</option>
                {/each}
              {/if}
            {/each}
          </select>
        {/if}
        <select
          class="field h-9 w-auto max-w-[12rem] py-1 text-xs"
          value={selectedPresetId}
          onchange={selectPreset}
          aria-label={i18n.t('Chat preset')}
          disabled={chats.generating || !userPresetOptions.length}
        >
          <option value="" disabled hidden>{i18n.t('Select preset')}</option>
          {#each userPresetOptions as opt (opt.value)}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <button
          class="icon-button text-neutral-500 hover:text-neutral-200"
          class:text-violet-400={showSummary}
          type="button"
          aria-label={i18n.t('Story summary')}
          title={i18n.t('Story summary')}
          aria-pressed={showSummary}
          onclick={toggleSummary}
        >
          <ScrollText size={17} />
        </button>
        <button
          class="icon-button text-neutral-500 hover:text-red-300"
          type="button"
          aria-label={i18n.t('Delete chat')}
          title={i18n.t('Delete chat')}
          disabled={chats.generating}
          onclick={deleteOpenChat}
        >
          <Trash2 size={17} />
        </button>
      </div>
    </div>

    {#if mobileHeaderOpen}
      <div
        id="mobile-chat-controls"
        data-testid="mobile-chat-controls"
        class="grid gap-2 border-t border-neutral-800/80 bg-[#0d1118] px-3 py-2 sm:hidden"
      >
        <select
          class="field h-9 w-full max-w-none py-1 text-xs"
          value={personas.selectedId}
          onchange={selectPersona}
          aria-label={i18n.t('Speak as')}
          disabled={chats.generating || personas.loading || !personas.list.length}
        >
          <option value="">{i18n.t('Speak as yourself')}</option>
          {#each personas.list as option (option._id)}
            <option value={option._id}>{option.name}</option>
          {/each}
          {#if !personas.list.length}
            <option value="" disabled>{i18n.t('— add a persona in the sidebar')}</option>
          {/if}
        </select>
        {#if books.books.length}
          <select
            class="field h-9 w-full max-w-none py-1 text-xs"
            value={selectedBookId}
            onchange={selectBook}
            aria-label={i18n.t('Memory book')}
            disabled={chats.generating}
          >
            <option value="">{i18n.t('No memory book')}</option>
            {#each bookGroups as group (group.folder)}
              {#if group.folder}
                <optgroup label={group.folder}>
                  {#each group.items as book (book._id)}
                    <option value={book._id}>{book.name}</option>
                  {/each}
                </optgroup>
              {:else}
                {#each group.items as book (book._id)}
                  <option value={book._id}>{book.name}</option>
                {/each}
              {/if}
            {/each}
          </select>
        {/if}
        <select
          class="field h-9 w-full max-w-none py-1 text-xs"
          value={selectedPresetId}
          onchange={selectPreset}
          aria-label={i18n.t('Chat preset')}
          disabled={chats.generating || !userPresetOptions.length}
        >
          <option value="" disabled hidden>{i18n.t('Select preset')}</option>
          {#each userPresetOptions as opt (opt.value)}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <div class="flex items-center justify-end gap-1">
          <button
            class="icon-button"
            type="button"
            aria-label={i18n.t('Start a new chat')}
            title={i18n.t('New chat')}
            disabled={chats.generating || !detail.character}
            onclick={startFreshChat}
          >
            <Plus size={18} />
          </button>
          <button
            class="icon-button text-neutral-500 hover:text-neutral-200"
            class:text-violet-400={showSummary}
            type="button"
            aria-label={i18n.t('Story summary')}
            title={i18n.t('Story summary')}
            aria-pressed={showSummary}
            onclick={() => {
              toggleSummary()
              mobileHeaderOpen = false
            }}
          >
            <ScrollText size={17} />
          </button>
          <button
            class="icon-button text-neutral-500 hover:text-red-300"
            type="button"
            aria-label={i18n.t('Delete chat')}
            title={i18n.t('Delete chat')}
            disabled={chats.generating}
            onclick={deleteOpenChat}
          >
            <Trash2 size={17} />
          </button>
        </div>
      </div>
    {/if}
  </header>'''
chat = chat[:header_start] + new_header + chat[header_end:]
chat_path.write_text(chat)

# Remove the mistaken AppShell regression test and add a chat-header-specific mobile test.
mobile_test_path = Path("app/tests/e2e/mobile.spec.ts")
mobile_test = mobile_test_path.read_text()
old_wrong_test = '''  test('uses a floating menu button instead of reserving header height', async ({ app }) => {
    await app.goto('/')
    await app.waitForSelector('h2:text-is("Aria")')

    const trigger = app.getByTestId('mobile-menu-trigger')
    await expect(trigger).toBeVisible()

    const triggerBox = await trigger.boundingBox()
    const mainBox = await app.locator('main').boundingBox()
    expect(triggerBox?.height).toBeLessThanOrEqual(40)
    expect(mainBox?.y).toBe(0)
    expect(mainBox?.height).toBe(app.viewportSize()?.height)
  })

'''
mobile_test = replace_once(mobile_test, old_wrong_test, "", "mistaken mobile AppShell test")
chat_test = '''  test('keeps the mobile chat header compact until options are opened', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()

    const header = app.getByTestId('chat-header')
    const box = await header.boundingBox()
    expect(box?.height).toBeLessThanOrEqual(52)
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(0)

    await app.getByTestId('mobile-chat-options').click()
    await expect(app.getByTestId('mobile-chat-controls')).toBeVisible()
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(1)
  })

'''
anchor = "  test('no view scrolls the page horizontally', async ({ app }) => {\n"
mobile_test = replace_once(mobile_test, anchor, chat_test + anchor, "mobile overflow test anchor")
mobile_test_path.write_text(mobile_test)

package_path = Path("package.json")
package = package_path.read_text()
package = replace_once(package, '"version": "1.0.28"', '"version": "1.0.29"', "package version")
package_path.write_text(package)
