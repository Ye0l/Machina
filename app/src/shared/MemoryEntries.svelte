<script lang="ts">
  import { untrack } from 'svelte'
  import { ChevronDown, ChevronUp, Plus, Trash2, X } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { emptyEntry } from '/common/memory'
  import { i18n } from '/app/lib/i18n.svelte'

  /**
   * The entry list editor, shared by the standalone book editor and a character's own book.
   *
   * `entries` is bound rather than copied: both owners keep whole entry objects so per-entry
   * V2 fields (`id`, `comment`, `secondaryKeys`) survive a save, and this component only ever
   * edits the fields it shows.
   */
  let { entries = $bindable() }: { entries: AppSchema.MemoryEntry[] } = $props()

  let keywordDrafts = $state<string[]>([])

  /*
   * A draft that starts as a single blank entry opens expanded: it is the create case, and a
   * collapsed empty row offers nothing to fill in. Anything else starts collapsed so a long
   * book is scannable.
   */
  let openEntry = $state<number | null>(
    untrack(() => (entries.length === 1 && !entries[0]?.keywords.length ? 0 : null))
  )

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
</script>

<div class="flex items-center justify-between">
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
                >{i18n.t('Lowest priority is dropped first when the budget is tight.')}</span
              >
            </label>
            <label class="field-group">
              <span class="field-label">{i18n.t('Weight')}</span>
              <input
                class="field"
                type="number"
                value={entry.weight}
                oninput={(event) => (entry.weight = num(event.currentTarget.value, entry.weight))}
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
