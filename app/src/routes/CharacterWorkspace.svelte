<script lang="ts">
  import { ArrowLeft, BookOpen, Download, Images, MessagesSquare, UserRound } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { chats } from '/app/lib/chats.svelte'
  import { assetUrl } from '/app/lib/config'
  import {
    buildCharacterCard,
    characterToJson,
    downloadBlob,
    type ExportFormat,
  } from '/app/lib/character-port'
  import { i18n } from '/app/lib/i18n.svelte'
  import { isRouterClick, router, routes, type CharacterTab } from '/app/lib/router.svelte'
  import CharacterAvatar from '/app/shared/CharacterAvatar.svelte'
  import CharacterChats from './CharacterChats.svelte'
  import CharacterEditor from './CharacterEditor.svelte'
  import CharacterBook from './CharacterBook.svelte'
  import CharacterAssets from './CharacterAssets.svelte'

  let {
    characterId,
    tab,
    onEditorDirtyChange,
    onCharacterSaved,
  }: {
    characterId: string
    tab: CharacterTab
    onEditorDirtyChange: (dirty: boolean) => void
    onCharacterSaved: (characterId?: string) => void
  } = $props()

  /**
   * Loaded here rather than in each tab: the header needs the name and avatar regardless of
   * which tab is showing, and the book tab needs the whole record.
   */
  let character = $state<AppSchema.Character | null>(null)
  let loading = $state(true)
  let error = $state('')

  async function load() {
    loading = true
    error = ''
    try {
      character = await chats.getCharacter(characterId)
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to load character')
    } finally {
      loading = false
    }
  }

  let exporting = $state(false)

  /**
   * Exports the character as last saved, not the editor's current draft: a card claiming to
   * be a character the server does not have would be misleading. It lives here rather than in
   * the editor because it applies to the character, not to editing it.
   */
  async function exportCharacter(format: ExportFormat | 'card') {
    if (!character || exporting) return
    const subject = character

    exporting = true
    error = ''
    try {
      if (format === 'card') {
        const blob = await buildCharacterCard(
          subject,
          subject.avatar ? assetUrl(subject.avatar) : undefined
        )
        downloadBlob(blob, `${subject.name}.card.png`)
      } else {
        const json = characterToJson(subject, format)
        downloadBlob(new Blob([json], { type: 'application/json' }), `${subject.name}.json`)
      }
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to export character')
    } finally {
      exporting = false
    }
  }

  const link = (path: string) => (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    router.go(path)
  }

  const tabs: Array<{ id: CharacterTab; label: string; icon: typeof UserRound }> = [
    { id: 'chats', label: 'Chats', icon: MessagesSquare },
    { id: 'edit', label: 'Character', icon: UserRound },
    { id: 'book', label: 'Memory book', icon: BookOpen },
    { id: 'assets', label: 'Assets', icon: Images },
  ]

  load()
</script>

<div class="flex h-full min-h-0 flex-col">
  <header
    class="flex min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4 sm:px-6"
  >
    <a
      class="icon-button"
      href={routes.characters()}
      aria-label={i18n.t('Back to characters')}
      onclick={link(routes.characters())}
    >
      <ArrowLeft size={19} />
    </a>
    <CharacterAvatar name={character?.name ?? '?'} avatar={character?.avatar} size="sm" />
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-base font-semibold text-white sm:text-lg">
        {character?.name ?? i18n.t('Character')}
      </h1>
      <p class="hidden truncate text-xs text-neutral-500 sm:block">
        {character?.description || i18n.t('No description')}
      </p>
    </div>
    {#if character}
      <div class="hidden items-center gap-2 sm:flex">
        <Download size={16} class="text-neutral-500" />
        <select
          class="field h-9 w-auto py-1 text-xs"
          aria-label={i18n.t('Export character')}
          disabled={exporting}
          value=""
          onchange={(event) => {
            const select = event.currentTarget
            const format = select.value
            select.value = ''
            if (format) exportCharacter(format as ExportFormat | 'card')
          }}
        >
          <option value="" disabled hidden>{i18n.t('Export')}</option>
          <option value="card">{i18n.t('Tavern card (PNG)')}</option>
          <option value="tavern">{i18n.t('Tavern V2 (JSON)')}</option>
          <option value="native">{i18n.t('Machina (JSON)')}</option>
          <option value="ooba">{i18n.t('TextGen (JSON)')}</option>
        </select>
      </div>
    {/if}
  </header>

  <div class="shrink-0 border-b border-neutral-800/80 px-4 sm:px-6">
    <div
      class="mx-auto flex w-full max-w-4xl gap-1 overflow-x-auto"
      role="tablist"
      aria-label={i18n.t('Character sections')}
    >
      {#each tabs as entry (entry.id)}
        {@const path = routes.character(characterId, entry.id)}
        <a
          class:tab-active={tab === entry.id}
          class="editor-tab shrink-0"
          href={path}
          role="tab"
          aria-selected={tab === entry.id}
          onclick={link(path)}
        >
          <entry.icon size={16} />
          {i18n.t(entry.label)}
        </a>
      {/each}
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto">
    {#if error}
      <div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6">
        <div class="error-banner" role="alert">{error}</div>
      </div>
    {:else if loading}
      <div class="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
          ><span class="sr-only">{i18n.t('Loading')}</span></span
        >
        {i18n.t('Loading character')}
      </div>
    {:else if tab === 'edit'}
      <!-- The editor brings its own header and scroll container. -->
      <CharacterEditor
        {characterId}
        embedded
        onCancel={() => router.go(routes.characters())}
        onSaved={(savedId) => {
          // Saving from inside the workspace stays here and refreshes the header; only a
          // deletion (no id) hands control back to the shell, which leaves for the library.
          if (!savedId) return onCharacterSaved()
          onEditorDirtyChange(false)
          load()
        }}
        onDirtyChange={onEditorDirtyChange}
      />
    {:else}
      <div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
        {#if tab === 'chats'}
          <CharacterChats {characterId} />
        {:else if tab === 'book' && character}
          <CharacterBook
            {character}
            onDirtyChange={onEditorDirtyChange}
            onSaved={(updated) => (character = updated)}
          />
        {:else if tab === 'assets' && character}
          <CharacterAssets {character} onSaved={(updated) => (character = updated)} />
        {/if}
      </div>
    {/if}
  </div>
</div>
