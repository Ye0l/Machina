<script lang="ts">
  import { untrack } from 'svelte'
  import { boot, session } from '/app/lib/session.svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { router, routes } from '/app/lib/router.svelte'
  import { uiSettings } from '/app/lib/ui-settings.svelte'
  import { normalizeAppTheme } from '/common/types/ui'
  import AppShell from '/app/shared/AppShell.svelte'
  import Login from '/app/routes/Login.svelte'

  let ready = $state(boot())
  let editorDirty = $state(false)

  $effect(() => {
    const ui = uiSettings.settings
    const mode = ui.mode === 'light' ? 'light' : 'dark'
    const root = document.documentElement
    root.dataset.theme = normalizeAppTheme(ui.theme)
    root.dataset.mode = mode
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
  })

  /** Routes that own an editor with unsaved-change protection. */
  const isEditorRoute = (name: string) =>
    name === 'character' || name === 'character-new' || name === 'book'

  // Set once: App is the root component and is never torn down.
  router.guard = () => {
    if (!isEditorRoute(router.route.name) || !editorDirty) return true
    return window.confirm(i18n.t('Discard your unsaved changes?'))
  }

  /**
   * The open chat follows the URL, so `/chat/:id` works on a reload or a shared link and
   * not just on an in-app click.
   *
   * `chats.detail` is read untracked: this effect must run on navigation only, otherwise
   * loading a chat would re-trigger it.
   */
  $effect(() => {
    const route = router.route

    if (!isEditorRoute(route.name)) editorDirty = false

    if (route.name !== 'chat') {
      chats.close()
      return
    }

    const chatId = route.chatId
    if (untrack(() => chats.detail?.chat._id) === chatId) return

    chats.openChat(chatId).then(() => {
      // Drop a load that a newer navigation has already superseded.
      const current = router.route
      if (current.name !== 'chat' || current.chatId !== chatId) return
      // A chat that could not be loaded (deleted, or not ours) must not keep its URL.
      if (chats.detail?.chat._id !== chatId) router.replace(routes.characters())
    })
  })

  function logout() {
    if (!router.canLeave()) return
    editorDirty = false
    session.logout()
    router.replace(routes.characters())
  }

  function savedCharacter(characterId?: string) {
    // Clear first: the save already persisted the changes, so leaving must not prompt.
    editorDirty = false
    // A newly created character opens its own workspace; a deletion has nowhere to go.
    router.go(characterId ? routes.character(characterId) : routes.characters())
  }

  function savedPersona() {
    editorDirty = false
    router.go(routes.personas())
  }

  function savedBook() {
    editorDirty = false
    router.go(routes.books())
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
      onEditorDirtyChange={(dirty) => (editorDirty = dirty)}
      onCharacterSaved={savedCharacter}
      onBookSaved={savedBook}
      onPersonaSaved={savedPersona}
      onLogout={logout}
    />
  {/if}
{/await}
