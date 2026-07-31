<script lang="ts">
  import { LogOut, MessageCircle, Plus, Sparkles, Users, X } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { session } from '/app/lib/session.svelte'

  let {
    current,
    onClose,
    onShowCharacters,
    onNewCharacter,
    onOpenChat,
  }: {
    current: 'characters' | 'editor' | 'chat'
    onClose: () => void
    onShowCharacters: () => void
    onNewCharacter: () => void
    onOpenChat: (chatId: string) => void
  } = $props()

  const recentChats = $derived(chats.chats.slice(0, 8))
</script>

<div class="flex h-full min-h-0 flex-col bg-[#0d1118]">
  <div class="flex h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4">
    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
      <Sparkles size={18} strokeWidth={2.2} />
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold tracking-wide text-white">Agnai</p>
      <p class="truncate text-xs text-neutral-500">Character workspace</p>
    </div>
    <button class="icon-button md:hidden" type="button" aria-label="Close menu" onclick={onClose}>
      <X size={19} />
    </button>
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
    <button class="button-primary w-full justify-center" type="button" onclick={onNewCharacter}>
      <Plus size={17} />
      New character
    </button>

    <nav class="space-y-1" aria-label="Primary navigation">
      <button
        class:nav-active={current === 'characters' || current === 'editor'}
        class="nav-item"
        type="button"
        onclick={onShowCharacters}
      >
        <Users size={18} />
        Characters
      </button>
    </nav>

    <section class="min-h-0">
      <div class="mb-2 flex items-center justify-between px-2">
        <h2 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          Recent chats
        </h2>
        <span class="text-xs tabular-nums text-neutral-600">{chats.chats.length}</span>
      </div>

      <div class="space-y-1">
        {#each recentChats as chat (chat._id)}
          <button
            class:nav-active={current === 'chat' && chats.detail?.chat._id === chat._id}
            class="nav-item"
            type="button"
            onclick={() => onOpenChat(chat._id)}
          >
            <MessageCircle size={17} />
            <span class="truncate">{chat.name}</span>
          </button>
        {:else}
          <p class="px-2 py-3 text-xs leading-5 text-neutral-600">Your recent chats appear here.</p>
        {/each}
      </div>
    </section>
  </div>

  <div class="flex shrink-0 items-center gap-3 border-t border-neutral-800/80 p-3">
    <span
      class="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-800 text-sm font-semibold text-neutral-300"
    >
      {(session.profile?.handle || session.user?.username || '?').slice(0, 1).toUpperCase()}
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-neutral-200">
        {session.profile?.handle || session.user?.username}
      </p>
      <p class="truncate text-xs text-neutral-500">@{session.user?.username}</p>
    </div>
    <button
      class="icon-button"
      type="button"
      aria-label="Sign out"
      onclick={() => session.logout()}
    >
      <LogOut size={18} />
    </button>
  </div>
</div>
