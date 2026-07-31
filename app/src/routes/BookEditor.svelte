<script lang="ts">
  import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, Trash2, X } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { emptyEntry } from '/common/memory'
  import { books, type BookDraft } from '/app/lib/books.svelte'
  import { i18n } from '/app/lib/i18n.svelte'

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
  /**
   * Whole entry objects are kept, not just the fields below: the server replaces `entries`
   * wholesale, so per-entry V2 fields (`id`, `comment`, `secondaryKeys`) would be destroyed
   * if they were not sent back.
   */
  let entries = $state<AppSchema.MemoryEntry[]>([])
  let keywordDrafts = $state<string[]>([])
  let openEntry = $state<number | null>(null)

  let loading = $state(false)
  let saving = $state(false)
  let error = $state('')
  let nameError = $state('')
  let notFound = $state(false)

  const snapshot = () => JSON.stringify({ name, description, entries })
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
      keywordDrafts = ['']
      openEntry = 0
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
      entries = (book.entries ?? []).map((entry) => ({ ...entry }))
      keywordDrafts = entries.map(() => '')
      initialSnapshot = snapshot()
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to load memory book')
    } finally {
      loading = false
    }
  }

  const addEntry = () => {
    entries = [...entries, emptyEntry()]
    keywordDrafts = [...keywordDrafts, '']
    openEntry = entries.length - 1
  }

  const removeEntry = (index: number) => {
    entries = entries.filter((_, i) => i !== index)
    keywordDrafts = keywordDrafts.filter((_, i) => i !== index)
    if (openEntry === index) openEntry = null
    else if (openEntry !== null && openEntry > index) openEntry -= 1
  }

  const moveEntry = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= entries.length) return
    const next = [...entries]
    ;[next[index], next[target]] = [next[target], next[index]]
    entries = next
    if (openEntry === index) openEntry = target
    else if (openEntry === target) openEntry = index
  }

  const addKeyword = (index: number) => {
    const value = keywordDrafts[index]?.trim()
    if (!value) return
    // Keywords are matched case-insensitively; storing duplicates would only waste budget.
    const existing = entries[index].keywords.map((keyword) => keyword.toLowerCase())
    if (!existing.includes(value.toLowerCase())) {
      entries[index].keywords = [...entries[index].keywords, value]
    }
    keywordDrafts[index] = ''
  }

  const onKeywordKeydown = (event: KeyboardEvent, index: number) => {
    if (event.key !== 'Enter' && event.key !== ',') return
    event.preventDefault()
    addKeyword(index)
  }

  const removeKeyword = (index: number, keyword: string) => {
    entries[index].keywords = entries[index].keywords.filter((item) => item !== keyword)
  }

  const num = (value: string, fallback: number) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    nameError = name.trim() ? '' : i18n.t('Enter a book name.')
    if (nameError) return

    // An entry with no keywords can never trigger, so it is dropped rather than saved dead.
    const usable = entries.filter((entry) => entry.keywords.length > 0 && entry.entry.trim())
    if (!usable.length) {
      error = i18n.t('Add at least one entry with a keyword and some text.')
      return
    }

    saving = true
    error = ''

    const draft: BookDraft = { name: name.trim(), description: description.trim(), entries: usable }

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
        </div>

        <div class="mt-7 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-neutral-200">
            {i18n.t('Entries')}
            <span class="ml-1 tabular-nums text-neutral-500">({entries.length})</span>
          </h2>
          <button class="button-secondary h-9 px-3 text-xs" type="button" onclick={addEntry}>
            <Plus size={15} />
            {i18n.t('Add entry')}
          </button>
        </div>

        <ul class="mt-3 space-y-2">
          {#each entries as entry, index (index)}
            <li class="rounded-xl border border-neutral-800 bg-[#10141c]">
              <div class="flex items-center gap-2 p-3">
                <input
                  class="h-4 w-4 shrink-0 accent-violet-500"
                  type="checkbox"
                  bind:checked={entry.enabled}
                  aria-label={i18n.t('Enable entry')}
                />
                <button
                  class="min-w-0 flex-1 text-left"
                  type="button"
                  aria-expanded={openEntry === index}
                  onclick={() => (openEntry = openEntry === index ? null : index)}
                >
                  <span class="block truncate text-sm font-medium text-neutral-100">
                    {entry.name || i18n.t('Untitled entry')}
                  </span>
                  <span class="mt-0.5 block truncate text-xs text-neutral-500">
                    {entry.keywords.length
                      ? entry.keywords.join(', ')
                      : i18n.t('No keywords — this entry can never trigger')}
                  </span>
                </button>
                <button
                  class="icon-button h-8 w-8 shrink-0"
                  type="button"
                  aria-label={i18n.t('Move entry up')}
                  disabled={index === 0}
                  onclick={() => moveEntry(index, -1)}
                >
                  <ChevronUp size={15} />
                </button>
                <button
                  class="icon-button h-8 w-8 shrink-0"
                  type="button"
                  aria-label={i18n.t('Move entry down')}
                  disabled={index === entries.length - 1}
                  onclick={() => moveEntry(index, 1)}
                >
                  <ChevronDown size={15} />
                </button>
                <button
                  class="icon-button h-8 w-8 shrink-0 text-neutral-600 hover:text-red-300"
                  type="button"
                  aria-label={i18n.t('Delete entry')}
                  onclick={() => removeEntry(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {#if openEntry === index}
                <div class="space-y-4 border-t border-neutral-800/80 p-3">
                  <label class="field-group">
                    <span class="field-label">{i18n.t('Entry name')}</span>
                    <input
                      class="field"
                      bind:value={entry.name}
                      maxlength="80"
                      placeholder={i18n.t('For your reference only')}
                      autocomplete="off"
                    />
                  </label>

                  <div class="field-group">
                    <span class="field-label">{i18n.t('Keywords')}</span>
                    <div
                      class="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-700 bg-[#0f131a] px-2 py-2"
                    >
                      {#each entry.keywords as keyword (keyword)}
                        <span
                          class="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-200"
                        >
                          {keyword}
                          <button
                            class="text-violet-300/70 hover:text-white"
                            type="button"
                            aria-label={i18n.t('Remove {name}', { name: keyword })}
                            onclick={() => removeKeyword(index, keyword)}><X size={12} /></button
                          >
                        </span>
                      {/each}
                      <input
                        class="min-w-[8rem] flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                        bind:value={keywordDrafts[index]}
                        placeholder={i18n.t('Add keyword…')}
                        autocomplete="off"
                        onkeydown={(event) => onKeywordKeydown(event, index)}
                        onblur={() => addKeyword(index)}
                      />
                    </div>
                    <span class="field-hint"
                      >{i18n.t('Press Enter or comma to add. Matching is case-insensitive.')}</span
                    >
                  </div>

                  <label class="field-group">
                    <span class="field-label">{i18n.t('Entry text')}</span>
                    <!-- prettier-ignore -->
                    <textarea
                      class="field min-h-24 resize-y"
                      bind:value={entry.entry}
                      placeholder={i18n.t('Text injected into the prompt when a keyword matches')}
                    ></textarea>
                  </label>

                  <div class="grid gap-4 sm:grid-cols-2">
                    <label class="field-group">
                      <span class="field-label">{i18n.t('Priority')}</span>
                      <input
                        class="field"
                        type="number"
                        value={entry.priority}
                        oninput={(event) =>
                          (entry.priority = num(event.currentTarget.value, entry.priority))}
                      />
                      <span class="field-hint"
                        >{i18n.t(
                          'Lowest priority is dropped first when the budget is tight.'
                        )}</span
                      >
                    </label>
                    <label class="field-group">
                      <span class="field-label">{i18n.t('Weight')}</span>
                      <input
                        class="field"
                        type="number"
                        value={entry.weight}
                        oninput={(event) =>
                          (entry.weight = num(event.currentTarget.value, entry.weight))}
                      />
                      <span class="field-hint"
                        >{i18n.t('Highest weight is placed last, nearest the reply.')}</span
                      >
                    </label>
                  </div>
                </div>
              {/if}
            </li>
          {/each}
        </ul>

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
