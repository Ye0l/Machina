<script lang="ts">
  import { Menu } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import CharacterEditor from '/app/routes/CharacterEditor.svelte'
  import Characters from '/app/routes/Characters.svelte'
  import Chat from '/app/routes/Chat.svelte'
  import Sidebar from './Sidebar.svelte'

  let {
    editorId,
    onShowCharacters,
    onNewCharacter,
    onEditCharacter,
    onOpenChat,
  }: {
    editorId: string | null | undefined
    onShowCharacters: () => void
    onNewCharacter: () => void
    onEditCharacter: (characterId: string) => void
    onOpenChat: (chatId: string) => void
  } = $props()

  let drawerOpen = $state(false)
  const current = $derived(chats.detail ? 'chat' : editorId === undefined ? 'characters' : 'editor')

  function navigate(action: () => void) {
    drawerOpen = false
    action()
  }
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && (drawerOpen = false)} />

<div class="flex h-full min-h-0 bg-background">
  <aside class="hidden h-full w-[17rem] shrink-0 border-r border-neutral-800/80 md:block">
    <Sidebar
      {current}
      onClose={() => (drawerOpen = false)}
      onShowCharacters={() => navigate(onShowCharacters)}
      onNewCharacter={() => navigate(onNewCharacter)}
      onOpenChat={(id) => navigate(() => onOpenChat(id))}
    />
  </aside>

  <div class="flex min-w-0 flex-1 flex-col">
    <header
      class="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-800/80 bg-[#0d1118] px-3 md:hidden"
    >
      <button
        class="icon-button"
        type="button"
        aria-label="Open menu"
        aria-expanded={drawerOpen}
        onclick={() => (drawerOpen = true)}
      >
        <Menu size={20} />
      </button>
      <span class="text-sm font-semibold tracking-wide text-white">Agnai</span>
    </header>

    <main class="min-h-0 min-w-0 flex-1 overflow-hidden">
      {#if chats.detail}
        <Chat onBack={onShowCharacters} />
      {:else if editorId !== undefined}
        {#key editorId}
          <CharacterEditor
            characterId={editorId}
            onCancel={onShowCharacters}
            onSaved={onShowCharacters}
          />
        {/key}
      {:else}
        <Characters onCreate={onNewCharacter} onEdit={onEditCharacter} />
      {/if}
    </main>
  </div>
</div>

{#if drawerOpen}
  <button
    class="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px] md:hidden"
    type="button"
    aria-label="Close menu"
    onclick={() => (drawerOpen = false)}><span class="sr-only">Close menu</span></button
  >
  <aside
    class="fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] border-r border-neutral-700/80 shadow-2xl md:hidden"
  >
    <Sidebar
      {current}
      onClose={() => (drawerOpen = false)}
      onShowCharacters={() => navigate(onShowCharacters)}
      onNewCharacter={() => navigate(onNewCharacter)}
      onOpenChat={(id) => navigate(() => onOpenChat(id))}
    />
  </aside>
{/if}
