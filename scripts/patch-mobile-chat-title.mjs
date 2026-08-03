import { readFileSync, writeFileSync } from 'node:fs'

const chatPath = 'app/src/routes/Chat.svelte'
let chat = readFileSync(chatPath, 'utf8')

chat = chat.replace(
  '  class="flex h-full min-h-0 flex-col"\n',
  '  data-testid="chat-view"\n  class="relative flex h-full min-h-0 flex-col"\n'
)

const headerStart = chat.indexOf('  <header data-testid="chat-header"')
const headerEnd = chat.indexOf('\n\n  {#if showSummary}', headerStart)
if (headerStart < 0 || headerEnd < 0) throw new Error('Could not locate chat header block')

const replacement = `  <button
    class="absolute right-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-700/80 bg-[#0d1118]/90 text-neutral-200 shadow-lg backdrop-blur hover:bg-neutral-800 sm:hidden"
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

  <header
    data-testid="desktop-chat-header"
    class="hidden min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-5 py-2 sm:flex"
  >
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
      <h1 class="truncate text-base font-semibold text-neutral-100">
        {detail.chat.name}
      </h1>
      <p class="truncate text-xs text-neutral-500">
        {detail.character?.name ?? i18n.t('Conversation')}
      </p>
    </div>
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
  </header>

  {#if mobileHeaderOpen}
    <div
      id="mobile-chat-controls"
      data-testid="mobile-chat-controls"
      class="absolute right-2 top-12 z-30 grid w-[min(20rem,calc(100vw-1rem))] gap-2 rounded-xl border border-neutral-700/80 bg-[#0d1118]/95 p-2 shadow-2xl backdrop-blur sm:hidden"
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
        <a
          class="icon-button mr-auto"
          href={routes.characters()}
          aria-label={i18n.t('Back to characters')}
          title={i18n.t('Back to characters')}
          onclick={backToCharacters}
        >
          <ArrowLeft size={18} />
        </a>
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
  {/if}`

chat = chat.slice(0, headerStart) + replacement + chat.slice(headerEnd)
writeFileSync(chatPath, chat)

const testPath = 'app/tests/e2e/mobile.spec.ts'
let tests = readFileSync(testPath, 'utf8')
const testStart = tests.indexOf("  test('keeps the mobile chat header compact until options are opened'")
const testEnd = tests.indexOf("\n\n  test('no view scrolls the page horizontally'", testStart)
if (testStart < 0 || testEnd < 0) throw new Error('Could not locate mobile chat header test')
const newTest = `  test('does not reserve space for a mobile chat title header', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await expect(app.getByText('Greetings from Aria.')).toBeVisible()

    await expect(app.getByTestId('desktop-chat-header')).not.toBeVisible()
    await expect(app.getByTestId('mobile-chat-options')).toBeVisible()
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(0)

    const chatBox = await app.getByTestId('chat-view').boundingBox()
    const messagesBox = await app.locator('ol[aria-live="polite"]').boundingBox()
    expect(messagesBox?.y).toBe(chatBox?.y)

    await app.getByTestId('mobile-chat-options').click()
    await expect(app.getByTestId('mobile-chat-controls')).toBeVisible()
    await expect(app.locator('select[aria-label="Speak as"]:visible')).toHaveCount(1)

    const expandedMessagesBox = await app.locator('ol[aria-live="polite"]').boundingBox()
    expect(expandedMessagesBox?.y).toBe(messagesBox?.y)
    expect(expandedMessagesBox?.height).toBe(messagesBox?.height)
  })`
tests = tests.slice(0, testStart) + newTest + tests.slice(testEnd)
writeFileSync(testPath, tests)

const packagePath = 'package.json'
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
pkg.version = '1.0.30'
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
