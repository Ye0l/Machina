<script lang="ts">
  import { LogOut, MessageCircle, Plus, Settings, Sparkles, Users, X } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { session } from '/app/lib/session.svelte'
  import { isRouterClick, router, routes } from '/app/lib/router.svelte'

  let {
    onClose,
    onNavigate,
    onLogout,
  }: {
    onClose: () => void
    onNavigate: (path: string) => void
    onLogout: () => void
  } = $props()

  const route = $derived(router.route)
  const inLibrary = $derived(route.name === 'characters' || route.name === 'character')
  const openChatId = $derived(route.name === 'chat' ? route.chatId : undefined)
  const recentChats = $derived(chats.chats.slice(0, 8))

  /**
   * Nav entries are real anchors so the URL is visible on hover and modified clicks open a
   * new tab; plain clicks are handled in-app.
   */
  const link = (path: string) => (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    onNavigate(path)
  }
</script>

<div class="flex h-full min-h-0 flex-col bg-[#0d1118]">
  <div class="flex h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4">
    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white">
      <Sparkles size={18} strokeWidth={2.2} />
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold tracking-wide text-white">Agnai</p>
      <p class="truncate text-xs text-neutral-500">{i18n.t('Character workspace')}</p>
    </div>
    <button
      class="icon-button md:hidden"
      type="button"
      aria-label={i18n.t('Close menu')}
      onclick={onClose}
    >
      <X size={19} />
    </button>
  </div>

  <div class="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
    <a
      class="button-primary w-full justify-center"
      href={routes.newCharacter()}
      onclick={link(routes.newCharacter())}
    >
      <Plus size={17} />
      {i18n.t('New character')}
    </a>

    <nav class="space-y-1" aria-label="Primary navigation">
      <a
        class:nav-active={inLibrary}
        class="nav-item"
        href={routes.characters()}
        aria-current={inLibrary ? 'page' : undefined}
        onclick={link(routes.characters())}
      >
        <Users size={18} />
        {i18n.t('Characters')}
      </a>
      <a
        class:nav-active={route.name === 'settings'}
        class="nav-item"
        href={routes.settings()}
        aria-current={route.name === 'settings' ? 'page' : undefined}
        onclick={link(routes.settings())}
      >
        <Settings size={18} />
        {i18n.t('AI settings')}
      </a>
    </nav>

    <section class="min-h-0">
      <div class="mb-2 flex items-center justify-between px-2">
        <h2 class="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
          {i18n.t('Recent chats')}
        </h2>
        <span class="text-xs tabular-nums text-neutral-600">{chats.chats.length}</span>
      </div>

      <div class="space-y-1">
        {#each recentChats as chat (chat._id)}
          <a
            class:nav-active={openChatId === chat._id}
            class="nav-item"
            href={routes.chat(chat._id)}
            aria-current={openChatId === chat._id ? 'page' : undefined}
            onclick={link(routes.chat(chat._id))}
          >
            <MessageCircle size={17} />
            <span class="truncate">{chat.name}</span>
          </a>
        {:else}
          <p class="px-2 py-3 text-xs leading-5 text-neutral-600">
            {i18n.t('Your recent chats appear here.')}
          </p>
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
    <button class="icon-button" type="button" aria-label={i18n.t('Sign out')} onclick={onLogout}>
      <LogOut size={18} />
    </button>
  </div>
</div>
