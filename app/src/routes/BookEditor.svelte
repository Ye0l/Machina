<script lang="ts">
  import { ArrowLeft, Save, Trash2 } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { normalizeFolderPath } from '/common/folders'
  import { emptyEntry } from '/common/memory'
  import { books, type BookDraft } from '/app/lib/books.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import MemoryEntries from '/app/shared/MemoryEntries.svelte'

  let {
    bookId,
    onCancel,
    onSaved,
    onDirtyChange = () => {},
  }: {
    bookId: string | null
    onCancel: () => void
    onSaved: (book: AppSchema.MemoryBook) => void
    onDirtyChange?: (dirty: boolean) => void
  } = $props()

  let name = $state('')
  let description = $state('')
  let folder = $state('')
  /**
   * Whole entry objects are kept, not just the fields below: the server replaces `entries`
   * wholesale, so per-entry V2 fields (`id`, `comment`, `secondaryKeys`) would be destroyed
   * if they were not sent back.
   */
  let entries = $state<AppSchema.MemoryEntry[]>([])

  let loading = $state(false)
  let saving = $state(false)
  let error = $state('')
  let nameError = $state('')
  let notFound = $state(false)

  const snapshot = () => JSON.stringify({ name, description, folder, entries })
  let initialSnapshot = $state('')
  const isDirty = $derived(snapshot() !== initialSnapshot)

  $effect(() => {
    onDirtyChange(isDirty)
  })

  function onBeforeUnload(event: BeforeUnloadEvent) {
    if (isDirty) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  $effect(() => {
    window.addEventListener('beforeunload', onBeforeUnload, { capture: true })
    return () => window.removeEventListener('beforeunload', onBeforeUnload, { capture: true })
  })

  async function load() {
    if (!bookId) {
      entries = [emptyEntry()]
      initialSnapshot = snapshot()
      return
    }

    loading = true
    try {
      // The list is the source of truth; there is no per-book GET endpoint.
      await books.load()
      const book = books.get(bookId)
      if (!book) {
        notFound = true
        return
      }
      name = book.name
      description = book.description ?? ''
      folder = book.folder ?? ''
      entries = (book.entries ?? []).map((entry) => ({ ...entry }))
      initialSnapshot = snapshot()
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to load memory book')
    } finally {
      loading = false
    }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    nameError = name.trim() ? '' : i18n.t('Enter a book name.')
    if (nameError) return

    // An entry with no keywords can never trigger unless it is always included, so it is
    // dropped rather than saved dead.
    const usable = entries.filter(
      (entry) => (entry.keywords.length > 0 || entry.constant) && entry.entry.trim()
    )
    if (!usable.length) {
      error = i18n.t('Add at least one entry with a keyword and some text.')
      return
    }

    saving = true
    error = ''

    const draft: BookDraft = {
      name: name.trim(),
      description: description.trim(),
      folder: normalizeFolderPath(folder),
      entries: usable,
    }

    try {
      if (bookId) {
        if (!(await books.update(bookId, draft))) {
          error = books.error
          return
        }
        initialSnapshot = snapshot()
        onSaved(books.get(bookId)!)
      } else {
        const created = await books.create(draft)
        if (!created) {
          error = books.error
          return
        }
        initialSnapshot = snapshot()
        onSaved(created)
      }
    } finally {
      saving = false
    }
  }

  async function removeBook() {
    if (!bookId) return
    if (!window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name }))) return

    saving = true
    try {
      if (await books.remove(bookId)) {
        initialSnapshot = snapshot()
        onCancel()
      } else {
        error = books.error
      }
    } finally {
      saving = false
    }
  }

  load()
</script>

<form class="flex h-full min-h-0 flex-col" onsubmit={submit}>
  <header
    class="flex min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4 sm:px-6"
  >
    <button
      class="icon-button"
      type="button"
      aria-label={i18n.t('Back to memory books')}
      onclick={onCancel}
    >
      <ArrowLeft size={19} />
    </button>
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-base font-semibold text-white sm:text-lg">
        {bookId ? name || i18n.t('Edit book') : i18n.t('New book')}
      </h1>
      <p class="hidden text-xs text-neutral-500 sm:block">
        {i18n.t('Entries are injected when one of their keywords appears in recent messages.')}
      </p>
    </div>
    <button class="button-primary hidden sm:inline-flex" type="submit" disabled={saving || loading}>
      <Save size={17} />
      {saving ? i18n.t('Saving...') : i18n.t('Save book')}
    </button>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
      {#if error}
        <div class="error-banner mb-5" role="alert">{error}</div>
      {/if}

      {#if notFound}
        <p class="py-16 text-center text-sm text-neutral-500">
          {i18n.t('That memory book no longer exists.')}
        </p>
      {:else if loading}
        <div class="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
            ><span class="sr-only">{i18n.t('Loading')}</span></span
          >
          {i18n.t('Loading memory book')}
        </div>
      {:else}
        <div class="grid gap-5 sm:grid-cols-2">
          <label class="field-group">
            <span class="field-label">{i18n.t('Name')} <span class="text-red-400">*</span></span>
            <input
              class="field"
              class:border-red-500={!!nameError}
              bind:value={name}
              maxlength="80"
              placeholder={i18n.t('Book name')}
              autocomplete="off"
              oninput={() => nameError && (nameError = '')}
            />
            {#if nameError}
              <span class="text-xs text-red-400">{nameError}</span>
            {/if}
          </label>
          <label class="field-group">
            <span class="field-label">{i18n.t('Description')}</span>
            <input
              class="field"
              bind:value={description}
              maxlength="200"
              placeholder={i18n.t('What this book covers')}
              autocomplete="off"
            />
          </label>
          <label class="field-group sm:col-span-2">
            <span class="field-label">{i18n.t('Folder')}</span>
            <input
              class="field"
              bind:value={folder}
              maxlength="120"
              placeholder={i18n.t('e.g. World/Locations')}
              autocomplete="off"
            />
            <span class="field-hint">
              {i18n.t('Use slashes to create nested folders.')}
            </span>
          </label>
        </div>

        <div class="mt-7">
          <MemoryEntries bind:entries />
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3 border-t border-neutral-800/80 pt-5">
          <button class="button-primary sm:hidden" type="submit" disabled={saving || loading}>
            <Save size={17} />
            {saving ? i18n.t('Saving...') : i18n.t('Save book')}
          </button>
          {#if bookId}
            <button
              class="button-secondary text-red-300 hover:border-red-800 hover:text-red-200"
              type="button"
              disabled={saving}
              onclick={removeBook}
            >
              <Trash2 size={16} />
              {i18n.t('Delete book')}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</form>
