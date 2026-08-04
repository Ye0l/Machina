<script lang="ts">
  import { tick } from 'svelte'
  import {
    ArrowLeft,
    Bug,
    Check,
    ChevronLeft,
    ChevronRight,
    Pencil,
    Plus,
    RotateCw,
    ScrollText,
    Send,
    Settings2,
    Square,
    Trash2,
    X,
  } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { books } from '/app/lib/books.svelte'
  import { personas } from '/app/lib/personas.svelte'
  import { session } from '/app/lib/session.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { isRouterClick, router, routes } from '/app/lib/router.svelte'
  import { renderMarkdown } from '/app/lib/markdown'
  import {
    readGenerationSummary,
    type GenerationRequestDebug,
    type GenerationSummary,
  } from '/app/lib/generation-debug'
  import { applyPresetDisplayRegex } from '/common/display-regex'
  import { ASSET_TAG_PATTERN, findAsset } from '/common/assets'
  import { groupByFolder } from '/common/folders'
  import {
    SUMMARY_CATEGORIES,
    SUMMARY_CATEGORY_LABELS,
    type SummaryCategory,
  } from '/common/summary'
  import { assetUrl } from '/app/lib/config'
  import { uiSettings } from '/app/lib/ui-settings.svelte'
  import { isScrollAtBottom, shouldFollowScroll } from '/app/lib/scroll-follow'
  import { FONT_FACES } from '/common/types/ui'
  import type { AppSchema } from '/common/types'
  import CharacterAvatar from '/app/shared/CharacterAvatar.svelte'

  const AVATAR_PX: Record<string, number> = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 56,
    '2xl': 64,
    '3xl': 80,
    max3xl: 96,
  }

  const detail = $derived(chats.detail!)
  const activePreset = $derived(
    session.presets.find((preset) => preset._id === detail.chat.genPreset)
  )
  const ui = $derived(uiSettings.settings)
  const showAvatars = $derived(ui.chatAvatarMode !== false && ui.avatarSize !== 'hide')
  const avatarPx = $derived(
    ui.avatarSize === 'custom'
      ? Math.max(16, ui.customAvatarWidth ?? 40)
      : AVATAR_PX[ui.avatarSize ?? 'md'] ?? 40
  )
  const chatFont = $derived(
    FONT_FACES[ui.font ?? 'default'].face === 'unset'
      ? undefined
      : FONT_FACES[ui.font ?? 'default'].face
  )
  const chatFontSize = $derived(`${ui.fontSize ?? 14}px`)
  const msgOpacity = $derived(ui.msgOpacity ?? 0.8)
  /** Percentage of the content width surrendered by alternating messages. */
  const alternating = $derived(ui.chatAlternating ?? 0)
  const widthClass = $derived(
    ui.chatWidth === 'narrow'
      ? 'max-w-2xl'
      : ui.chatWidth === 'xl'
      ? 'max-w-5xl'
      : ui.chatWidth === '2xl'
      ? 'max-w-6xl'
      : ui.chatWidth === '3xl'
      ? 'max-w-7xl'
      : ui.chatWidth === 'fill'
      ? 'max-w-none'
      : 'max-w-3xl'
  )
  let draft = $state('')
  let messageList: HTMLOListElement
  let wasAtBottom = true
  let expandedAsset = $state<{ name: string; src: string } | null>(null)
  let generationDebug = $state<{
    summary: GenerationSummary
    request?: GenerationRequestDebug
  } | null>(null)

  /** `userId` marks the sender, not `characterId`: an impersonated message carries both. */
  const fromUser = (message: AppSchema.ChatMessage) => !!message.userId

  const authorOf = (message: AppSchema.ChatMessage) => {
    if (message.name) return message.name
    if (fromUser(message))
      return personas.selected?.name ?? session.profile?.handle ?? i18n.t('You')
    return (
      detail.characters.find((character) => character._id === message.characterId)?.name ??
      detail.character?.name ??
      i18n.t('Bot')
    )
  }

  const characterOf = (characterId?: string) =>
    detail.characters.find((character) => character._id === characterId) ?? detail.character

  /**
   * `{{char}}` resolves to the character that actually sent the message rather than the
   * chat's headline character, and `{{user}}` to the active persona when there is one --
   * matching what `common/prompt.ts` puts in the prompt.
   */
  const displayMessage = (
    text: string,
    speaker?: AppSchema.Character,
    transformBotOutput = false
  ) => {
    const resolved = text
      .replace(
        /\{\{user\}\}/gi,
        personas.selected?.name ||
          session.profile?.handle ||
          session.user?.username ||
          i18n.t('You')
      )
      .replace(/\{\{char\}\}/gi, speaker?.name || detail.character?.name || detail.chat.name)

    return transformBotOutput ? applyPresetDisplayRegex(resolved, activePreset) : resolved
  }

  type RenderedBodyPart =
    | { kind: 'text'; html: string }
    | { kind: 'literal'; text: string }
    | { kind: 'asset'; name: string; src: string }

  /**
   * Asset tags are split out before Markdown rendering and become native Svelte image nodes.
   * RisuAI treats additional assets as media blocks rather than raw HTML inside Markdown;
   * doing the same also prevents Showdown/DOMPurify from swallowing or rewriting the image.
   */
  const renderBody = (
    text: string,
    speaker?: AppSchema.Character,
    transformBotOutput = false
  ): RenderedBodyPart[] => {
    const displayed = displayMessage(text, speaker, transformBotOutput)
    const pattern = new RegExp(ASSET_TAG_PATTERN.source, ASSET_TAG_PATTERN.flags)
    const parts: RenderedBodyPart[] = []
    let cursor = 0

    const pushText = (value: string) => {
      if (value) parts.push({ kind: 'text', html: renderMarkdown(value) })
    }

    for (const match of displayed.matchAll(pattern)) {
      const index = match.index ?? 0
      pushText(displayed.slice(cursor, index))

      const name = (match[1] ?? '').trim()
      const asset = findAsset(speaker?.assets, name)
      if (asset) parts.push({ kind: 'asset', name, src: assetUrl(asset.uri) })
      else parts.push({ kind: 'literal', text: match[0] })

      cursor = index + match[0].length
    }

    pushText(displayed.slice(cursor))
    return parts.length ? parts : [{ kind: 'text', html: renderMarkdown(displayed) }]
  }

  /* ------------------------------------------------------------------- editing */

  let editingId = $state<string | null>(null)
  let editDraft = $state('')
  let editSaving = $state(false)

  let showSummary = $state(false)
  let summaryTab = $state<SummaryCategory>('plot')
  let summaryDraft = $state('')
  let mobileHeaderOpen = $state(false)

  const activeSummary = $derived(detail?.chat.summaries?.[summaryTab] ?? '')
  const hasAnySummary = $derived(
    SUMMARY_CATEGORIES.some((category) => !!detail?.chat.summaries?.[category]) ||
      !!detail?.chat.summary
  )

  function toggleSummary() {
    if (!showSummary) summaryDraft = activeSummary
    showSummary = !showSummary
  }

  function selectSummaryTab(category: SummaryCategory) {
    summaryTab = category
    summaryDraft = detail?.chat.summaries?.[category] ?? ''
  }

  /** Edits operate on the stored text, not the placeholder-substituted rendering. */
  const startEdit = (messageId: string, text: string) => {
    editingId = messageId
    editDraft = text
  }

  const cancelEdit = () => {
    editingId = null
    editDraft = ''
  }

  const saveEdit = async () => {
    const messageId = editingId
    if (!messageId || editSaving) return

    const text = editDraft.trim()
    if (!text) return

    editSaving = true
    try {
      if (await chats.editMessage(messageId, text)) cancelEdit()
    } finally {
      editSaving = false
    }
  }

  const handleEditKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      saveEdit()
    }
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || chats.generating) return
    draft = ''
    chats.send(text)
  }

  const handleComposerKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
    event.preventDefault()
    event.currentTarget instanceof HTMLTextAreaElement && event.currentTarget.form?.requestSubmit()
  }

  const trackScrollPosition = () => {
    if (messageList) wasAtBottom = isScrollAtBottom(messageList)
  }

  $effect(() => {
    detail.chat._id
    wasAtBottom = true
  })

  $effect(() => {
    chats.messages.length
    chats.partial
    const mode = ui.scrollFollow ?? 'always'
    if (!shouldFollowScroll(mode, wasAtBottom)) return

    tick().then(() => {
      if (!messageList) return
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: chats.partial ? 'auto' : 'smooth',
      })
      wasAtBottom = true
    })
  })

  /** User-created presets for the per-chat preset dropdown. */
  const userPresetOptions = $derived(
    session.presets.map((preset) => ({ value: preset._id, label: preset.name }))
  )
  const selectedPresetId = $derived(
    session.presets.some((preset) => preset._id === detail.chat.genPreset)
      ? detail.chat.genPreset
      : ''
  )

  const selectPreset = (event: Event) =>
    chats.setPreset((event.currentTarget as HTMLSelectElement).value)

  /** Empty value detaches the book, which is why it is a real option and not a placeholder. */
  const selectedBookId = $derived(
    books.books.some((book) => book._id === detail.chat.memoryId) ? detail.chat.memoryId : ''
  )
  const bookGroups = $derived(groupByFolder(books.books, (book) => book.folder))

  const selectBook = (event: Event) =>
    chats.setMemoryBook((event.currentTarget as HTMLSelectElement).value)

  /**
   * Who the user speaks as. Empty means the account profile, so it is a real option rather
   * than a placeholder.
   */
  const selectPersona = (event: Event) =>
    personas.select((event.currentTarget as HTMLSelectElement).value)

  const deleteOpenChat = async () => {
    if (
      !window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name: detail.chat.name }))
    )
      return
    // The deleted id must not stay in the address bar, so leave the route on success.
    if (await chats.deleteChat()) router.replace(routes.characters())
  }

  const startFreshChat = async () => {
    if (!detail.character || chats.generating) return
    const chatId = await chats.startNewChat(detail.character)
    if (chatId) router.go(routes.chat(chatId))
  }

  const backToCharacters = (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    router.go(routes.characters())
  }
</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key !== 'Escape') return
    if (generationDebug) generationDebug = null
    else if (expandedAsset) expandedAsset = null
    else if (mobileHeaderOpen) mobileHeaderOpen = false
  }}
/>

<div
  data-testid="chat-view"
  class="relative flex h-full min-h-0 flex-col"
  style:font-family={chatFont}
  style:font-size={chatFontSize}
>
  <button
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
  {/if}

  {#if showSummary}
    <section class="border-b border-neutral-800/80 bg-neutral-900/40 px-4 py-3">
      <div class="flex flex-col gap-3">
        <div>
          <span class="field-label">{i18n.t('Story summary')}</span>
          <p class="field-hint">
            {i18n.t(
              'Running notes on the messages that have fallen out of the context window. Turn it on and set its budget in the preset settings.'
            )}
            {#if detail.chat.summaryCount}
              {i18n.t('Currently covers {count} messages.', {
                count: String(detail.chat.summaryCount),
              })}
            {/if}
          </p>
        </div>

        <div class="flex gap-1" role="tablist">
          {#each SUMMARY_CATEGORIES as category (category)}
            <button
              class="rounded-lg px-3 py-1.5 text-xs font-medium transition {summaryTab === category
                ? 'bg-violet-500/10 text-violet-200'
                : 'text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-100'}"
              type="button"
              role="tab"
              aria-selected={summaryTab === category}
              onclick={() => selectSummaryTab(category)}
            >
              {i18n.t(SUMMARY_CATEGORY_LABELS[category])}
            </button>
          {/each}
        </div>

        <textarea
          id="chat-summary"
          class="field min-h-32 resize-y text-sm"
          aria-label={i18n.t(SUMMARY_CATEGORY_LABELS[summaryTab])}
          bind:value={summaryDraft}
          placeholder={i18n.t('No notes yet.')}
        />

        <div class="flex items-center gap-2">
          <button
            class="button-primary"
            type="button"
            disabled={summaryDraft === activeSummary}
            onclick={() => chats.setSummary(summaryTab, summaryDraft)}
          >
            {i18n.t('Save')}
          </button>
          <button
            class="button-secondary"
            type="button"
            disabled={!hasAnySummary}
            onclick={async () => {
              await chats.clearSummaries()
              summaryDraft = ''
            }}
          >
            {i18n.t('Clear all')}
          </button>
        </div>
      </div>
    </section>
  {/if}

  <ol
    bind:this={messageList}
    class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
    aria-live="polite"
    data-testid="message-list"
    onscroll={trackScrollPosition}
  >
    {#each chats.messages as message (message._id)}
      {@const isUser = fromUser(message)}
      {@const character = isUser ? undefined : characterOf(message.characterId)}
      {@const generation = isUser ? undefined : readGenerationSummary(message)}
      {@const isLast = message._id === chats.messages.at(-1)?._id}
      <li
        class:flex-row-reverse={isUser}
        class:hidden={chats.rerollingMessageId === message._id}
        class="mx-auto flex w-full {widthClass} items-start gap-3"
      >
        {#if showAvatars}
          {#if isUser}
            <span
              class="flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-semibold text-neutral-300"
              style:width={`${avatarPx}px`}
              style:height={`${avatarPx}px`}
              style:font-size={`${Math.max(10, Math.round(avatarPx * 0.35))}px`}
            >
              {(personas.selected?.name || session.profile?.handle || 'Y')
                .slice(0, 1)
                .toUpperCase()}
            </span>
          {:else}
            <CharacterAvatar
              name={character?.name ?? authorOf(message)}
              avatar={character?.avatar}
              px={avatarPx}
              corners={ui.avatarCorners}
            />
          {/if}
        {/if}
        <div
          class:w-full={editingId === message._id}
          class="min-w-0 max-w-[88%] sm:max-w-[75%]"
          style:max-width={alternating > 0 ? `${Math.max(40, 88 - alternating)}%` : undefined}
        >
          <span class:text-right={isUser} class="mb-1 block text-xs text-neutral-500"
            >{authorOf(message)}</span
          >
          {#if editingId === message._id}
            <div class="rounded-2xl bg-[#151a23] p-2 {isUser ? 'rounded-tr-md' : 'rounded-tl-md'}">
              <!-- prettier-ignore -->
              <textarea
                class="field h-[min(32rem,60vh)] min-h-72 w-full resize-y py-3 leading-6"
                bind:value={editDraft}
                onkeydown={handleEditKeydown}
                aria-label={i18n.t('Edit message')}
              ></textarea>
              <div class="mt-2 flex items-center justify-end gap-2">
                <span class="mr-auto pl-1 text-[11px] text-neutral-500">
                  {i18n.t('Ctrl+Enter to save, Esc to cancel')}
                </span>
                <button
                  class="button-secondary h-8 px-3 text-xs"
                  type="button"
                  onclick={cancelEdit}
                >
                  <X size={14} />
                  {i18n.t('Cancel')}
                </button>
                <button
                  class="button-primary h-8 px-3 text-xs"
                  type="button"
                  onclick={saveEdit}
                  disabled={editSaving || !editDraft.trim()}
                >
                  <Check size={14} />
                  {i18n.t('Save')}
                </button>
              </div>
            </div>
          {:else}
            <div
              class:bg-violet-600={isUser}
              class:text-white={isUser}
              class:ml-auto={isUser}
              class="chat-message-body space-y-2 rounded-2xl bg-[#151a23] px-4 py-3 leading-6 text-neutral-200 {isUser
                ? 'rounded-tr-md'
                : 'rounded-tl-md'}"
              style:opacity={msgOpacity}
            >
              {#each renderBody(message.msg, character, !isUser) as part}
                {#if part.kind === 'asset'}
                  <button
                    class="chat-asset-frame group block w-full max-w-[32rem] overflow-hidden rounded-xl border border-neutral-700/70 bg-black/40"
                    type="button"
                    aria-label={i18n.t('Open image')}
                    onclick={() => (expandedAsset = part)}
                  >
                    <img
                      class="chat-asset block max-h-[70vh] w-full object-contain transition-transform group-hover:scale-[1.01]"
                      src={part.src}
                      alt={part.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                {:else if part.kind === 'literal'}
                  <code
                    class="asset-tag-missing block break-words rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-sm"
                  >
                    {part.text}
                  </code>
                {:else if part.html}
                  <div class="rendered-markdown">
                    <!-- Sanitised in renderMarkdown via DOMPurify. -->
                    {@html part.html}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
          {#if generation}
            <button
              class="mt-1 flex max-w-full items-center gap-1.5 truncate text-[10px] text-neutral-600 transition hover:text-neutral-400"
              type="button"
              data-testid={`generation-debug-${message._id}`}
              aria-label={i18n.t('View generation request')}
              title={i18n.t('View generation request')}
              onclick={() =>
                (generationDebug = {
                  summary: generation,
                  request: chats.generationRequest(message._id),
                })}
            >
              <Bug size={11} />
              <span class="truncate">
                {generation.model} · {i18n.t('{count} tokens', { count: generation.outputTokens })}
                {#if generation.inputTokens !== undefined && generation.contextLimit}
                  · {i18n.t('{used} / {limit} context ({percent}%)', {
                    used: generation.inputTokens.toLocaleString(),
                    limit: generation.contextLimit.toLocaleString(),
                    percent: Math.min(
                      999,
                      Math.round((generation.inputTokens / generation.contextLimit) * 100)
                    ),
                  })}
                {/if}
              </span>
            </button>
          {/if}
          <div class="mt-1 flex min-h-7 items-center gap-1" class:justify-end={isUser}>
            {#if !isUser && message.retries?.length}
              <button
                class="icon-button h-7 w-7"
                type="button"
                aria-label={i18n.t('Previous response')}
                title={i18n.t('Previous response')}
                disabled={chats.generating}
                onclick={() => chats.cycleVariant(message._id, -1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span class="min-w-9 text-center text-[11px] tabular-nums text-neutral-500">
                {(chats.variantPositions[message._id] ?? 0) + 1} / {message.retries.length + 1}
              </span>
              <button
                class="icon-button h-7 w-7"
                type="button"
                aria-label={i18n.t('Next response')}
                title={i18n.t('Next response')}
                disabled={chats.generating}
                onclick={() => chats.cycleVariant(message._id, 1)}
              >
                <ChevronRight size={14} />
              </button>
            {/if}
            {#if !isUser && isLast}
              <button
                class="icon-button h-7 w-7"
                type="button"
                aria-label={i18n.t('Regenerate last response')}
                title={i18n.t('Regenerate last response')}
                disabled={chats.generating}
                onclick={() => chats.retry()}
              >
                <RotateCw size={14} />
              </button>
            {/if}
            <button
              class="icon-button h-7 w-7"
              type="button"
              aria-label={i18n.t('Edit message')}
              title={i18n.t('Edit message')}
              disabled={chats.generating || editingId === message._id}
              onclick={() => startEdit(message._id, message.msg)}
            >
              <Pencil size={14} />
            </button>
            <button
              class="icon-button h-7 w-7 text-neutral-600 hover:text-red-300"
              type="button"
              aria-label={i18n.t('Delete message')}
              title={i18n.t('Delete message')}
              disabled={chats.generating}
              onclick={() => chats.deleteMessage(message._id)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </li>
    {:else}
      <li class="flex h-full min-h-48 items-center justify-center text-sm text-neutral-500">
        {i18n.t('Send a message to begin the conversation.')}
      </li>
    {/each}

    {#if chats.generating}
      <li class="mx-auto flex w-full {widthClass} items-start gap-3" data-testid="streaming">
        {#if showAvatars}
          <CharacterAvatar
            name={detail.character?.name ?? i18n.t('Bot')}
            avatar={detail.character?.avatar}
            px={avatarPx}
            corners={ui.avatarCorners}
          />
        {/if}
        <div class="min-w-0 max-w-[88%] sm:max-w-[75%]">
          <span class="mb-1 block text-xs text-neutral-500"
            >{detail.character?.name ?? i18n.t('Bot')}</span
          >
          <div
            class="chat-message-body space-y-2 rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200"
            style:opacity={msgOpacity}
          >
            {#if ui.streamingOutput !== false}
              {#each renderBody(chats.partial, detail.character, true) as part}
                {#if part.kind === 'asset'}
                  <button
                    class="chat-asset-frame group block w-full max-w-[32rem] overflow-hidden rounded-xl border border-neutral-700/70 bg-black/40"
                    type="button"
                    aria-label={i18n.t('Open image')}
                    onclick={() => (expandedAsset = part)}
                  >
                    <img
                      class="chat-asset block max-h-[70vh] w-full object-contain transition-transform group-hover:scale-[1.01]"
                      src={part.src}
                      alt={part.name}
                      decoding="async"
                    />
                  </button>
                {:else if part.kind === 'literal'}
                  <code
                    class="asset-tag-missing block break-words rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-sm"
                  >
                    {part.text}
                  </code>
                {:else if part.html}
                  <div class="rendered-markdown">
                    {@html part.html}
                  </div>
                {/if}
              {/each}
              <span class="animate-pulse text-violet-300">▌</span>
            {:else}
              <span class="text-sm text-neutral-500" data-testid="streaming-hidden">
                {i18n.t('Generating response...')}
              </span>
            {/if}
          </div>
        </div>
      </li>
    {/if}
  </ol>

  {#if chats.error}
    <div class="mx-auto w-full {widthClass} px-4 pb-2 sm:px-6">
      <div class="error-banner" role="alert">{chats.error}</div>
    </div>
  {/if}

  <div
    class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
  >
    <form class="mx-auto flex w-full {widthClass} items-end gap-2" onsubmit={submit}>
      <!-- prettier-ignore -->
      <textarea
        class="field max-h-36 min-h-11 flex-1 resize-none py-2.5 leading-5"
        placeholder={i18n.t('Send a message')}
        rows="1"
        bind:value={draft}
        disabled={chats.generating}
        onkeydown={handleComposerKeydown}
      ></textarea>
      <div class="flex shrink-0 items-center gap-2">
        {#if !chats.generating && chats.messages.length && chats.messages.at(-1)?.userId}
          <button
            class="icon-button h-11 w-11"
            type="button"
            aria-label={i18n.t('Resend last message')}
            title={i18n.t('Resend last message')}
            onclick={() => chats.retry()}
          >
            <RotateCw size={18} />
          </button>
        {/if}
        {#if chats.generating}
          <button
            class="button-secondary h-11 px-4"
            type="button"
            onclick={() => chats.stop()}
            disabled={chats.stopping}
          >
            <Square size={16} fill="currentColor" />
            {i18n.t('Stop')}
          </button>
        {:else}
          <button
            class="button-primary h-11 w-11 justify-center px-0"
            type="submit"
            aria-label={i18n.t('Send message')}
            disabled={!draft.trim()}
          >
            <Send size={18} />
          </button>
        {/if}
      </div>
    </form>
  </div>

  {#if generationDebug}
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-request-title"
    >
      <button
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        type="button"
        aria-label={i18n.t('Close')}
        onclick={() => (generationDebug = null)}
      >
        <span class="sr-only">{i18n.t('Close')}</span>
      </button>
      <section
        class="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#0d1118] shadow-2xl"
      >
        <header class="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <Bug size={17} class="text-violet-300" />
          <div class="min-w-0 flex-1">
            <h2 id="generation-request-title" class="text-sm font-semibold text-neutral-100">
              {i18n.t('Generation request')}
            </h2>
            <p class="truncate text-xs text-neutral-500">
              {generationDebug.summary.model} · {i18n.t('{count} tokens', {
                count: generationDebug.summary.outputTokens,
              })}
              {#if generationDebug.summary.inputTokens !== undefined && generationDebug.summary.contextLimit}
                · {i18n.t('{used} / {limit} context ({percent}%)', {
                  used: generationDebug.summary.inputTokens.toLocaleString(),
                  limit: generationDebug.summary.contextLimit.toLocaleString(),
                  percent: Math.min(
                    999,
                    Math.round(
                      (generationDebug.summary.inputTokens / generationDebug.summary.contextLimit) *
                        100
                    )
                  ),
                })}
              {/if}
            </p>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label={i18n.t('Close')}
            onclick={() => (generationDebug = null)}
          >
            <X size={18} />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-auto p-4">
          {#if generationDebug.request}
            <p class="mb-3 text-xs text-neutral-500">
              {i18n.t(
                'The actual inference payload is shown without account or authentication data.'
              )}
            </p>
            <pre
              class="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-black/30 p-3 font-mono text-xs leading-5 text-neutral-300"
              data-testid="generation-request-body">{JSON.stringify(
                generationDebug.request,
                null,
                2
              )}</pre>
          {:else}
            <p
              class="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-500"
            >
              {i18n.t(
                'Request details are only kept for generations made in this browser session.'
              )}
            </p>
          {/if}
        </div>
      </section>
    </div>
  {/if}

  {#if expandedAsset}
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={expandedAsset.name}
      tabindex="-1"
    >
      <button
        class="absolute inset-0 bg-black/90 backdrop-blur-sm"
        type="button"
        aria-label={i18n.t('Close')}
        onclick={() => (expandedAsset = null)}
      >
        <span class="sr-only">{i18n.t('Close')}</span>
      </button>
      <div class="relative z-10 flex max-h-[94vh] max-w-[94vw] items-center justify-center">
        <button
          class="icon-button absolute right-0 top-0 z-10 h-11 w-11 -translate-y-1/2 translate-x-1/2 bg-black/70 text-white hover:bg-black/90"
          type="button"
          aria-label={i18n.t('Close')}
          onclick={() => (expandedAsset = null)}
        >
          <X size={22} />
        </button>
        <img
          class="max-h-[94vh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
          src={expandedAsset.src}
          alt={expandedAsset.name}
        />
      </div>
    </div>
  {/if}
</div>
