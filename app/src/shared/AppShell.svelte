<script lang="ts">
  import { Menu } from '@lucide/svelte'
  import { fade, fly } from 'svelte/transition'
  import { chats } from '/app/lib/chats.svelte'
  import { books } from '/app/lib/books.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { router, routes } from '/app/lib/router.svelte'
  import CharacterEditor from '/app/routes/CharacterEditor.svelte'
  import CharacterWorkspace from '/app/routes/CharacterWorkspace.svelte'
  import Characters from '/app/routes/Characters.svelte'
  import Books from '/app/routes/Books.svelte'
  import BookEditor from '/app/routes/BookEditor.svelte'
  import Settings from '/app/routes/Settings.svelte'
  import Chat from '/app/routes/Chat.svelte'
  import Sidebar from './Sidebar.svelte'

  let {
    onEditorDirtyChange,
    onCharacterSaved,
    onBookSaved,
    onLogout,
  }: {
    onEditorDirtyChange: (dirty: boolean) => void
    onCharacterSaved: (characterId?: string) => void
    onBookSaved: () => void
    onLogout: () => void
  } = $props()

  // Loaded here rather than in Characters: any route can now be the entry point, and the
  // sidebar's recent chats must be present even when the library was never opened.
  chats.loadCharacters()
  // Books back the chat's memory-book picker, so they are needed outside their own route.
  books.load()

  let drawerOpen = $state(false)
  const route = $derived(router.route)
  /** Transition key; an editor is a state of its section, not a section of its own. */
  const current = $derived(
    route.name === 'character' || route.name === 'character-new'
      ? 'characters'
      : route.name === 'book'
      ? 'books'
      : route.name
  )

  function navigate(path: string) {
    drawerOpen = false
    router.go(path)
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (drawerOpen = false)} />

<div class="flex h-full min-h-0 bg-background">
  <aside class="hidden h-full w-[17rem] shrink-0 border-r border-neutral-800/80 md:block">
    <Sidebar onClose={() => (drawerOpen = false)} onNavigate={navigate} {onLogout} />
  </aside>

  <div class="flex min-w-0 flex-1 flex-col">
    <header
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
    </header>

    <main class="min-h-0 min-w-0 flex-1 overflow-hidden">
      {#key current}
        <div class="view-enter h-full min-h-0">
          {#if route.name === 'chat'}
            <!-- A deep-linked chat is still loading until App's route effect resolves it. -->
            {#if chats.detail?.chat._id === route.chatId}
              <Chat />
            {:else}
              <div class="flex h-full items-center justify-center gap-2 text-sm text-neutral-500">
                <span
                  class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
                  ><span class="sr-only">{i18n.t('Loading')}</span></span
                >
                {i18n.t('Loading chat')}
              </div>
            {/if}
          {:else if route.name === 'character-new'}
            <CharacterEditor
              characterId={null}
              onCancel={() => router.go(routes.characters())}
              onSaved={onCharacterSaved}
              onDirtyChange={onEditorDirtyChange}
            />
          {:else if route.name === 'character'}
            {#key route.characterId}
              <CharacterWorkspace
                characterId={route.characterId}
                tab={route.tab}
                {onEditorDirtyChange}
                {onCharacterSaved}
              />
            {/key}
          {:else if route.name === 'book'}
            {#key route.bookId}
              <BookEditor
                bookId={route.bookId}
                onCancel={() => router.go(routes.books())}
                onSaved={onBookSaved}
                onDirtyChange={onEditorDirtyChange}
              />
            {/key}
          {:else if route.name === 'books'}
            <Books />
          {:else if route.name === 'settings'}
            <Settings tab={route.tab} onTabChange={(tab) => router.replace(routes.settings(tab))} />
          {:else}
            <Characters />
          {/if}
        </div>
      {/key}
    </main>
  </div>
</div>

{#if drawerOpen}
  <button
    class="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px] md:hidden"
    type="button"
    aria-label={i18n.t('Close menu')}
    transition:fade={{ duration: 140 }}
    onclick={() => (drawerOpen = false)}><span class="sr-only">{i18n.t('Close menu')}</span></button
  >
  <aside
    class="fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] border-r border-neutral-700/80 shadow-2xl md:hidden"
    transition:fly={{ x: -28, duration: 190 }}
  >
    <Sidebar onClose={() => (drawerOpen = false)} onNavigate={navigate} {onLogout} />
  </aside>
{/if}
