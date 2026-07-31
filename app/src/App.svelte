<script lang="ts">
  import { boot, session } from '/app/lib/session.svelte'
  import { chats } from '/app/lib/chats.svelte'
  import AppShell from '/app/shared/AppShell.svelte'
  import Login from '/app/routes/Login.svelte'

  let ready = $state(boot())
  let editorId = $state<string | null | undefined>(undefined)

  function showCharacters() {
    chats.close()
    editorId = undefined
  }

  function showEditor(characterId: string | null = null) {
    chats.close()
    editorId = characterId
  }

  function openChat(chatId: string) {
    editorId = undefined
    chats.openChat(chatId)
  }
</script>

{#await ready}
  <main class="flex h-full items-center justify-center text-sm text-neutral-400">Loading...</main>
{:then}
  {#if session.bootError}
    <main class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p class="text-sm text-red-300">{session.bootError}</p>
      <button class="button-secondary" onclick={() => (ready = boot())}>Retry</button>
    </main>
  {:else if !session.authed}
    <Login />
  {:else}
    <AppShell
      {editorId}
      onShowCharacters={showCharacters}
      onNewCharacter={() => showEditor()}
      onEditCharacter={(id) => showEditor(id)}
      onOpenChat={openChat}
    />
  {/if}
{/await}
