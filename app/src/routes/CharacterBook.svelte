<script lang="ts">
  import { untrack } from 'svelte'
  import { Save, Trash2 } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { api } from '/app/lib/api'
  import { i18n } from '/app/lib/i18n.svelte'
  import MemoryEntries from '/app/shared/MemoryEntries.svelte'

  /**
   * A character's own memory book (`character.characterBook`).
   *
   * This is a separate slot from the shared books under `/memory`: `common/prompt.ts` pushes
   * the replying character's book *and* the chat's attached book, so a character's own lore
   * applies wherever it speaks, while shared books are attached per chat.
   */
  let {
    character,
    onSaved,
    onDirtyChange = () => {},
  }: {
    character: AppSchema.Character
    onSaved: (character: AppSchema.Character) => void
    onDirtyChange?: (dirty: boolean) => void
  } = $props()

  const clone = (book?: AppSchema.MemoryBook) =>
    (book?.entries ?? []).map((entry) => ({ ...entry }))

  /*
   * Seeded from the prop once, deliberately. The workspace remounts this component per
   * character, and the only other time `character` changes is when this component's own save
   * hands the updated record back -- at which point it has already reseeded the draft. Reacting
   * to the prop would discard in-progress edits instead.
   */
  let entries = $state<AppSchema.MemoryEntry[]>(untrack(() => clone(character.characterBook)))
  let saving = $state(false)
  let error = $state('')
  let message = $state('')

  let initial = $state(untrack(() => JSON.stringify(entries)))
  const isDirty = $derived(JSON.stringify(entries) !== initial)

  $effect(() => {
    onDirtyChange(isDirty)
  })

  async function save() {
    // An entry with no keywords can never trigger unless it is always included, so it is
    // dropped rather than saved dead.
    const usable = entries.filter(
      (entry) => (entry.keywords.length > 0 || entry.constant) && entry.entry.trim()
    )

    saving = true
    error = ''
    message = ''
    try {
      // Sending an empty book would fail the server's book validator, so an emptied book is
      // cleared instead.
      const characterBook: AppSchema.MemoryBook | null = usable.length
        ? {
            ...(character.characterBook ?? {}),
            kind: 'memory',
            _id: character.characterBook?._id ?? '',
            userId: character.userId,
            name: character.characterBook?.name || `${character.name} lore`,
            description: character.characterBook?.description ?? '',
            entries: usable,
          }
        : null

      const updated = await api.post<AppSchema.Character>(`/character/${character._id}/update`, {
        characterBook,
      })

      entries = clone(updated.characterBook)
      initial = JSON.stringify(entries)
      message = usable.length ? i18n.t('Memory book saved.') : i18n.t('Memory book cleared.')
      onSaved(updated)
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to save memory book')
    } finally {
      saving = false
    }
  }

  function reset() {
    entries = clone(character.characterBook)
    initial = JSON.stringify(entries)
    message = ''
    error = ''
  }
</script>

<div class="space-y-4">
  <p class="text-sm text-neutral-500">
    {i18n.t('Lore that applies whenever this character replies, wherever it is used.')}
  </p>

  {#if error}
    <div class="error-banner" role="alert">{error}</div>
  {/if}

  <MemoryEntries bind:entries />

  {#if !entries.length}
    <p
      class="rounded-xl border border-neutral-800 bg-[#10141c] px-4 py-8 text-center text-sm text-neutral-500"
    >
      {i18n.t('No entries. This character carries no lore of its own.')}
    </p>
  {/if}

  <div class="flex flex-wrap items-center gap-3 border-t border-neutral-800/80 pt-5">
    <button class="button-primary" type="button" disabled={saving || !isDirty} onclick={save}>
      <Save size={16} />
      {saving ? i18n.t('Saving...') : i18n.t('Save memory book')}
    </button>
    {#if isDirty}
      <button class="button-secondary" type="button" disabled={saving} onclick={reset}>
        <Trash2 size={15} />
        {i18n.t('Discard changes')}
      </button>
    {/if}
    {#if message}
      <span class="text-xs text-neutral-400" aria-live="polite">{message}</span>
    {/if}
  </div>
</div>
