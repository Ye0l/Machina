<script lang="ts">
  import { chats } from '/app/lib/chats.svelte'
  import { session } from '/app/lib/session.svelte'

  const detail = $derived(chats.detail!)

  let draft = $state('')

  const authorOf = (message: { characterId?: string; name?: string }) => {
    if (message.name) return message.name
    if (!message.characterId) return session.profile?.handle ?? 'You'
    return detail.characters.find((c) => c._id === message.characterId)?.name ?? 'Bot'
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || chats.generating) return
    draft = ''
    chats.send(text)
  }
</script>

<div class="mx-auto flex h-full w-full max-w-3xl flex-col">
  <header class="flex items-center gap-3 border-b border-neutral-800 p-4">
    <button class="text-sm text-neutral-400 underline" onclick={() => chats.close()}>Back</button>
    <h1 class="font-semibold">{detail.chat.name}</h1>
  </header>

  <ol class="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
    {#each chats.messages as message (message._id)}
      <li class="flex flex-col gap-1">
        <span class="text-xs uppercase tracking-wide text-neutral-500">{authorOf(message)}</span>
        <p class="whitespace-pre-wrap text-sm">{message.msg}</p>
      </li>
    {:else}
      <li class="text-sm text-neutral-400">No messages yet.</li>
    {/each}

    {#if chats.generating}
      <li class="flex flex-col gap-1" data-testid="streaming">
        <span class="text-xs uppercase tracking-wide text-neutral-500">
          {detail.character?.name ?? 'Bot'}
        </span>
        <p class="whitespace-pre-wrap text-sm text-neutral-300">
          {chats.partial}<span class="animate-pulse">▌</span>
        </p>
      </li>
    {/if}
  </ol>

  {#if chats.error}
    <p class="mx-4 rounded bg-red-950 px-3 py-2 text-sm text-red-300">{chats.error}</p>
  {/if}

  <form class="flex gap-2 border-t border-neutral-800 p-4" onsubmit={submit}>
    <input
      class="flex-1 rounded border border-neutral-700 bg-background-lighter px-3 py-2 outline-none focus:border-neutral-500"
      placeholder="Send a message"
      bind:value={draft}
      disabled={chats.generating}
    />
    <button
      class="rounded bg-purple-700 px-4 py-2 font-medium disabled:opacity-50"
      type="submit"
      disabled={chats.generating || !draft.trim()}
    >
      Send
    </button>
  </form>
</div>
