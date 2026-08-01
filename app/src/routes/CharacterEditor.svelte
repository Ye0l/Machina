<script lang="ts">
  import {
    ArrowLeft,
    ImagePlus,
    MessageSquareText,
    Plus,
    Save,
    Settings2,
    Trash2,
    UserRound,
    Volume2,
    X,
  } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import type { JsonField, JsonType } from '/common/prompt'
  import type { VoiceSettings } from '/common/types/texttospeech-schema'
  import type { ElevenLabsModel } from '/common/types/texttospeech-schema'
  import { chats, type CharacterDraft } from '/app/lib/chats.svelte'
  import { api } from '/app/lib/api'
  import { session } from '/app/lib/session.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import type { ImportedCharacter } from '/app/lib/character-port'
  import { pendingImport } from '/app/lib/pending-import'
  import CharacterAvatar from '/app/shared/CharacterAvatar.svelte'

  let {
    characterId,
    onCancel,
    onSaved,
    onDirtyChange = () => {},
    embedded = false,
  }: {
    characterId: string | null
    onCancel: () => void
    /** Receives the saved character's id; undefined when the character was deleted. */
    onSaved: (characterId?: string) => void
    onDirtyChange?: (dirty: boolean) => void
    /** Inside the character workspace, which supplies the header and tab row itself. */
    embedded?: boolean
  } = $props()

  type EditorTab = 'profile' | 'prompt' | 'advanced'

  let tab = $state<EditorTab>('profile')
  let loading = $state(false)
  let saving = $state(false)
  let error = $state('')
  let nameError = $state('')

  let originalPersona = $state<AppSchema.Persona | undefined>()
  let initialPersonaText = $state('')

  /** Recognised card data this editor has no home for, reported after an import. */
  let importNotice = $state('')
  /**
   * Lore carried in from a card. The editor has no UI for it -- the workspace's Memory book tab
   * owns that -- but the character does not exist yet at import time, so it is held here and
   * written with the rest of the deferred fields once the character has an id.
   */
  let importedBook = $state<AppSchema.MemoryBook | null>(null)

  // Core character fields.
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

  // Avatar (deferred): a pending file is converted to PNG base64 and pushed through the
  // JSON partial endpoint after the character is created/updated.
  let avatarInput = $state<HTMLInputElement>()
  let avatarPreview = $state('')
  let avatarFile = $state<File | null>(null)
  let avatarRemoved = $state(false)

  let tags = $state<string[]>([])
  let tagInput = $state('')
  let folder = $state('')
  let greetings = $state<string[]>([])

  let prefill = $state('')
  let creator = $state('')
  let characterVersion = $state('')

  // Insert (depth-injected prompt).
  let hadInsert = $state(false)
  let insertEnabled = $state(false)
  let insertPrompt = $state('')
  let insertDepth = $state('4')

  // Voice settings (discriminated union by `service`).
  let voiceDisabled = $state(false)
  let voiceService = $state<string>('')
  let vf = $state({
    voiceId: '',
    rate: '1',
    pitch: '1',
    stability: '0.5',
    similarity: '0.75',
    model: 'eleven_multilingual_v1' as ElevenLabsModel,
    seed: '',
  })

  // Character image settings (practical generation fields).
  let originalImageSettings = $state<AppSchema.Character['imageSettings']>()
  let hadImage = $state(false)
  let imageEnabled = $state(false)
  let img = $state({
    type: 'agnai',
    width: '512',
    height: '768',
    steps: '28',
    cfg: '7',
    negative: '',
    prefix: '',
    suffix: '',
    template: '',
    autofix: false,
    clipSkip: '',
  })

  // JSON response schema (structured output).
  let hadJson = $state(false)
  let jsonEnabled = $state(false)
  let jsonSchema = $state<JsonField[]>([])
  let jsonResponse = $state('')
  let jsonHistory = $state('')
  let jsonImageCaption = $state('')
  let jsonSystemPrompt = $state('')
  let jsonJailbreak = $state('')

  const greetingPlaceholder = $derived(
    i18n.t('Write the opening message. You can use {{char}} and {{user}}.')
  )
  const dialoguePlaceholder = $derived(i18n.t('{{user}}: Hello\n{{char}}: ...'))
  const responsePlaceholder = $derived(i18n.t(`{{char}}'s reply formatting template`))

  const VOICE_SERVICES: { value: string; label: string }[] = [
    { value: '', label: 'Off' },
    { value: 'webspeechsynthesis', label: 'Browser (Web Speech)' },
    { value: 'elevenlabs', label: 'ElevenLabs' },
    { value: 'novel', label: 'NovelAI' },
    { value: 'agnaistic', label: 'Agnai' },
  ]

  const JSON_TYPES: { value: JsonType['type']; label: string }[] = [
    { value: 'string', label: 'Text' },
    { value: 'integer', label: 'Number' },
    { value: 'bool', label: 'Boolean' },
    { value: 'enum', label: 'Enum' },
  ]

  const JSON_TEMPLATES: { name: string; build: () => JsonField[] }[] = [
    {
      name: 'Stats',
      build: () => [
        {
          name: 'mood',
          disabled: false,
          type: { type: 'enum', enum: ['happy', 'neutral', 'sad', 'angry'] },
        },
        { name: 'arousal', disabled: false, type: { type: 'integer' } },
        { name: 'location', disabled: false, type: { type: 'string' } },
      ],
    },
    {
      name: 'Sentiment',
      build: () => [
        {
          name: 'sentiment',
          disabled: false,
          type: { type: 'enum', enum: ['positive', 'neutral', 'negative'] },
        },
      ],
    },
    {
      name: 'Rating',
      build: () => [
        { name: 'rating', disabled: false, type: { type: 'integer' } },
        { name: 'summary', disabled: false, type: { type: 'string', maxLength: 280 } },
      ],
    },
  ]

  function personaToText(persona: AppSchema.Persona) {
    if (persona.kind === 'text') return persona.attributes.text?.[0] ?? ''
    return Object.entries(persona.attributes)
      .map(([key, values]) => `${key}: ${values.join(', ')}`)
      .join('\n')
  }

  function buildPersona(): AppSchema.Persona {
    if (originalPersona && form.persona === initialPersonaText) return originalPersona
    return { kind: 'text', attributes: { text: [form.persona] } }
  }

  function num(value: string, fallback?: number): number | undefined {
    if (value === '' || value == null) return fallback
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  function loadVoice(voice?: VoiceSettings) {
    voiceService = voice?.service ?? ''
    vf.voiceId = voice && 'voiceId' in voice ? voice.voiceId : ''
    vf.rate = voice && 'rate' in voice ? String(voice.rate ?? 1) : '1'
    if (voice?.service === 'webspeechsynthesis') vf.pitch = String(voice.pitch ?? 1)
    if (voice?.service === 'elevenlabs') {
      vf.stability = String(voice.stability ?? 0.5)
      vf.similarity = String(voice.similarityBoost ?? 0.75)
      vf.model = voice.model ?? 'eleven_multilingual_v1'
    }
    if (voice && 'seed' in voice) vf.seed = String(voice.seed ?? '')
  }

  function buildVoice(): VoiceSettings {
    switch (voiceService) {
      case 'webspeechsynthesis':
        return {
          service: 'webspeechsynthesis',
          voiceId: vf.voiceId,
          pitch: num(vf.pitch, 1) as number,
          rate: num(vf.rate, 1) as number,
        }
      case 'elevenlabs':
        return {
          service: 'elevenlabs',
          voiceId: vf.voiceId,
          model: vf.model,
          stability: num(vf.stability, 0.5) as number,
          similarityBoost: num(vf.similarity, 0.75) as number,
          rate: num(vf.rate, 1) as number,
        }
      case 'novel':
        return {
          service: 'novel',
          voiceId: vf.voiceId,
          seed: vf.seed || undefined,
          rate: num(vf.rate, 1) as number,
        }
      case 'agnaistic':
        return {
          service: 'agnaistic',
          voiceId: vf.voiceId,
          seed: num(vf.seed, undefined) as number | undefined,
          rate: num(vf.rate, 1) as number,
        }
      default:
        return { service: undefined }
    }
  }

  function loadImageSettings(settings?: AppSchema.Character['imageSettings']) {
    originalImageSettings = settings
    if (!settings) return
    img.type = settings.type ?? 'agnai'
    img.width = settings.width != null ? String(settings.width) : '512'
    img.height = settings.height != null ? String(settings.height) : '768'
    img.steps = settings.steps != null ? String(settings.steps) : '28'
    img.cfg = settings.cfg != null ? String(settings.cfg) : '7'
    img.negative = settings.negative ?? ''
    img.prefix = settings.prefix ?? ''
    img.suffix = settings.suffix ?? ''
    img.template = settings.template ?? ''
    img.autofix = !!settings.autofix
    img.clipSkip = settings.clipSkip != null ? String(settings.clipSkip) : ''
  }

  function buildImageSettings() {
    const inherited = originalImageSettings ?? session.user?.images
    return {
      ...(inherited ?? {}),
      type: img.type,
      active: img.type,
      imageProviderId: inherited?.imageProviderId ?? session.user?.imageProviderId ?? '',
      width: num(img.width, 512),
      height: num(img.height, 768),
      steps: num(img.steps, 28),
      cfg: num(img.cfg, 7),
      negative: img.negative,
      prefix: img.prefix || undefined,
      suffix: img.suffix || undefined,
      template: img.template || undefined,
      autofix: img.autofix,
      clipSkip: img.clipSkip ? num(img.clipSkip, undefined) : undefined,
    }
  }

  function buildJson() {
    return {
      schema: jsonSchema,
      response: jsonResponse,
      history: jsonHistory,
      imageCaption: jsonImageCaption,
      systemPrompt: jsonSystemPrompt,
      jailbreak: jsonJailbreak,
    }
  }

  /** Snapshot of all editor state for unsaved-change tracking. */
  function snapshot() {
    return JSON.stringify({
      form,
      avatar: avatarFile ? 'pending' : avatarRemoved ? 'removed' : avatarPreview,
      book: importedBook,
      tags,
      folder,
      greetings,
      prefill,
      creator,
      characterVersion,
      insert: { e: insertEnabled, p: insertPrompt, d: insertDepth },
      voice: { s: voiceService, f: vf, d: voiceDisabled },
      image: { e: imageEnabled, i: img },
      json: {
        e: jsonEnabled,
        s: jsonSchema,
        r: jsonResponse,
        h: jsonHistory,
        c: jsonImageCaption,
        p: jsonSystemPrompt,
        j: jsonJailbreak,
      },
    })
  }

  let initialSnapshot = $state('')
  const isDirty = $derived.by(() => snapshot() !== initialSnapshot)

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

  // Revoke any object URL we created when it is replaced or the editor unmounts.
  $effect(() => {
    const url = avatarPreview
    return () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  })

  /** Populates an empty editor from a card parsed by the library's import action. */
  function applyImport(imported: ImportedCharacter) {
    form = {
      name: imported.name,
      description: imported.description,
      greeting: imported.greeting,
      persona: personaToText(imported.persona),
      scenario: imported.scenario,
      sampleChat: imported.sampleChat,
      systemPrompt: imported.systemPrompt,
      postHistoryInstructions: imported.postHistoryInstructions,
    }
    tags = [...imported.tags]
    greetings = [...imported.alternateGreetings]
    creator = imported.creator
    characterVersion = imported.characterVersion

    if (imported.avatar) {
      avatarFile = imported.avatar
      avatarRemoved = false
      avatarPreview = URL.createObjectURL(imported.avatar)
    }

    importedBook = imported.characterBook ?? null

    const notice = imported.unsupported.length
      ? i18n.t('Imported. Not carried over: {fields}.', { fields: imported.unsupported.join(', ') })
      : i18n.t('Imported. Review the character, then save it.')
    // The entries are not editable until the character exists, so say where they went.
    importNotice = importedBook
      ? `${notice} ${i18n.t('{count} memory book entries will be saved with it.', {
          count: importedBook.entries.length,
        })}`
      : notice
  }

  async function loadCharacter() {
    if (!characterId) {
      // Snapshot the empty form first, so an import registers as unsaved work and the
      // navigation guard protects it.
      initialSnapshot = snapshot()
      const imported = pendingImport.take()
      if (imported) applyImport(imported)
      return
    }

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

      avatarPreview = character.avatar ?? ''
      avatarFile = null
      avatarRemoved = false

      tags = character.tags ? [...character.tags] : []
      folder = character.folder ?? ''
      greetings = character.alternateGreetings ? [...character.alternateGreetings] : []
      prefill = character.prefill ?? ''
      creator = character.creator ?? ''
      characterVersion = character.characterVersion ?? ''
      voiceDisabled = !!character.voiceDisabled
      loadVoice(character.voice)

      hadInsert = !!character.insert
      insertEnabled = hadInsert
      insertPrompt = character.insert?.prompt ?? ''
      insertDepth = character.insert ? String(character.insert.depth) : '4'

      hadImage = !!character.imageSettings
      imageEnabled = hadImage
      loadImageSettings(character.imageSettings)

      hadJson = !!character.json
      jsonEnabled = hadJson
      jsonSchema = character.json?.schema
        ? character.json.schema.map((f) => ({
            name: f.name,
            disabled: f.disabled,
            type: JSON.parse(JSON.stringify(f.type)),
            alias: f.alias,
          }))
        : []
      jsonResponse = character.json?.response ?? ''
      jsonHistory = character.json?.history ?? ''
      jsonImageCaption = character.json?.imageCaption ?? ''
      jsonSystemPrompt = character.json?.systemPrompt ?? ''
      jsonJailbreak = character.json?.jailbreak ?? ''

      initialSnapshot = snapshot()
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to load character')
    } finally {
      loading = false
    }
  }

  function onAvatarChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    avatarFile = file
    avatarRemoved = false
    avatarPreview = URL.createObjectURL(file)
  }

  function clearAvatar() {
    avatarFile = null
    avatarRemoved = !!characterId && !!avatarPreview
    avatarPreview = ''
  }

  function addTag() {
    const value = tagInput.trim()
    if (!value) return
    if (!tags.includes(value)) tags.push(value)
    tagInput = ''
  }

  function onTagKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      addTag()
    } else if (event.key === 'Backspace' && !tagInput && tags.length) {
      tags.pop()
    }
  }

  function addGreeting() {
    greetings.push('')
  }

  function setFieldType(field: JsonField, kind: JsonType['type']) {
    if (kind === 'enum') field.type = { type: 'enum', enum: [] }
    else if (kind === 'string') field.type = { type: 'string' }
    else field.type = { type: kind }
  }

  function enumValues(field: JsonField): string {
    return field.type.type === 'enum' ? field.type.enum.join(', ') : ''
  }

  function setEnumValues(field: JsonField, value: string) {
    if (field.type.type !== 'enum') return
    field.type.enum = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  }

  function maxLen(field: JsonField): string {
    return field.type.type === 'string' ? String(field.type.maxLength ?? '') : ''
  }

  function setMaxLen(field: JsonField, value: string) {
    if (field.type.type !== 'string') return
    field.type.maxLength = value ? Number(value) : undefined
  }

  /** Convert any image file to a PNG base64 data URL (the only avatar format the API accepts). */
  function fileToPngDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const image = new Image()
        image.onload = () => {
          const canvas = document.createElement('canvas')
          const maxEdge = 1024
          const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight))
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
          const ctx = canvas.getContext('2d')
          if (!ctx) return reject(new Error('Could not process image'))
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvas.toDataURL('image/png'))
        }
        image.onerror = () => reject(new Error('Could not read image'))
        image.src = reader.result as string
      }
      reader.onerror = () => reject(new Error('Could not read file'))
      reader.readAsDataURL(file)
    })
  }

  function buildDeferredPartial(): Record<string, unknown> {
    const partial: Record<string, unknown> = {
      tags: [...tags],
      folder: folder.trim(),
      alternateGreetings: greetings.slice(),
      prefill,
      creator: creator.trim(),
      characterVersion: characterVersion.trim(),
      systemPrompt: form.systemPrompt,
      postHistoryInstructions: form.postHistoryInstructions,
      voice: buildVoice(),
      voiceDisabled,
    }

    partial.insert = insertEnabled
      ? { prompt: insertPrompt, depth: num(insertDepth, 4) ?? 0 }
      : hadInsert
      ? null
      : undefined
    partial.imageSettings = imageEnabled ? buildImageSettings() : hadImage ? null : undefined
    partial.json = jsonEnabled ? buildJson() : hadJson ? null : undefined

    return partial
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    nameError = form.name.trim() ? '' : i18n.t('Enter a character name.')
    if (nameError) {
      tab = 'profile'
      return
    }

    saving = true
    error = ''

    const coreDraft: CharacterDraft = {
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
      const saved = await chats.saveCharacter(characterId, coreDraft)
      const id = saved._id

      // Deferred fields go through the JSON partial endpoint. This is also how a newly
      // created character receives its avatar (no id exists until after create).
      const partial = buildDeferredPartial()
      if (avatarFile) partial.avatar = await fileToPngDataUrl(avatarFile)
      // Only ever set from an import, which cannot happen for an existing character, so this
      // never overwrites a book edited under the workspace's Memory book tab.
      if (importedBook) partial.characterBook = { ...importedBook, userId: saved.userId }

      if (Object.keys(partial).length) {
        await api.post(`/character/${id}/update`, partial)
      }
      if (avatarRemoved && !avatarFile) {
        await api.del(`/character/${id}/avatar`)
      }

      await chats.loadCharacters(true)
      initialSnapshot = snapshot()
      onSaved(id)
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to save character')
    } finally {
      saving = false
    }
  }

  async function removeCharacter() {
    if (!characterId) return
    const subject = form.name || i18n.t('this character')
    if (!window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name: subject })))
      return

    saving = true
    error = ''
    try {
      await api.del(`/character/${characterId}`)
      await chats.loadCharacters(true)
      onSaved()
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to delete character')
    } finally {
      saving = false
    }
  }

  loadCharacter()
</script>

<form class="flex h-full min-h-0 flex-col" onsubmit={submit}>
  {#if !embedded}
    <header
      class="flex min-h-16 shrink-0 items-center gap-3 border-b border-neutral-800/80 px-4 sm:px-6"
    >
      <button
        class="icon-button"
        type="button"
        aria-label={i18n.t('Back to characters')}
        onclick={onCancel}
      >
        <ArrowLeft size={19} />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base font-semibold text-white sm:text-lg">
          {characterId ? form.name || i18n.t('Edit character') : i18n.t('New character')}
        </h1>
        <p class="hidden text-xs text-neutral-500 sm:block">
          {characterId
            ? i18n.t('Update profile and prompt settings')
            : i18n.t('Build a reusable character prompt')}
        </p>
      </div>
      <button
        class="button-primary hidden sm:inline-flex"
        type="submit"
        disabled={saving || loading}
      >
        <Save size={17} />
        {saving ? i18n.t('Saving...') : i18n.t('Save character')}
      </button>
    </header>
  {/if}

  <div class="shrink-0 border-b border-neutral-800/80 px-4 sm:px-6">
    <div
      class="mx-auto flex w-full max-w-4xl gap-1"
      role="tablist"
      aria-label={i18n.t('Character editor sections')}
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
        {i18n.t('Profile')}
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
        {i18n.t('Prompt')}
      </button>
      <button
        class:tab-active={tab === 'advanced'}
        class="editor-tab"
        type="button"
        role="tab"
        aria-selected={tab === 'advanced'}
        onclick={() => (tab = 'advanced')}
      >
        <Settings2 size={17} />
        {i18n.t('Advanced')}
      </button>
    </div>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto">
    <div class="mx-auto w-full max-w-4xl px-4 py-5 sm:px-6 sm:py-7">
      {#if error}
        <div class="error-banner mb-5" role="alert">{error}</div>
      {/if}

      {#if importNotice}
        <div
          class="mb-5 flex items-start gap-3 rounded-lg border border-violet-900/70 bg-violet-950/40 px-3 py-2.5 text-sm text-violet-200"
          role="status"
        >
          <span class="flex-1">{importNotice}</span>
          <button
            class="shrink-0 text-violet-400 hover:text-violet-200"
            type="button"
            aria-label={i18n.t('Dismiss')}
            onclick={() => (importNotice = '')}
          >
            <X size={16} />
          </button>
        </div>
      {/if}

      {#if loading}
        <div class="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
            ><span class="sr-only">{i18n.t('Loading')}</span></span
          >
          {i18n.t('Loading character')}
        </div>
      {:else if tab === 'profile'}
        <section class="space-y-6" aria-labelledby="profile-heading">
          <div>
            <h2 id="profile-heading" class="text-lg font-semibold text-neutral-100">
              {i18n.t('Profile')}
            </h2>
            <p class="mt-1 text-sm text-neutral-500">
              {i18n.t('Identity and the first message shown in a new chat.')}
            </p>
          </div>

          <div class="flex items-center gap-4">
            <CharacterAvatar name={form.name || '?'} avatar={avatarPreview} size="lg" />
            <div class="flex flex-wrap items-center gap-2">
              <input
                bind:this={avatarInput}
                type="file"
                accept="image/*"
                class="hidden"
                onchange={onAvatarChange}
              />
              <button class="button-secondary" type="button" onclick={() => avatarInput?.click()}>
                <ImagePlus size={16} />
                {avatarPreview ? i18n.t('Replace') : i18n.t('Upload')}
              </button>
              {#if avatarPreview || avatarRemoved}
                <button class="button-secondary" type="button" onclick={clearAvatar}>
                  <X size={16} />
                  {i18n.t('Remove')}
                </button>
              {/if}
              <span class="text-xs text-neutral-500"
                >{i18n.t('Saved as PNG. Applied after you save.')}</span
              >
            </div>
          </div>

          <div class="grid gap-5 sm:grid-cols-2">
            <label class="field-group sm:col-span-1">
              <span class="field-label">{i18n.t('Name')} <span class="text-red-400">*</span></span>
              <input
                class="field"
                class:border-red-500={!!nameError}
                bind:value={form.name}
                maxlength="80"
                placeholder={i18n.t('Character name')}
                autocomplete="off"
                oninput={() => nameError && (nameError = '')}
              />
              {#if nameError}<span class="text-xs text-red-300">{nameError}</span>{/if}
            </label>

            <label class="field-group sm:col-span-2">
              <span class="field-label">{i18n.t('Description')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-24 resize-y"
                bind:value={form.description}
                placeholder={i18n.t('A short note for your character library')}
              ></textarea>
              <span class="field-hint"
                >{i18n.t('Library note only. This is not sent to the model.')}</span
              >
            </label>

            <label class="field-group sm:col-span-2">
              <span class="field-label">{i18n.t('First message')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-40 resize-y"
                bind:value={form.greeting}
                placeholder={greetingPlaceholder}
              ></textarea>
            </label>

            <div class="field-group sm:col-span-2">
              <span class="field-label">{i18n.t('Tags')}</span>
              <div
                class="flex flex-wrap items-center gap-2 rounded-lg border border-neutral-700 bg-[#0f131a] px-2 py-2"
              >
                {#each tags as tag, i (tag)}
                  <span
                    class="inline-flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-200"
                  >
                    {tag}
                    <button
                      type="button"
                      class="text-violet-300/70 hover:text-white"
                      aria-label={i18n.t('Remove {name}', { name: tag })}
                      onclick={() => tags.splice(i, 1)}><X size={12} /></button
                    >
                  </span>
                {/each}
                <input
                  class="min-w-[8rem] flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                  bind:value={tagInput}
                  placeholder={tags.length
                    ? i18n.t('Add tag…')
                    : i18n.t('Type a tag and press Enter')}
                  autocomplete="off"
                  onkeydown={onTagKeydown}
                  onblur={addTag}
                />
              </div>
              <span class="field-hint"
                >{i18n.t('Press Enter or comma to add. Used to group characters.')}</span
              >
            </div>

            <label class="field-group sm:col-span-1">
              <span class="field-label">{i18n.t('Folder')}</span>
              <input
                class="field"
                bind:value={folder}
                placeholder={i18n.t('e.g. Favorites')}
                autocomplete="off"
              />
              <span class="field-hint">{i18n.t('Optional grouping in your character list.')}</span>
            </label>
          </div>

          <div class="field-group">
            <div class="flex items-center justify-between">
              <span class="field-label">{i18n.t('Alternate greetings')}</span>
              <button class="button-secondary !h-8 px-3" type="button" onclick={addGreeting}>
                <Plus size={14} />
                {i18n.t('Add')}
              </button>
            </div>
            {#if greetings.length}
              <div class="space-y-2">
                {#each greetings as _, i (i)}
                  <div class="flex items-start gap-2">
                    <!-- prettier-ignore -->
                    <textarea
                      class="field min-h-20 resize-y"
                      bind:value={greetings[i]}
                      placeholder={greetingPlaceholder}
                    ></textarea>
                    <button
                      class="icon-button !h-9 !w-9 shrink-0"
                      type="button"
                      aria-label={i18n.t('Remove greeting')}
                      onclick={() => greetings.splice(i, 1)}><Trash2 size={16} /></button
                    >
                  </div>
                {/each}
              </div>
            {:else}
              <span class="field-hint"
                >{i18n.t('Extra opening messages the user can pick when starting a chat.')}</span
              >
            {/if}
          </div>
        </section>
      {:else if tab === 'prompt'}
        <section class="space-y-6" aria-labelledby="prompt-heading">
          <div>
            <h2 id="prompt-heading" class="text-lg font-semibold text-neutral-100">
              {i18n.t('Character prompt')}
            </h2>
            <p class="mt-1 text-sm text-neutral-500">
              {i18n.t('Define personality, context, and model instructions.')}
            </p>
          </div>

          <div class="grid gap-5 lg:grid-cols-2">
            <label class="field-group lg:col-span-2">
              <span class="field-label">{i18n.t('Persona')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-48 resize-y font-mono text-[13px] leading-6"
                bind:value={form.persona}
                placeholder={i18n.t('Personality, background, goals, speaking style...')}
              ></textarea>
              <span class="field-hint"
                >{i18n.t('Changing a structured legacy persona converts it to plain text.')}</span
              >
            </label>

            <label class="field-group">
              <span class="field-label">{i18n.t('Scenario')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y"
                bind:value={form.scenario}
                placeholder={i18n.t('Current setting and circumstances')}
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">{i18n.t('Example dialogue')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y font-mono text-[13px] leading-6"
                bind:value={form.sampleChat}
                placeholder={dialoguePlaceholder}
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">{i18n.t('System prompt')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y font-mono text-[13px] leading-6"
                bind:value={form.systemPrompt}
                placeholder={i18n.t('Optional character-specific system instruction')}
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">{i18n.t('Post-history instructions')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-36 resize-y font-mono text-[13px] leading-6"
                bind:value={form.postHistoryInstructions}
                placeholder={i18n.t('Optional instruction placed after chat history')}
              ></textarea>
            </label>

            <label class="field-group">
              <span class="field-label">{i18n.t('Prefill')}</span>
              <!-- prettier-ignore -->
              <textarea
                class="field min-h-24 resize-y font-mono text-[13px] leading-6"
                bind:value={prefill}
                placeholder={i18n.t('Optional assistant prefill (provider-dependent)')}
              ></textarea>
            </label>

            <div class="field-group">
              <label class="flex items-center gap-2">
                <input class="h-4 w-4" type="checkbox" bind:checked={insertEnabled} />
                <span class="field-label">{i18n.t('Insert prompt at depth')}</span>
              </label>
              {#if insertEnabled}
                <div class="grid gap-3 sm:grid-cols-[1fr_8rem]">
                  <!-- prettier-ignore -->
                  <textarea
                    class="field min-h-24 resize-y font-mono text-[13px] leading-6"
                    bind:value={insertPrompt}
                    placeholder={i18n.t('Prompt injected into recent history')}
                  ></textarea>
                  <label class="field-group">
                    <span class="field-label">{i18n.t('Depth')}</span>
                    <input class="field" type="number" min="0" bind:value={insertDepth} />
                  </label>
                </div>
              {/if}
            </div>

            <label class="field-group">
              <span class="field-label">{i18n.t('Creator')}</span>
              <input
                class="field"
                bind:value={creator}
                placeholder={i18n.t('Author handle')}
                autocomplete="off"
              />
            </label>

            <label class="field-group">
              <span class="field-label">{i18n.t('Character version')}</span>
              <input
                class="field"
                bind:value={characterVersion}
                placeholder={i18n.t('e.g. 1.0')}
                autocomplete="off"
              />
            </label>
          </div>
        </section>
      {:else}
        <section class="space-y-6" aria-labelledby="advanced-heading">
          <div>
            <h2 id="advanced-heading" class="text-lg font-semibold text-neutral-100">
              {i18n.t('Advanced')}
            </h2>
            <p class="mt-1 text-sm text-neutral-500">
              {i18n.t('Voice, image, and structured output settings.')}
            </p>
          </div>

          <div class="space-y-4 rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4">
            <div class="flex items-center gap-2 text-neutral-200">
              <Volume2 size={17} />
              <h3 class="text-sm font-semibold">{i18n.t('Voice')}</h3>
            </div>
            <label class="flex items-center gap-2">
              <input class="h-4 w-4" type="checkbox" bind:checked={voiceDisabled} />
              <span class="text-sm text-neutral-300"
                >{i18n.t('Disable voice for this character')}</span
              >
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="field-group">
                <span class="field-label">{i18n.t('Service')}</span>
                <select class="field" bind:value={voiceService}>
                  {#each VOICE_SERVICES as service (service.value)}
                    <option value={service.value}>{i18n.t(service.label)}</option>
                  {/each}
                </select>
              </label>
              <label class="field-group">
                <span class="field-label">{i18n.t('Voice ID')}</span>
                <input
                  class="field"
                  bind:value={vf.voiceId}
                  placeholder={i18n.t('Provider voice identifier')}
                />
              </label>
              <label class="field-group">
                <span class="field-label">{i18n.t('Rate')}</span>
                <input class="field" type="number" step="0.1" bind:value={vf.rate} />
              </label>
              {#if voiceService === 'webspeechsynthesis'}
                <label class="field-group">
                  <span class="field-label">{i18n.t('Pitch')}</span>
                  <input class="field" type="number" step="0.1" bind:value={vf.pitch} />
                </label>
              {/if}
              {#if voiceService === 'elevenlabs'}
                <label class="field-group">
                  <span class="field-label">{i18n.t('Model')}</span>
                  <select class="field" bind:value={vf.model}>
                    <option value="eleven_multilingual_v1">{i18n.t('Multilingual v1')}</option>
                    <option value="eleven_monolingual_v1">{i18n.t('Monolingual v1')}</option>
                  </select>
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Stability')}</span>
                  <input
                    class="field"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    bind:value={vf.stability}
                  />
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Similarity')}</span>
                  <input
                    class="field"
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    bind:value={vf.similarity}
                  />
                </label>
              {/if}
              {#if voiceService === 'novel' || voiceService === 'agnaistic'}
                <label class="field-group">
                  <span class="field-label">{i18n.t('Seed')}</span>
                  <input class="field" bind:value={vf.seed} placeholder={i18n.t('Optional')} />
                </label>
              {/if}
            </div>
          </div>

          <div class="space-y-4 rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4">
            <label class="flex items-center gap-2">
              <input class="h-4 w-4" type="checkbox" bind:checked={imageEnabled} />
              <span class="text-sm font-semibold text-neutral-200"
                >{i18n.t('Character image settings')}</span
              >
            </label>
            {#if imageEnabled}
              <div class="grid gap-4 sm:grid-cols-3">
                <label class="field-group">
                  <span class="field-label">{i18n.t('Provider')}</span>
                  <select class="field" bind:value={img.type}>
                    <option value="agnai">{i18n.t('Agnai')}</option>
                    <option value="novel">{i18n.t('NovelAI')}</option>
                    <option value="horde">{i18n.t('Horde')}</option>
                    <option value="sd">{i18n.t('Stable Diffusion')}</option>
                    <option value="swarm">{i18n.t('Swarm')}</option>
                  </select>
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Width')}</span>
                  <input class="field" type="number" step="64" bind:value={img.width} />
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Height')}</span>
                  <input class="field" type="number" step="64" bind:value={img.height} />
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Steps')}</span>
                  <input class="field" type="number" min="1" bind:value={img.steps} />
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('CFG')}</span>
                  <input class="field" type="number" step="0.5" bind:value={img.cfg} />
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Clip skip')}</span>
                  <input
                    class="field"
                    type="number"
                    min="0"
                    bind:value={img.clipSkip}
                    placeholder="0"
                  />
                </label>
                <label class="field-group sm:col-span-2">
                  <span class="field-label">{i18n.t('Prefix')}</span>
                  <input
                    class="field"
                    bind:value={img.prefix}
                    placeholder={i18n.t('Prepended to the prompt')}
                  />
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Suffix')}</span>
                  <input
                    class="field"
                    bind:value={img.suffix}
                    placeholder={i18n.t('Appended to the prompt')}
                  />
                </label>
                <label class="field-group sm:col-span-3">
                  <span class="field-label">{i18n.t('Negative prompt')}</span>
                  <!-- prettier-ignore -->
                  <textarea class="field min-h-16 resize-y" bind:value={img.negative} placeholder={i18n.t('What to avoid')}></textarea>
                </label>
                <label class="field-group sm:col-span-3">
                  <span class="field-label">{i18n.t('Template')}</span>
                  <!-- prettier-ignore -->
                  <textarea class="field min-h-20 resize-y font-mono text-[13px] leading-6" bind:value={img.template} placeholder={i18n.t('Optional generation template')}></textarea>
                </label>
                <label class="flex items-center gap-2 sm:col-span-3">
                  <input class="h-4 w-4" type="checkbox" bind:checked={img.autofix} />
                  <span class="text-sm text-neutral-300">{i18n.t('Autofix')}</span>
                </label>
              </div>
            {/if}
          </div>

          <div class="space-y-4 rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4">
            <label class="flex items-center gap-2">
              <input class="h-4 w-4" type="checkbox" bind:checked={jsonEnabled} />
              <span class="text-sm font-semibold text-neutral-200"
                >{i18n.t('JSON response schema')}</span
              >
            </label>
            {#if jsonEnabled}
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-xs text-neutral-500">{i18n.t('Template')}:</span>
                {#each JSON_TEMPLATES as template (template.name)}
                  <button
                    class="button-secondary !h-8 px-3"
                    type="button"
                    onclick={() => (jsonSchema = template.build())}>{i18n.t(template.name)}</button
                  >
                {/each}
                <button
                  class="button-secondary !h-8 px-3"
                  type="button"
                  onclick={() => (jsonSchema = [])}>{i18n.t('Clear')}</button
                >
              </div>

              <div class="space-y-2">
                {#each jsonSchema as field, i (i)}
                  <div class="rounded-lg border border-neutral-800 bg-[#0f131a] p-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <input
                        class="field !w-auto flex-1"
                        bind:value={field.name}
                        placeholder={i18n.t('Field name')}
                        autocomplete="off"
                      />
                      <select
                        class="field !w-auto"
                        value={field.type.type}
                        onchange={(e) => setFieldType(field, (e.currentTarget as HTMLSelectElement).value as JsonType['type'])}
                      >
                        {#each JSON_TYPES as kind (kind.value)}
                          <option value={kind.value}>{i18n.t(kind.label)}</option>
                        {/each}
                      </select>
                      <label class="flex items-center gap-1 text-xs text-neutral-400">
                        <input class="h-4 w-4" type="checkbox" bind:checked={field.disabled} />
                        {i18n.t('Hide')}
                      </label>
                      <button
                        class="icon-button !h-9 !w-9"
                        type="button"
                        aria-label={i18n.t('Remove field')}
                        onclick={() => jsonSchema.splice(i, 1)}><Trash2 size={15} /></button
                      >
                    </div>
                    {#if field.type.type === 'enum'}
                      <input
                        class="field mt-2"
                        value={enumValues(field)}
                        placeholder={i18n.t('Comma-separated values')}
                        onchange={(e) => setEnumValues(field, (e.currentTarget as HTMLInputElement).value)}
                      />
                    {/if}
                    {#if field.type.type === 'string'}
                      <label class="field-group mt-2 sm:flex-row sm:items-center sm:gap-3">
                        <span class="field-label sm:!w-32">{i18n.t('Max length')}</span>
                        <input
                          class="field"
                          type="number"
                          min="0"
                          value={maxLen(field)}
                          onchange={(e) => setMaxLen(field, (e.currentTarget as HTMLInputElement).value)}
                        />
                      </label>
                    {/if}
                  </div>
                {/each}
                <button
                  class="button-secondary !h-8 px-3"
                  type="button"
                  onclick={() =>
                    jsonSchema.push({ name: '', disabled: false, type: { type: 'string' } })}
                >
                  <Plus size={14} />
                  {i18n.t('Add field')}
                </button>
              </div>

              <div class="grid gap-4">
                <label class="field-group">
                  <span class="field-label">{i18n.t('Response template')}</span>
                  <!-- prettier-ignore -->
                  <textarea class="field min-h-20 resize-y font-mono text-[13px] leading-6" bind:value={jsonResponse} placeholder={responsePlaceholder}></textarea>
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('History template')}</span>
                  <!-- prettier-ignore -->
                  <textarea class="field min-h-20 resize-y font-mono text-[13px] leading-6" bind:value={jsonHistory}></textarea>
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('Image caption template')}</span>
                  <!-- prettier-ignore -->
                  <textarea class="field min-h-16 resize-y font-mono text-[13px] leading-6" bind:value={jsonImageCaption}></textarea>
                </label>
                <label class="field-group">
                  <span class="field-label">{i18n.t('JSON system prompt')}</span>
                  <!-- prettier-ignore -->
                  <textarea class="field min-h-20 resize-y font-mono text-[13px] leading-6" bind:value={jsonSystemPrompt}></textarea>
                </label>
              </div>
            {/if}
          </div>

          {#if characterId}
            <div class="space-y-3 rounded-xl border border-red-900/60 bg-red-950/20 p-4">
              <h3 class="text-sm font-semibold text-red-200">{i18n.t('Danger zone')}</h3>
              <p class="text-xs text-red-300/80">
                {i18n.t('Deleting a character is permanent and also affects its chats.')}
              </p>
              <button
                class="inline-flex h-10 items-center gap-2 rounded-lg border border-red-800 bg-red-900/40 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-900/70 disabled:opacity-50"
                type="button"
                disabled={saving}
                onclick={removeCharacter}
              >
                <Trash2 size={16} />
                {i18n.t('Delete character')}
              </button>
            </div>
          {/if}
        </section>
      {/if}
    </div>
  </div>

  <footer
    class="shrink-0 border-t border-neutral-800/80 bg-[#0d1118] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden"
  >
    <button class="button-primary w-full justify-center" type="submit" disabled={saving || loading}>
      <Save size={17} />
      {saving ? i18n.t('Saving...') : i18n.t('Save character')}
    </button>
  </footer>
</form>
