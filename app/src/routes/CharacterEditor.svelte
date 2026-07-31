<script lang="ts">
  import { ArrowLeft, MessageSquareText, Save, UserRound } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { chats, type CharacterDraft } from '/app/lib/chats.svelte'

  let {
    characterId,
    onCancel,
    onSaved,
  }: {
    characterId: string | null
    onCancel: () => void
    onSaved: () => void
  } = $props()

  type EditorTab = 'profile' | 'prompt'

  let tab = $state<EditorTab>('profile')
  let loading = $state(false)
  let saving = $state(false)
  let error = $state('')
  let nameError = $state('')
  let originalPersona = $state<AppSchema.Persona | undefined>()
  let initialPersonaText = $state('')

  let form = $state({
    name: '',
    description: '',
    greeting: '',
    persona: '',
    scenario: '',
    sampleChat: '',
    systemPrompt: '',
    postHistoryInstructions: '',
  })

  function personaToText(persona: AppSchema.Persona) {
    if (persona.kind === 'text') return persona.attributes.text?.[0] ?? ''

    return Object.entries(persona.attributes)
      .map(([key, values]) => `${key}: ${values.join(', ')}`)
      .join('\n')
  }

  const greetingPlaceholder = 'Write the opening message. You can use {{char}} and {{user}}.'
  const dialoguePlaceholder = '{{user}}: Hello\n{{char}}: ...'

  async function loadCharacter() {
    if (!characterId) return

    loading = true
    try {
      const character = await chats.getCharacter(characterId)
      originalPersona = character.persona
      initialPersonaText = personaToText(character.persona)
      form = {
        name: character.name,
        description: character.description ?? '',
        greeting: character.greeting ?? '',
        persona: initialPersonaText,
        scenario: character.scenario ?? '',
        sampleChat: character.sampleChat ?? '',
        systemPrompt: character.systemPrompt ?? '',
        postHistoryInstructions: character.postHistoryInstructions ?? '',
      }
    } catch (ex) {
      error = ex instanceof Error ? ex.message : 'Failed to load character'
    } finally {
      loading = false
    }
  }

  function buildPersona(): AppSchema.Persona {
    if (originalPersona && form.persona === initialPersonaText) return originalPersona
    return { kind: 'text', attributes: { text: [form.persona] } }
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    nameError = form.name.trim() ? '' : 'Enter a character name.'
    if (nameError) {
      tab = 'profile'
      return
    }

    saving = true
    error = ''

    const draft: CharacterDraft = {
      name: form.name,
      description: form.description,
      greeting: form.greeting,
      persona: buildPersona(),
      scenario: form.scenario,
      sampleChat: form.sampleChat,
      systemPrompt: form.systemPrompt,
      postHistoryInstructions: form.postHistoryInstructions,
    }

    try {
      await chats.saveCharacter(characterId, draft)
      onSaved()
    } catch (ex) {
      error = ex instanceof Error ? ex.message : 'Failed to save character'
    } finally {
      saving = false
    }
  }

  loadCharacter()
</script>

<form class="flex h-full min-h-0 flex-col" onsubmit={submit}>
  <header
    class="flex min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4 sm:px-6"
  >
    <button class="icon-button" type="button" aria-label="Back to characters" onclick={onCancel}>
      <ArrowLeft size={19} />
    </button>
    <div class="min-w-0 flex-1">
      <h1 class="truncate text-base font-semibold text-white sm:text-lg">
        {characterId ? form.name || 'Edit character' : 'New character'}
      </h1>
      <p class="hidden text-xs text-neutral-500 sm:block">
        {characterId ? 'Update profile and prompt settings' : 'Build a reusable character prompt'}
      </p>
    </div>
    <button class="button-primary hidden sm:inline-flex" type="submit" disabled={saving || loading}>
      <Save size={17} />
      {saving ? 'Saving...' : 'Save character'}
    </button>
  </header>

  <div class="shrink-0 border-b border-neutral-800/80 px-4 sm:px-6">
    <div
      class="mx-auto flex w-full max-w-4xl gap-1"
      role="tablist"
      aria-label="Character editor sections"
    >
      <button
        class:tab-active={tab === 'profile'}
        class="editor-tab"
        type="button"
        role="tab"
        aria-selected={tab === 'profile'}
        onclick={() => (tab = 'profile')}
      >
        <UserRound size={17} />
        Profile
      </button>
      <button
        class:tab-active={tab === 'prompt'}
        class="editor-tab"
        type="button"
        role="tab"
        aria-selected={tab === 'prompt'}
        onclick={() => (tab = 'prompt')}
      >
        <MessageSquareText size={17} />
        Prompt
      </button>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
      {#if error}
        <div class="error-banner mb-5" role="alert">{error}</div>
      {/if}

      {#if loading}
        <div class="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
            ><span class="sr-only">Loading</span></span
          >
          Loading character
        </div>
      {:else if tab === 'profile'}
        <section class="space-y-6" aria-labelledby="profile-heading">
          <div>
            <h2 id="profile-heading" class="text-lg font-semibold text-neutral-100">Profile</h2>
            <p class="mt-1 text-sm text-neutral-500">
              Identity and the first message shown in a new chat.
            </p>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <label class="field-group sm:col-span-1">
              <span class="field-label">Name <span class="text-red-400">*</span></span>
              <input
                class="field"
                class:border-red-500={!!nameError}
                bind:value={form.name}
                maxlength="80"
                placeholder="Character name"
                autocomplete="off"
                oninput={() => nameError && (nameError = '')}
              />
              {#if nameError}<span class="text-xs text-red-300">{nameError}</span>{/if}
            </label>

            <label class="field-group sm:col-span-2">
              <span class="field-label">Description</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-24 resize-y"
                bind:value={form.description}
                placeholder="A short note for your character library"
              ></textarea>
              <span class="field-hint">Library note only. This is not sent to the model.</span>
            </label>

            <label class="field-group sm:col-span-2">
              <span class="field-label">First message</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-40 resize-y"
                bind:value={form.greeting}
                placeholder={greetingPlaceholder}
              ></textarea>
            </label>
          </div>
        </section>
      {:else}
        <section class="space-y-6" aria-labelledby="prompt-heading">
          <div>
            <h2 id="prompt-heading" class="text-lg font-semibold text-neutral-100">
              Character prompt
            </h2>
            <p class="mt-1 text-sm text-neutral-500">
              Define personality, context, and model instructions.
            </p>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <label class="field-group lg:col-span-2">
              <span class="field-label">Persona</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-48 resize-y font-mono text-[13px] leading-6"
                bind:value={form.persona}
                placeholder="Personality, background, goals, speaking style..."
              ></textarea>
              <span class="field-hint"
                >Changing a structured legacy persona converts it to plain text.</span
              >
            </label>

            <label class="field-group">
              <span class="field-label">Scenario</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y"
                bind:value={form.scenario}
                placeholder="Current setting and circumstances"
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">Example dialogue</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y font-mono text-[13px] leading-6"
                bind:value={form.sampleChat}
                placeholder={dialoguePlaceholder}
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">System prompt</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y font-mono text-[13px] leading-6"
                bind:value={form.systemPrompt}
                placeholder="Optional character-specific system instruction"
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">Post-history instructions</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y font-mono text-[13px] leading-6"
                bind:value={form.postHistoryInstructions}
                placeholder="Optional instruction placed after chat history"
              ></textarea>
            </label>
          </div>
        </section>
      {/if}
    </div>
  </div>

  <footer
    class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
  >
    <button class="button-primary w-full justify-center" type="submit" disabled={saving || loading}>
      <Save size={17} />
      {saving ? 'Saving...' : 'Save character'}
    </button>
  </footer>
</form>
