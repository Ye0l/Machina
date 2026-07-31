<script lang="ts">
  import { tick } from 'svelte'
  import { ArrowLeft, Send } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { session } from '/app/lib/session.svelte'
  import CharacterAvatar from '/app/shared/CharacterAvatar.svelte'

  let { onBack }: { onBack: () => void } = $props()

  const detail = $derived(chats.detail!)
  let draft = $state('')
  let messageList: HTMLOListElement

  const authorOf = (message: { characterId?: string; name?: string }) => {
    if (message.name) return message.name
    if (!message.characterId) return session.profile?.handle ?? 'You'
    return (
      detail.characters.find((character) => character._id === message.characterId)?.name ?? 'Bot'
    )
  }

  const characterOf = (characterId?: string) =>
    detail.characters.find((character) => character._id === characterId) ?? detail.character

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
</script>

<div class="flex h-full min-h-0 flex-col">
  <header
    class="flex min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-3 sm:px-5"
  >
    <button class="icon-button" type="button" aria-label="Back to characters" onclick={onBack}>
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
      <p class="truncate text-xs text-neutral-500">{detail.character?.name ?? 'Conversation'}</p>
    </div>
  </header>

  <ol
    bind:this={messageList}
    class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
    aria-live="polite"
  >
    {#each chats.messages as message (message._id)}
      {@const fromUser = !message.characterId}
      {@const character = characterOf(message.characterId)}
      <li class:flex-row-reverse={fromUser} class="mx-auto flex w-full max-w-3xl items-start gap-3">
        {#if fromUser}
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs font-semibold text-neutral-300"
          >
            {(session.profile?.handle || 'Y').slice(0, 1).toUpperCase()}
          </span>
        {:else}
          <CharacterAvatar
            name={character?.name ?? authorOf(message)}
            avatar={character?.avatar}
            size="sm"
          />
        {/if}
        <div class:max-w-[85%]={fromUser} class="min-w-0 max-w-[88%] sm:max-w-[75%]">
          <span class:text-right={fromUser} class="mb-1 block text-xs text-neutral-500"
            >{authorOf(message)}</span
          >
          <p
            class:bg-violet-600={fromUser}
            class:text-white={fromUser}
            class="whitespace-pre-wrap rounded-2xl bg-[#151a23] px-4 py-3 text-sm leading-6 text-neutral-200 {fromUser
              ? 'rounded-tr-md'
              : 'rounded-tl-md'}"
          >
            {message.msg}
          </p>
        </div>
      </li>
    {:else}
      <li class="flex h-full min-h-48 items-center justify-center text-sm text-neutral-500">
        Send a message to begin the conversation.
      </li>
    {/each}

    {#if chats.generating}
      <li class="mx-auto flex w-full max-w-3xl items-start gap-3" data-testid="streaming">
        <CharacterAvatar
          name={detail.character?.name ?? 'Bot'}
          avatar={detail.character?.avatar}
          size="sm"
        />
        <div class="min-w-0 max-w-[88%] sm:max-w-[75%]">
          <span class="mb-1 block text-xs text-neutral-500">{detail.character?.name ?? 'Bot'}</span>
          <p
            class="whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 text-sm leading-6 text-neutral-200"
          >
            {chats.partial}<span class="animate-pulse text-violet-300">▌</span>
          </p>
        </div>
      </li>
    {/if}
  </ol>

  {#if chats.error}
    <div class="mx-auto w-full max-w-3xl px-4 pb-2 sm:px-6">
      <div class="error-banner" role="alert">{chats.error}</div>
    </div>
  {/if}

  <div
    class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5"
  >
    <form class="mx-auto flex w-full max-w-3xl items-end gap-2" onsubmit={submit}>
      <!-- prettier-ignore -->
      <textarea
        class="field max-h-36 min-h-11 flex-1 resize-none py-2.5 leading-5"
        placeholder="Send a message"
        rows="1"
        bind:value={draft}
        disabled={chats.generating}
        onkeydown={handleComposerKeydown}
      ></textarea>
      <button
        class="button-primary h-11 w-11 shrink-0 justify-center px-0"
        type="submit"
        aria-label="Send message"
        disabled={chats.generating || !draft.trim()}
      >
        <Send size={18} />
      </button>
    </form>
  </div>
</div>
