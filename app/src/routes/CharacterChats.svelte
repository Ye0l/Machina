<script lang="ts">
  import { MessageCircle, Plus, Trash2 } from '@lucide/svelte'
  import type { ChatSummary } from '/app/lib/contracts'
  import { chats } from '/app/lib/chats.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { isRouterClick, router, routes } from '/app/lib/router.svelte'

  let { characterId }: { characterId: string } = $props()

  /**
   * The endpoint has no paging, so the whole list arrives at once and only a window of it is
   * put in the DOM. A sentinel at the end of the window grows it as it scrolls into view,
   * which is what keeps a character with hundreds of chats responsive.
   */
  const PAGE = 20

  let all = $state<ChatSummary[]>([])
  let shown = $state(PAGE)
  let loading = $state(true)
  let error = $state('')
  let sentinel = $state<HTMLElement>()

  const visible = $derived(all.slice(0, shown))
  const hasMore = $derived(shown < all.length)

  async function load() {
    loading = true
    error = ''
    try {
      all = await chats.listForCharacter(characterId)
      shown = PAGE
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to load chats')
    } finally {
      loading = false
    }
  }

  $effect(() => {
    const node = sentinel
    if (!node) return

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        shown = Math.min(shown + PAGE, all.length)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  })

  const link = (path: string) => (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    router.go(path)
  }

  const startChat = async () => {
    const character = chats.characters.find((item) => item._id === characterId)
    if (!character) return
    const chatId = await chats.startNewChat(character)
    if (chatId) router.go(routes.chat(chatId))
  }

  const removeChat = async (chat: ChatSummary) => {
    if (!window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name: chat.name })))
      return

    try {
      await chats.deleteChatById(chat._id)
      all = all.filter((item) => item._id !== chat._id)
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to delete chat')
    }
  }

  const when = (value?: string) => (value ? new Date(value).toLocaleString() : '')

  load()
</script>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h2 class="text-sm font-semibold text-neutral-200">
      {i18n.t('Chats')}
      {#if all.length}
        <span class="ml-1 tabular-nums text-neutral-500">({all.length})</span>
      {/if}
    </h2>
    <button class="button-secondary h-9 px-3 text-xs" type="button" onclick={startChat}>
      <Plus size={15} />
      {i18n.t('New chat')}
    </button>
  </div>

  {#if error}
    <div class="error-banner" role="alert">{error}</div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
      <span
        class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
        ><span class="sr-only">{i18n.t('Loading')}</span></span
      >
      {i18n.t('Loading chats')}
    </div>
  {:else if !all.length}
    <div class="rounded-xl border border-neutral-800 bg-[#10141c] px-4 py-10 text-center">
      <p class="text-sm text-neutral-400">{i18n.t('No chats with this character yet.')}</p>
      <button class="button-primary mt-4" type="button" onclick={startChat}>
        <Plus size={16} />
        {i18n.t('Start a chat')}
      </button>
    </div>
  {:else}
    <ul class="space-y-2">
      {#each visible as chat (chat._id)}
        <li
          class="flex min-w-0 items-center gap-3 rounded-xl border border-neutral-800 bg-[#10141c] p-3 transition hover:border-neutral-700 hover:bg-[#131822]"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-300"
          >
            <MessageCircle size={17} />
          </span>
          <a
            class="min-w-0 flex-1"
            href={routes.chat(chat._id)}
            onclick={link(routes.chat(chat._id))}
          >
            <span class="block truncate text-sm font-medium text-neutral-100">{chat.name}</span>
            <span class="mt-0.5 block truncate text-xs text-neutral-500"
              >{when(chat.updatedAt)}</span
            >
          </a>
          <button
            class="icon-button h-8 w-8 shrink-0 text-neutral-600 hover:text-red-300"
            type="button"
            aria-label={i18n.t('Delete chat')}
            onclick={() => removeChat(chat)}
          >
            <Trash2 size={15} />
          </button>
        </li>
      {/each}
    </ul>

    {#if hasMore}
      <!-- Grows the window when scrolled to; not a network request. -->
      <div bind:this={sentinel} class="py-4 text-center text-xs text-neutral-600">
        {i18n.t('{shown} of {total}', { shown: visible.length, total: all.length })}
      </div>
    {/if}
  {/if}
</div>
