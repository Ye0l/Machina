import { describe, expect, it } from 'vitest'
import {
  characterToJson,
  embedCardInPng,
  jsonToCharacter,
  parseCharacterFile,
  type ImportedCharacter,
} from '/app/lib/character-port'
import { formatCharacter } from '/common/characters'
import type { AppSchema } from '/common/types'

const personaText = (character: ImportedCharacter) =>
  character.persona.kind === 'text' ? character.persona.attributes.text?.[0] ?? '' : ''

describe('jsonToCharacter', () => {
  it('reads an Agnai native character', () => {
    const result = jsonToCharacter({
      kind: 'character',
      name: 'Native',
      description: 'note',
      greeting: 'hi',
      scenario: 'somewhere',
      sampleChat: 'chat',
      persona: { kind: 'text', attributes: { text: ['calm'] } },
      tags: ['a'],
      alternateGreetings: ['alt'],
    })

    expect(result.name).toBe('Native')
    expect(personaText(result)).toBe('calm')
    expect(result.tags).toEqual(['a'])
    expect(result.alternateGreetings).toEqual(['alt'])
  })

  it('reads a TextGen (ooba) character', () => {
    const result = jsonToCharacter({
      char_name: 'Ooba',
      char_greeting: 'hello',
      char_persona: 'grumpy',
      world_scenario: 'a tavern',
      example_dialogue: 'x',
    })

    expect(result.name).toBe('Ooba')
    expect(result.greeting).toBe('hello')
    expect(personaText(result)).toBe('grumpy')
    expect(result.scenario).toBe('a tavern')
  })

  it('reads a TavernAI V1 character', () => {
    const result = jsonToCharacter({
      name: 'V1',
      first_mes: 'greetings',
      description: 'desc',
      personality: 'bold',
      scenario: 'here',
      mes_example: 'x',
    })

    expect(result.name).toBe('V1')
    // V1 has no dedicated persona field, so description and personality are joined.
    expect(personaText(result)).toBe('desc\nbold')
  })

  describe('Character Card V2', () => {
    const card = (data: Record<string, unknown> = {}) => ({
      spec: 'chara_card_v2',
      spec_version: '2.0',
      name: 'V2',
      data: {
        name: 'V2',
        description: 'desc',
        personality: 'bold',
        first_mes: 'greetings',
        scenario: 'here',
        mes_example: 'x',
        creator_notes: 'notes',
        system_prompt: 'sys',
        post_history_instructions: 'post',
        alternate_greetings: ['alt1', 'alt2'],
        tags: ['t1'],
        creator: 'author',
        character_version: '1.0',
        ...data,
      },
    })

    it('maps the V2 fields', () => {
      const result = jsonToCharacter(card())
      expect(result.name).toBe('V2')
      // creator_notes is the library note; description feeds the persona.
      expect(result.description).toBe('notes')
      expect(result.systemPrompt).toBe('sys')
      expect(result.postHistoryInstructions).toBe('post')
      expect(result.alternateGreetings).toEqual(['alt1', 'alt2'])
      expect(result.tags).toEqual(['t1'])
      expect(result.creator).toBe('author')
      expect(result.characterVersion).toBe('1.0')
    })

    it('trusts a stored Agnai persona when it still matches the description', () => {
      const persona: AppSchema.Persona = { kind: 'wpp', attributes: { mood: ['calm'] } }
      const result = jsonToCharacter(
        card({
          description: formatCharacter('V2', persona),
          extensions: { agnai: { persona } },
        })
      )

      expect(result.persona).toEqual(persona)
    })

    it('rebuilds the persona when the card was edited elsewhere since', () => {
      const persona: AppSchema.Persona = { kind: 'wpp', attributes: { mood: ['calm'] } }
      const result = jsonToCharacter(
        card({
          description: 'someone rewrote this by hand',
          extensions: { agnai: { persona } },
        })
      )

      expect(result.persona.kind).toBe('text')
      expect(personaText(result)).toBe('someone rewrote this by hand\nbold')
    })

    it('carries the character book across', () => {
      const result = jsonToCharacter(
        card({
          character_book: {
            name: 'Hero lore',
            entries: [
              { keys: ['sword'], content: 'A blade of note.', insertion_order: 3, enabled: true },
            ],
          },
        })
      )

      expect(result.unsupported).not.toContain('character book')
      expect(result.characterBook?.name).toBe('Hero lore')
      expect(result.characterBook?.entries).toEqual([
        expect.objectContaining({
          keywords: ['sword'],
          entry: 'A blade of note.',
          weight: 3,
          enabled: true,
        }),
      ])
    })

    it('reports a book that carried nothing usable', () => {
      // Empty, and an entry with no keyword can never trigger, so neither survives.
      const empty = jsonToCharacter(card({ character_book: { entries: [] } }))
      const dead = jsonToCharacter(card({ character_book: { entries: [{ content: 'orphan' }] } }))

      expect(empty.unsupported).toContain('character book')
      expect(empty.characterBook).toBeUndefined()
      expect(dead.unsupported).toContain('character book')
      expect(dead.characterBook).toBeUndefined()
    })

    it('reports V3 assets a bare card cannot carry', () => {
      // Only a CHARX archive holds the files; a plain V3 card just names them.
      const v3 = {
        ...card({ assets: [{ name: 'smiling', uri: 'embeded://a.png' }] }),
        spec: 'chara_card_v3',
      }
      expect(jsonToCharacter(v3).unsupported).toContain('Character Card V3 assets')
    })

    it('says nothing about assets on a V3 card that declares none', () => {
      const v3 = { ...card(), spec: 'chara_card_v3' }
      expect(jsonToCharacter(v3).unsupported).toEqual([])
    })

    it('reports nothing when there is nothing to report', () => {
      expect(jsonToCharacter(card()).unsupported).toEqual([])
    })
  })

  it('reads a Charas character', () => {
    const result = jsonToCharacter({
      name: 'Charas',
      first_mes: 'hi',
      personality: 'sly',
      extensions: { charas: true },
      data: { system_prompt: 'sys', tags: ['c'], creator: 'someone' },
    })

    expect(result.name).toBe('Charas')
    expect(result.systemPrompt).toBe('sys')
    expect(result.tags).toEqual(['c'])
  })

  describe('character book normalisation', () => {
    const withBook = (book: unknown) =>
      jsonToCharacter({
        spec: 'chara_card_v2',
        data: { name: 'Booked', character_book: book },
      }).characterBook

    it('fills in the fields the server requires but a card may omit', () => {
      const [entry] = withBook({ entries: [{ keys: ['x'], content: 'y' }] })!.entries

      expect(entry).toEqual(
        expect.objectContaining({
          name: 'Unnamed',
          priority: 100,
          weight: 100,
          // A card that never mentions `enabled` means the entry is live.
          enabled: true,
        })
      )
    })

    it('keeps a deliberate zero rather than treating it as missing', () => {
      const book = withBook({ entries: [{ keys: ['x'], content: 'y', insertion_order: 0 }] })!
      expect(book.entries[0].weight).toBe(0)
    })

    it('keeps an entry disabled only when the card says so', () => {
      const book = withBook({
        entries: [
          { keys: ['on'], content: 'a', enabled: true },
          { keys: ['off'], content: 'b', enabled: false },
        ],
      })!

      expect(book.entries.map((e) => e.enabled)).toEqual([true, false])
    })

    it('keeps a keywordless entry the card marked constant', () => {
      const book = withBook({
        entries: [
          { keys: [], content: 'always here', constant: true },
          { keys: [], content: 'never fires' },
        ],
      })!

      expect(book.entries).toHaveLength(1)
      expect(book.entries[0]).toMatchObject({ entry: 'always here', constant: true })
    })

    it('drops entries that could never fire and keeps the rest', () => {
      const book = withBook({
        entries: [
          { keys: [], content: 'no keyword' },
          { keys: ['blank'], content: '   ' },
          { keys: ['  ', 'kept'], content: 'usable' },
        ],
      })!

      expect(book.entries).toHaveLength(1)
      // Blank keywords are stripped rather than sent as empty strings.
      expect(book.entries[0].keywords).toEqual(['kept'])
    })

    it('names an unnamed book after the character', () => {
      expect(withBook({ entries: [{ keys: ['x'], content: 'y' }] })!.name).toBe('Booked lore')
    })

    it('reads a native book, whose entries use the Agnai field names', () => {
      const book = jsonToCharacter({
        kind: 'character',
        name: 'Native',
        persona: { kind: 'text', attributes: { text: [''] } },
        greeting: '',
        scenario: '',
        characterBook: {
          name: 'Kept',
          entries: [
            { name: 'e', keywords: ['k'], entry: 'text', priority: 5, weight: 6, enabled: true },
          ],
        },
      }).characterBook!

      expect(book.name).toBe('Kept')
      expect(book.entries[0]).toEqual(
        expect.objectContaining({ keywords: ['k'], entry: 'text', priority: 5, weight: 6 })
      )
    })

    it('normalises entry text the same way it normalises the character', () => {
      const book = withBook({ entries: [{ keys: ['x'], content: 'a\\nb' }] })!
      expect(book.entries[0].entry).toBe('a\nb')
    })

    it('leaves the ids to the save, rather than keeping the converter placeholders', () => {
      const book = withBook({ entries: [{ keys: ['x'], content: 'y' }] })!
      expect(book._id).toBe('')
      expect(book.userId).toBe('')
    })
  })

  describe('normalisation', () => {
    it('unescapes literal \\n sequences', () => {
      const result = jsonToCharacter({ char_name: 'X', char_greeting: 'a\\nb' })
      expect(result.greeting).toBe('a\nb')
    })

    it('rewrites the You: convention to the user placeholder', () => {
      const result = jsonToCharacter({ char_name: 'X', example_dialogue: 'You: hi\nYou: again' })
      expect(result.sampleChat).toBe('{{user}}: hi\n{{user}}: again')
    })
  })

  describe('rejection', () => {
    it('rejects an unrecognised shape', () => {
      expect(() => jsonToCharacter({ totally: 'unrelated' })).toThrow(/Unrecognised/)
    })

    it('rejects a card with no name', () => {
      expect(() => jsonToCharacter({ char_name: '   ', char_greeting: 'x' })).toThrow(/no name/)
    })
  })
})

describe('characterToJson', () => {
  const character = {
    _id: 'char-1',
    kind: 'character',
    userId: 'user-1',
    name: 'Aria',
    description: 'a note',
    greeting: 'hello',
    scenario: '',
    sampleChat: '',
    persona: { kind: 'text', attributes: { text: ['calm'] } },
    createdAt: '',
    updatedAt: '',
  } as unknown as AppSchema.Character

  it('strips the server id from a native export', () => {
    const json = JSON.parse(characterToJson(character, 'native'))
    expect(json._id).toBeUndefined()
    expect(json.name).toBe('Aria')
  })

  it('emits a Character Card V2 for a tavern export', () => {
    const json = JSON.parse(characterToJson(character, 'tavern'))
    expect(json.spec).toBe('chara_card_v2')
    expect(json.data.name).toBe('Aria')
    expect(json.data.creator_notes).toBe('a note')
  })

  it('round-trips through the importer', () => {
    const reimported = jsonToCharacter(JSON.parse(characterToJson(character, 'tavern')))
    expect(reimported.name).toBe('Aria')
    expect(reimported.greeting).toBe('hello')
    // The exporter stores the persona in extensions, so it survives losslessly.
    expect(reimported.persona).toEqual(character.persona)
  })
})

describe('embedCardInPng', () => {
  /** Smallest valid PNG: 1x1, opaque. */
  const BASE_PNG = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    ),
    (c) => c.charCodeAt(0)
  )

  const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10]

  it('produces a valid PNG', () => {
    const out = embedCardInPng(BASE_PNG, '{"a":1}')
    expect([...out.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
  })

  it('keeps IEND last, which a PNG requires', async () => {
    const extract = (await import('png-chunks-extract')).default
    const chunks = extract(embedCardInPng(BASE_PNG, '{"a":1}'))
    expect(chunks.at(-1)?.name).toBe('IEND')
  })

  it('stores the json base64-encoded in a chara tEXt chunk', async () => {
    const extract = (await import('png-chunks-extract')).default
    const pngText = await import('png-chunk-text')

    const json = JSON.stringify({ name: 'Aria', note: 'unicode ok — ✓' })
    const chunks = extract(embedCardInPng(BASE_PNG, json))
    const entry = chunks.filter((c) => c.name === 'tEXt').map((c) => pngText.decode(c.data))[0]

    expect(entry.keyword).toBe('chara')
    expect(
      new TextDecoder().decode(Uint8Array.from(atob(entry.text), (c) => c.charCodeAt(0)))
    ).toBe(json)
  })

  it('replaces an existing card rather than appending a second one', async () => {
    const extract = (await import('png-chunks-extract')).default
    const once = embedCardInPng(BASE_PNG, '{"first":true}')
    const twice = embedCardInPng(once, '{"second":true}')

    const textChunks = extract(twice).filter((c) => c.name === 'tEXt')
    expect(textChunks).toHaveLength(1)
  })
})

describe('CHARX archives', () => {
  /** Builds a `.charx` the same way one is read: a ZIP of `card.json` plus its asset files. */
  async function makeCharx(card: unknown, files: Record<string, Uint8Array> = {}) {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('card.json', JSON.stringify(card))
    for (const [path, bytes] of Object.entries(files)) zip.file(path, bytes)
    const blob = await zip.generateAsync({ type: 'uint8array' })
    return new File([blob as BlobPart], 'hero.charx')
  }

  const PIXEL = Uint8Array.from([137, 80, 78, 71])

  const v3 = (assets: unknown[]) => ({
    spec: 'chara_card_v3',
    spec_version: '3.0',
    data: { name: 'Charx Hero', description: 'desc', first_mes: 'hi', assets },
  })

  it('reads the card and unpacks the assets it names', async () => {
    const file = await makeCharx(
      v3([{ type: 'emotion', name: 'smiling', uri: 'embeded://assets/smile.png', ext: 'png' }]),
      { 'assets/smile.png': PIXEL }
    )

    const result = await parseCharacterFile(file)
    expect(result.name).toBe('Charx Hero')
    expect(result.assets).toHaveLength(1)
    expect(result.assets?.[0].name).toBe('smiling')
    expect(result.assets?.[0].blob.type).toBe('image/png')
    // The archive carried them, so the "not carried over" notice must not still claim otherwise.
    expect(result.unsupported).not.toContain('Character Card V3 assets')
  })

  it('takes the main icon as the avatar rather than as a shown image', async () => {
    const file = await makeCharx(
      v3([
        { type: 'icon', name: 'main', uri: 'embeded://assets/main.png', ext: 'png' },
        { type: 'emotion', name: 'smiling', uri: 'embeded://assets/smile.png', ext: 'png' },
      ]),
      { 'assets/main.png': PIXEL, 'assets/smile.png': PIXEL }
    )

    const result = await parseCharacterFile(file)
    expect(result.avatar).toBeInstanceOf(File)
    expect(result.assets?.map((asset) => asset.name)).toEqual(['smiling'])
  })

  it('reports assets that live outside the archive instead of inventing them', async () => {
    // `ccdefault:` and remote URLs are legal in V3 and are not in the file.
    const file = await makeCharx(
      v3([
        { type: 'emotion', name: 'remote', uri: 'https://example.com/x.png', ext: 'png' },
        { type: 'emotion', name: 'default', uri: 'ccdefault:', ext: 'png' },
      ])
    )

    const result = await parseCharacterFile(file)
    expect(result.assets).toBeUndefined()
    expect(result.unsupported.join(' ')).toContain('2 asset(s) stored outside the archive')
  })

  it('skips an asset whose file is missing from the archive', async () => {
    const file = await makeCharx(
      v3([{ type: 'emotion', name: 'gone', uri: 'embeded://assets/gone.png', ext: 'png' }])
    )

    const result = await parseCharacterFile(file)
    expect(result.assets).toBeUndefined()
    // Counted apart from an external URI: a broken archive is a different problem.
    expect(result.unsupported).toContain('1 asset(s) missing from the archive')
  })

  it('imports an archive with hundreds of files', async () => {
    // The regression this guards: the entry count was once capped at 256, and a card with a
    // full emotion set failed outright.
    const count = 400
    const assets = Array.from({ length: count }, (_, i) => ({
      type: 'emotion',
      name: `emotion-${i}`,
      uri: `embeded://assets/e${i}.png`,
      ext: 'png',
    }))
    const files = Object.fromEntries(assets.map((_, i) => [`assets/e${i}.png`, PIXEL]))

    const result = await parseCharacterFile(await makeCharx(v3(assets), files))
    expect(result.assets).toHaveLength(count)
    expect(result.unsupported).toEqual([])
  })

  it('finds an asset whose entry sits under a directory prefix', async () => {
    // Archives in the wild wrap everything in a top-level folder; the URI stays relative.
    const file = await makeCharx(
      v3([{ type: 'emotion', name: 'smiling', uri: 'embeded://assets/smile.png', ext: 'png' }]),
      { 'hero/assets/smile.png': PIXEL }
    )

    const result = await parseCharacterFile(file)
    expect(result.assets).toHaveLength(1)
  })

  it('imports a large asset rather than refusing it on size', async () => {
    // No size cap at all: the caps only ever cost a self-hoster assets they wanted, and the
    // one real ceiling is the server's JSON body limit, which is configurable.
    const big = new Uint8Array(9 * 1024 * 1024)
    const file = await makeCharx(
      v3([{ type: 'emotion', name: 'huge', uri: 'embeded://assets/huge.png', ext: 'png' }]),
      { 'assets/huge.png': big }
    )

    const result = await parseCharacterFile(file)
    expect(result.assets).toHaveLength(1)
    expect(result.unsupported).toEqual([])
  })

  it('imports a whole emotion set without complaint', async () => {
    const each = new Uint8Array(512 * 1024)
    const assets = Array.from({ length: 200 }, (_, i) => ({
      type: 'emotion',
      name: `e${i}`,
      uri: `embeded://assets/e${i}.png`,
      ext: 'png',
    }))
    const files = Object.fromEntries(assets.map((_, i) => [`assets/e${i}.png`, each]))

    const result = await parseCharacterFile(await makeCharx(v3(assets), files))
    expect(result.assets).toHaveLength(200)
    expect(result.unsupported).toEqual([])
  })

  it('rejects an archive with no card.json', async () => {
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    zip.file('readme.txt', 'nothing here')
    const blob = await zip.generateAsync({ type: 'uint8array' })

    await expect(parseCharacterFile(new File([blob as BlobPart], 'bad.charx'))).rejects.toThrow(
      /no card\.json/
    )
  })

  it('still carries the character book a CHARX card declares', async () => {
    const card = v3([])
    ;(card.data as any).character_book = {
      name: 'Charx lore',
      entries: [{ keys: ['relic'], content: 'CHARX-BOOK-FACT' }],
    }

    const result = await parseCharacterFile(await makeCharx(card))
    expect(result.characterBook?.entries[0].entry).toBe('CHARX-BOOK-FACT')
  })
})
