<script lang="ts">
  import { boot, session } from '/app/lib/session.svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import AppShell from '/app/shared/AppShell.svelte'
  import Login from '/app/routes/Login.svelte'

  let ready = $state(boot())
  let editorId = $state<string | null | undefined>(undefined)
  let view = $state<'characters' | 'settings'>('characters')
  let editorDirty = $state(false)

  function leaveEditor() {
    if (editorId === undefined || !editorDirty) return true
    return window.confirm(i18n.t('Discard your unsaved character changes?'))
  }

  function showCharacters() {
    if (!leaveEditor()) return
    chats.close()
    editorDirty = false
    editorId = undefined
    view = 'characters'
  }

  function showSettings() {
    if (!leaveEditor()) return
    chats.close()
    editorDirty = false
    editorId = undefined
    view = 'settings'
  }

  function showEditor(characterId: string | null = null) {
    if (!leaveEditor()) return
    chats.close()
    editorDirty = false
    editorId = characterId
    view = 'characters'
  }

  function openChat(chatId: string) {
    if (!leaveEditor()) return
    editorDirty = false
    editorId = undefined
    view = 'characters'
    chats.openChat(chatId)
  }

  function savedCharacter() {
    editorDirty = false
    showCharacters()
  }

  function logout() {
    if (!leaveEditor()) return
    session.logout()
  }
</script>

{#await ready}
  <main class="flex h-full items-center justify-center text-sm text-neutral-400">
    {i18n.t('Loading...')}
  </main>
{:then}
  {#if session.bootError}
    <main class="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p class="text-sm text-red-300">{session.bootError}</p>
      <button class="button-secondary" onclick={() => (ready = boot())}>{i18n.t('Retry')}</button>
    </main>
  {:else if !session.authed}
    <Login />
  {:else}
    <AppShell
      {editorId}
      {view}
      onShowSettings={showSettings}
      onEditorDirtyChange={(dirty) => (editorDirty = dirty)}
      onCharacterSaved={savedCharacter}
      onLogout={logout}
      onShowCharacters={showCharacters}
      onNewCharacter={() => showEditor()}
      onEditCharacter={(id) => showEditor(id)}
      onOpenChat={openChat}
    />
  {/if}
{/await}
