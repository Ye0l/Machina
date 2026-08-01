<script lang="ts">
  import { MessageCircle, Pencil, Plus, Search, Upload, Users } from '@lucide/svelte'
  import { chats } from '/app/lib/chats.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { isRouterClick, router, routes } from '/app/lib/router.svelte'
  import { IMPORT_ACCEPT, parseCharacterFile } from '/app/lib/character-port'
  import { pendingImport } from '/app/lib/pending-import'
  import type { CharacterSummary } from '/app/lib/contracts'
  import CharacterAvatar from '/app/shared/CharacterAvatar.svelte'

  let query = $state('')
  let importInput = $state<HTMLInputElement>()
  let importError = $state('')

  /**
   * Imports route to the editor instead of creating the character outright, so the user
   * reviews the card before it is saved.
   */
  const importFile = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    // Reset first: picking the same file twice must still fire a change event.
    input.value = ''
    if (!file) return

    importError = ''
    try {
      pendingImport.set(await parseCharacterFile(file))
      router.go(routes.newCharacter())
    } catch (ex) {
      importError = i18n.t('Could not import {name}: {reason}', {
        name: file.name,
        reason: ex instanceof Error ? ex.message : String(ex),
      })
    }
  }

  const link = (path: string) => (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    router.go(path)
  }

  /**
   * The chat id is only known after the server resolves or creates the chat, so this stays
   * a button rather than an anchor. Navigation is what opens the chat.
   */
  const openCharacter = async (character: CharacterSummary) => {
    const chatId = await chats.resolveChatFor(character)
    if (chatId) router.go(routes.chat(chatId))
  }
  const filteredCharacters = $derived(
    chats.characters.filter((character) => {
      const search = query.trim().toLowerCase()
      if (!search) return true
      return `${character.name} ${character.description ?? ''} ${character.folder ?? ''} ${(
        character.tags ?? []
      ).join(' ')}`
        .toLowerCase()
        .includes(search)
    })
  )
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto">
  <div class="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 sm:px-6 sm:py-7">
    <header
      class="flex flex-col gap-4 border-b border-neutral-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
          {i18n.t('Library')}
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-white">{i18n.t('Characters')}</h1>
        <p class="mt-1 text-sm text-neutral-500">
          {i18n.t('Create a character, shape their prompt, and start chatting.')}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2 self-start sm:self-auto">
        <input
          bind:this={importInput}
          class="hidden"
          type="file"
          accept={IMPORT_ACCEPT}
          onchange={importFile}
        />
        <button class="button-secondary" type="button" onclick={() => importInput?.click()}>
          <Upload size={17} />
          {i18n.t('Import')}
        </button>
        <a
          class="button-primary"
          href={routes.newCharacter()}
          onclick={link(routes.newCharacter())}
        >
          <Plus size={17} />
          {i18n.t('New character')}
        </a>
      </div>
    </header>

    <div class="mt-5 flex items-center gap-3">
      <label class="relative block w-full max-w-md">
        <span class="sr-only">{i18n.t('Search characters')}</span>
        <Search
          class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
          size={17}
        />
        <input
          class="field h-10 pl-9"
          placeholder={i18n.t('Search characters')}
          bind:value={query}
        />
      </label>
      <span class="hidden text-sm tabular-nums text-neutral-500 sm:inline">
        {filteredCharacters.length}
        {filteredCharacters.length === 1 ? i18n.t('character') : i18n.t('characters')}
      </span>
    </div>

    {#if importError}
      <div class="error-banner mt-4" role="alert">{importError}</div>
    {/if}

    {#if chats.error}
      <div class="error-banner mt-4" role="alert">{chats.error}</div>
    {/if}

    {#if chats.loading && !chats.characters.length}
      <div class="mt-12 flex items-center justify-center gap-2 text-sm text-neutral-500">
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
          ><span class="sr-only">{i18n.t('Loading')}</span></span
        >
        {i18n.t('Loading characters')}
      </div>
    {:else if !chats.characters.length}
      <div
        class="mt-12 flex flex-col items-center border-y border-neutral-800/80 py-12 text-center"
      >
        <span
          class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-500"
        >
          <Users size={22} />
        </span>
        <h2 class="font-medium text-neutral-200">{i18n.t('No characters yet')}</h2>
        <p class="mt-1 max-w-sm text-sm text-neutral-500">
          {i18n.t('Create your first character and define how they speak.')}
        </p>
        <a
          class="button-secondary mt-5"
          href={routes.newCharacter()}
          onclick={link(routes.newCharacter())}
        >
          <Plus size={17} />
          {i18n.t('Create character')}
        </a>
      </div>
    {:else if !filteredCharacters.length}
      <p class="mt-12 text-center text-sm text-neutral-500">
        {i18n.t('No characters match “{query}”.', { query })}
      </p>
    {:else}
      <ul class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {#each filteredCharacters as character (character._id)}
          <li
            class="group flex min-w-0 items-center gap-3 rounded-xl border border-neutral-800 bg-[#10141c] p-3 transition hover:border-neutral-700 hover:bg-[#131822]"
          >
            <CharacterAvatar name={character.name} avatar={character.avatar} size="lg" />
            <div class="min-w-0 flex-1">
              <h2 class="truncate font-medium text-neutral-100">{character.name}</h2>
              <p class="mt-1 truncate text-sm text-neutral-500">
                {character.description || i18n.t('No description yet')}
              </p>
              {#if character.folder || character.tags?.length}
                <div class="mt-2 flex min-w-0 flex-wrap gap-1.5">
                  {#if character.folder}
                    <span class="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-400"
                      >{character.folder}</span
                    >
                  {/if}
                  {#each character.tags?.slice(0, 3) ?? [] as tag}
                    <span
                      class="max-w-28 truncate rounded bg-violet-500/10 px-1.5 py-0.5 text-[11px] text-violet-300"
                      >#{tag}</span
                    >
                  {/each}
                </div>
              {/if}
            </div>
            <div class="flex shrink-0 items-center gap-1">
              <a
                class="icon-button"
                href={routes.character(character._id, 'edit')}
                aria-label={i18n.t('Edit {name}', { name: character.name })}
                title={i18n.t('Edit character')}
                onclick={link(routes.character(character._id, 'edit'))}
              >
                <Pencil size={17} />
              </a>
              <button
                class="icon-button text-violet-300 hover:bg-violet-500/10 hover:text-violet-200"
                type="button"
                aria-label={i18n.t('Chat with {name}', { name: character.name })}
                title={i18n.t('Open chat')}
                onclick={() => openCharacter(character)}
              >
                <MessageCircle size={18} />
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
