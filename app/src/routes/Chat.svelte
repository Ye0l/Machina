<script lang="ts">
  import { tick } from 'svelte'
  import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    Plus,
    RotateCw,
    Send,
    Square,
    Trash2,
  } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { session } from '/app/lib/session.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { uiSettings } from '/app/lib/ui-settings.svelte'
  import { FONT_FACES } from '/common/types/ui'
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

  let { onBack }: { onBack: () => void } = $props()

  const detail = $derived(chats.detail!)
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

  const authorOf = (message: { characterId?: string; name?: string }) => {
    if (message.name) return message.name
    if (!message.characterId) return session.profile?.handle ?? i18n.t('You')
    return (
      detail.characters.find((character) => character._id === message.characterId)?.name ??
      i18n.t('Bot')
    )
  }

  const characterOf = (characterId?: string) =>
    detail.characters.find((character) => character._id === characterId) ?? detail.character

  const displayMessage = (text: string) =>
    text
      .replace(/\{\{user\}\}/gi, session.profile?.handle || session.user?.username || i18n.t('You'))
      .replace(/\{\{char\}\}/gi, detail.character?.name || detail.chat.name)

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

  $effect(() => {
    chats.messages.length
    chats.partial
    tick().then(() => messageList?.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' }))
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

  const deleteOpenChat = async () => {
    if (
      !window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name: detail.chat.name }))
    )
      return
    await chats.deleteChat()
  }

  const startFreshChat = async () => {
    if (!detail.character || chats.generating) return
    await chats.startNewChat(detail.character)
  }
</script>

<div
  class="flex h-full min-h-0 flex-col"
  style:font-family={chatFont}
  style:font-size={chatFontSize}
>
  <header
    class="flex min-h-16 shrink-0 flex-wrap items-center gap-2 border-b border-neutral-800/80 px-3 py-2 sm:flex-nowrap sm:gap-3 sm:px-5"
  >
    <button
      class="icon-button"
      type="button"
      aria-label={i18n.t('Back to characters')}
      onclick={onBack}
    >
      <ArrowLeft size={19} />
    </button>
    <CharacterAvatar
      name={detail.character?.name ?? detail.chat.name}
      avatar={detail.character?.avatar}
      size="sm"
    />
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-sm font-semibold text-neutral-100 sm:text-base">
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
      class="field order-last h-9 w-full max-w-none py-1 text-xs sm:order-none sm:ml-auto sm:w-auto sm:max-w-[12rem]"
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

  <ol
    bind:this={messageList}
    class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
    aria-live="polite"
  >
    {#each chats.messages as message (message._id)}
      {@const fromUser = !message.characterId}
      {@const character = characterOf(message.characterId)}
      {@const isLast = message._id === chats.messages.at(-1)?._id}
      <li
        class:flex-row-reverse={fromUser}
        class="mx-auto flex w-full {widthClass} items-start gap-3"
      >
        {#if showAvatars}
          {#if fromUser}
            <span
              class="flex shrink-0 items-center justify-center rounded-full bg-neutral-800 font-semibold text-neutral-300"
              style:width={`${avatarPx}px`}
              style:height={`${avatarPx}px`}
              style:font-size={`${Math.max(10, Math.round(avatarPx * 0.35))}px`}
            >
              {(session.profile?.handle || 'Y').slice(0, 1).toUpperCase()}
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
          class="min-w-0 max-w-[88%] sm:max-w-[75%]"
          style:max-width={alternating > 0 ? `${Math.max(40, 88 - alternating)}%` : undefined}
        >
          <span class:text-right={fromUser} class="mb-1 block text-xs text-neutral-500"
            >{authorOf(message)}</span
          >
          <p
            class:bg-violet-600={fromUser}
            class:text-white={fromUser}
            class="whitespace-pre-wrap rounded-2xl bg-[#151a23] px-4 py-3 leading-6 text-neutral-200 {fromUser
              ? 'rounded-tr-md'
              : 'rounded-tl-md'}"
            style:opacity={msgOpacity}
          >
            {displayMessage(message.msg)}
          </p>
          <div class="mt-1 flex min-h-7 items-center gap-1" class:justify-end={fromUser}>
            {#if !fromUser && message.retries?.length}
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
            {#if !fromUser && isLast}
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
          <p
            class="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200"
            style:opacity={msgOpacity}
          >
            {chats.partial}<span class="animate-pulse text-violet-300">▌</span>
          </p>
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
        {#if !chats.generating && chats.messages.length && !chats.messages.at(-1)?.characterId}
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
</div>
