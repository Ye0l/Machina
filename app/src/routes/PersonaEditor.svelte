<script lang="ts">
  import { untrack } from 'svelte'
  import { ArrowLeft, Save, Trash2 } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { personas } from '/app/lib/personas.svelte'
  import { i18n } from '/app/lib/i18n.svelte'

  let {
    personaId,
    onCancel,
    onSaved,
    onDirtyChange = () => {},
  }: {
    personaId: string | null
    onCancel: () => void
    onSaved: () => void
    onDirtyChange?: (dirty: boolean) => void
  } = $props()

  const personaToText = (persona?: AppSchema.Persona) => {
    if (!persona) return ''
    if (persona.kind === 'text') return persona.attributes.text?.[0] ?? ''
    return Object.entries(persona.attributes)
      .map(([key, values]) => `${key}: ${values.join(', ')}`)
      .join('\n')
  }

  let name = $state('')
  let text = $state('')
  let nameError = $state('')
  let error = $state('')
  let ready = $state(false)

  let initial = $state('{}')
  const isDirty = $derived(ready && JSON.stringify({ name, text }) !== initial)

  $effect(() => {
    onDirtyChange(isDirty)
  })

  /*
   * Seeded after the list resolves, not from whatever it happens to hold at mount. A cold
   * `/persona/:id` deep link starts the shell's `personas.load()` on the same tick, so reading
   * synchronously would show an empty form for a persona that does exist.
   *
   * `personaId` is read once on purpose: the shell keys this component by it, so a different
   * persona is a different component instance.
   */
  async function load() {
    await personas.load()
    const existing = untrack(() => (personaId ? personas.get(personaId) : undefined))
    name = existing?.name ?? ''
    text = personaToText(existing?.persona)
    initial = JSON.stringify({ name, text })
    ready = true
  }

  load()

  /** A miss after loading means the persona was deleted or never existed. */
  const missing = $derived(ready && !!personaId && !personas.get(personaId))

  async function save(event: SubmitEvent) {
    event.preventDefault()
    nameError = name.trim() ? '' : i18n.t('Enter a persona name.')
    if (nameError) return

    error = ''
    const draft = {
      name: name.trim(),
      // Stored in the same shape a character's persona uses, so it reaches the prompt through
      // the existing `{{impersonating}}` path with no special casing.
      persona: { kind: 'text', attributes: { text: [text] } } as AppSchema.Persona,
    }

    const saved = personaId ? await personas.update(personaId, draft) : await personas.create(draft)

    if (!saved) {
      error = personas.error
      return
    }

    initial = JSON.stringify({ name, text })
    onSaved()
  }

  async function remove() {
    if (!personaId) return
    if (!window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name }))) return

    if (await personas.remove(personaId)) {
      initial = JSON.stringify({ name, text })
      onSaved()
    } else {
      error = personas.error
    }
  }
</script>

<form class="flex h-full min-h-0 flex-col" onsubmit={save}>
  <header
    class="flex min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4 sm:px-6"
  >
    <button
      class="icon-button"
      type="button"
      aria-label={i18n.t('Back to personas')}
      onclick={onCancel}
    >
      <ArrowLeft size={19} />
    </button>
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-base font-semibold text-white sm:text-lg">
        {personaId ? name || i18n.t('Edit persona') : i18n.t('New persona')}
      </h1>
      <p class="hidden text-xs text-neutral-500 sm:block">
        {i18n.t('Who you are in a conversation. Pick one in any chat.')}
      </p>
    </div>
    <button class="button-primary hidden sm:inline-flex" type="submit" disabled={personas.saving}>
      <Save size={17} />
      {personas.saving ? i18n.t('Saving...') : i18n.t('Save persona')}
    </button>
  </header>

  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-7">
      {#if error}
        <div class="error-banner mb-5" role="alert">{error}</div>
      {/if}

      {#if missing}
        <p
          class="rounded-xl border border-neutral-800 bg-[#10141c] px-4 py-8 text-center text-sm text-neutral-500"
        >
          {i18n.t('That persona no longer exists.')}
        </p>
      {:else}
        <div class="space-y-5">
          <label class="field-group">
            <span class="field-label">{i18n.t('Name')} <span class="text-red-400">*</span></span>
            <input
              class="field"
              class:border-red-500={!!nameError}
              bind:value={name}
              maxlength="80"
              placeholder={i18n.t('The name the character calls you')}
              autocomplete="off"
              oninput={() => nameError && (nameError = '')}
            />
            {#if nameError}<span class="text-xs text-red-300">{nameError}</span>{/if}
          </label>

          <label class="field-group">
            <span class="field-label">{i18n.t('Description')}</span>
            <!-- prettier-ignore -->
            <textarea
              class="field min-h-48 resize-y font-mono text-[13px] leading-6"
              bind:value={text}
              placeholder={i18n.t('Appearance, background, how you speak...')}
            ></textarea>
            <span class="field-hint"
              >{i18n.t(
                'Reaches the prompt as {{impersonating}}, the way a character persona does.'
              )}</span
            >
          </label>

          {#if personaId}
            <div class="space-y-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4">
              <h2 class="text-sm font-semibold text-red-200">{i18n.t('Danger zone')}</h2>
              <button
                class="inline-flex h-10 items-center gap-2 rounded-lg border border-red-800 bg-red-900/40 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-900/70 disabled:opacity-50"
                type="button"
                disabled={personas.saving}
                onclick={remove}
              >
                <Trash2 size={16} />
                {i18n.t('Delete persona')}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <footer
    class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
  >
    <button class="button-primary w-full justify-center" type="submit" disabled={personas.saving}>
      <Save size={17} />
      {personas.saving ? i18n.t('Saving...') : i18n.t('Save persona')}
    </button>
  </footer>
</form>
