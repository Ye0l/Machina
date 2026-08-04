from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'missing marker: {label}')
    return text.replace(old, new, 1)

# Full character duplication on the server, including avatar, lore, folder and asset references.
p = Path('srv/api/character.ts')
s = p.read_text()
marker = """const deleteCharacter = handle(async ({ userId, params }) => {
  const id = params.id
  await store.characters.deleteCharacter({ userId: userId!, charId: id })
  return { success: true }
})
"""
addition = marker + """
const duplicateCharacter = handle(async ({ userId, params, body }) => {
  assertValid({ name: 'string?' }, body)
  const source = await store.characters.getCharacter(userId!, params.id)
  if (!source) throw errors.NotFound

  const created = await store.characters.createCharacter(userId!, {
    name: body.name?.trim() || `${source.name} (copy)`,
    appearance: source.appearance,
    avatar: source.avatar,
    persona: source.persona,
    sampleChat: source.sampleChat,
    greeting: source.greeting,
    scenario: source.scenario,
    description: source.description,
    culture: source.culture,
    tags: [...(source.tags ?? [])],
    favorite: false,
    voice: source.voice,
    alternateGreetings: [...(source.alternateGreetings ?? [])],
    characterBook: source.characterBook,
    extensions: source.extensions,
    systemPrompt: source.systemPrompt,
    postHistoryInstructions: source.postHistoryInstructions,
    insert: source.insert,
    creator: source.creator,
    characterVersion: source.characterVersion,
    sprite: source.sprite,
    visualType: source.visualType,
    voiceDisabled: source.voiceDisabled,
    imageSettings: source.imageSettings,
    json: source.json,
  })

  const copied = await store.characters.partialUpdateCharacter(created._id, userId!, {
    folder: source.folder,
    assets: (source.assets ?? []).map((asset) => ({ ...asset })),
    prefill: source.prefill,
  })
  return copied ?? created
})
"""
s = replace_once(s, marker, addition, 'character duplicate handler')
s = replace_once(
    s,
    "router.post('/:id/update', editPartCharacter)",
    "router.post('/:id/duplicate', duplicateCharacter)\nrouter.post('/:id/update', editPartCharacter)",
    'character duplicate route',
)
p.write_text(s)

# Browser character store.
p = Path('app/src/lib/chats.svelte.ts')
s = p.read_text()
marker = """  async getCharacter(characterId: string) {
    return api.get<AppSchema.Character>(`/character/${characterId}`)
  }
"""
addition = marker + """

  async duplicateCharacter(characterId: string, name: string) {
    this.error = ''
    try {
      const character = await api.post<AppSchema.Character>(`/character/${characterId}/duplicate`, {
        name,
      })
      this.characters = [character, ...this.characters.filter((item) => item._id !== character._id)]
      return character
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to duplicate character'
    }
  }
"""
s = replace_once(s, marker, addition, 'character duplicate store')
p.write_text(s)

# Character library action.
p = Path('app/src/routes/Characters.svelte')
s = p.read_text()
s = replace_once(
    s,
    "import { MessageCircle, Pencil, Plus, Search, Upload, Users } from '@lucide/svelte'",
    "import { Copy, MessageCircle, Pencil, Plus, Search, Upload, Users } from '@lucide/svelte'",
    'character copy icon',
)
marker = """  const openCharacter = async (character: CharacterSummary) => {
    const chatId = await chats.resolveChatFor(character)
    if (chatId) router.go(routes.chat(chatId))
  }
"""
addition = marker + """

  const duplicateCharacter = async (character: CharacterSummary) => {
    const copy = await chats.duplicateCharacter(
      character._id,
      i18n.t('{name} (copy)', { name: character.name })
    )
    if (copy) router.go(routes.character(copy._id, 'edit'))
  }
"""
s = replace_once(s, marker, addition, 'character duplicate action')
edit_marker = """              <a
                class=\"icon-button\"
                href={routes.character(character._id, 'edit')}
"""
copy_button = """              <button
                class=\"icon-button\"
                type=\"button\"
                aria-label={i18n.t('Duplicate {name}', { name: character.name })}
                title={i18n.t('Duplicate')}
                onclick={() => duplicateCharacter(character)}
              >
                <Copy size={17} />
              </button>
"""
s = replace_once(s, edit_marker, copy_button + edit_marker, 'character copy button')
p.write_text(s)

# Persona store and library action.
p = Path('app/src/lib/personas.svelte.ts')
s = p.read_text()
create_marker = """  async create(draft: PersonaDraft): Promise<AppSchema.UserPersona | undefined> {
"""
duplicate_method = """  async duplicate(persona: AppSchema.UserPersona, name: string) {
    return this.create({ name, persona: structuredClone(persona.persona) })
  }

"""
s = replace_once(s, create_marker, duplicate_method + create_marker, 'persona duplicate store')
p.write_text(s)

p = Path('app/src/routes/Personas.svelte')
s = p.read_text()
s = replace_once(
    s,
    "import { Pencil, Plus, UserRound } from '@lucide/svelte'",
    "import { Copy, Pencil, Plus, UserRound } from '@lucide/svelte'",
    'persona copy icon',
)
marker = """  const personaText = (persona: { kind: string; attributes: Record<string, string[]> }) =>
"""
addition = """  const duplicatePersona = async (persona: import('/common/types').AppSchema.UserPersona) => {
    const created = await personas.duplicate(
      persona,
      i18n.t('{name} (copy)', { name: persona.name })
    )
    if (created) router.go(routes.persona(created._id))
  }

""" + marker
s = replace_once(s, marker, addition, 'persona duplicate action')
edit_marker = """              <a
                class=\"icon-button shrink-0\"
                href={routes.persona(persona._id)}
"""
replacement = """              <div class=\"flex shrink-0 items-center gap-1\">
                <button
                  class=\"icon-button\"
                  type=\"button\"
                  aria-label={i18n.t('Duplicate {name}', { name: persona.name })}
                  title={i18n.t('Duplicate')}
                  onclick={() => duplicatePersona(persona)}
                >
                  <Copy size={16} />
                </button>
""" + edit_marker
s = replace_once(s, edit_marker, replacement, 'persona copy button open')
close_marker = """              </a>
            </div>
            <p class=\"mt-2 line-clamp-3"""
close_replacement = """              </a>
              </div>
            </div>
            <p class=\"mt-2 line-clamp-3"""
s = replace_once(s, close_marker, close_replacement, 'persona copy button close')
p.write_text(s)

# Memory book store and library action.
p = Path('app/src/lib/books.svelte.ts')
s = p.read_text()
create_marker = """  /** Returns the created book, whose id the caller navigates to. */
  async create(draft: BookDraft): Promise<AppSchema.MemoryBook | undefined> {
"""
duplicate_method = """  async duplicate(book: AppSchema.MemoryBook, name: string) {
    return this.create({
      name,
      description: book.description ?? '',
      folder: book.folder ?? '',
      entries: structuredClone(book.entries ?? []),
    })
  }

"""
s = replace_once(s, create_marker, duplicate_method + create_marker, 'book duplicate store')
p.write_text(s)

p = Path('app/src/routes/Books.svelte')
s = p.read_text()
s = replace_once(
    s,
    "import { BookOpen, FolderOpen, Pencil, Plus } from '@lucide/svelte'",
    "import { BookOpen, Copy, FolderOpen, Pencil, Plus } from '@lucide/svelte'",
    'book copy icon',
)
marker = """  const enabledCount = (entries: { enabled: boolean }[]) =>
    entries.filter((entry) => entry.enabled).length
"""
addition = marker + """

  const duplicateBook = async (book: import('/common/types').AppSchema.MemoryBook) => {
    const created = await books.duplicate(book, i18n.t('{name} (copy)', { name: book.name }))
    if (created) router.go(routes.book(created._id))
  }
"""
s = replace_once(s, marker, addition, 'book duplicate action')
edit_marker = """                  <a
                    class=\"icon-button shrink-0\"
                    href={routes.book(book._id)}
"""
replacement = """                  <div class=\"flex shrink-0 items-center gap-1\">
                    <button
                      class=\"icon-button\"
                      type=\"button\"
                      aria-label={i18n.t('Duplicate {name}', { name: book.name })}
                      title={i18n.t('Duplicate')}
                      onclick={() => duplicateBook(book)}
                    >
                      <Copy size={17} />
                    </button>
""" + edit_marker
s = replace_once(s, edit_marker, replacement, 'book copy button open')
close_marker = """                  </a>
                </li>
"""
close_replacement = """                  </a>
                  </div>
                </li>
"""
s = replace_once(s, close_marker, close_replacement, 'book copy button close')
p.write_text(s)
