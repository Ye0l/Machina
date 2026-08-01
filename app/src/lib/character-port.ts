import extractPngChunks from 'png-chunks-extract'
import encodePngChunks from 'png-chunks-encode'
import * as pngText from 'png-chunk-text'
import { load as loadExif } from 'exifreader'
import { exportCharacter, formatCharacter } from '/common/characters'
import { characterBookToNative, type CharacterBook } from '/common/memory'
import type { AppSchema } from '/common/types'

/**
 * Character card import and export.
 *
 * Ported from the legacy client (`web/pages/Character/port.ts`, `card-utils.ts` and the
 * download helpers in `util.ts`), with one deliberate difference: everything here works in
 * `Uint8Array`. The legacy code used `Buffer`, which Parcel polyfilled and Vite does not.
 *
 * Export formats come from `common/characters.ts` (`exportCharacter`), which is the shared
 * layer both frontends already use, so no new format definition is introduced here.
 */

export const IMPORT_EXTENSIONS = ['json', 'png', 'apng', 'jpg', 'jpeg', 'webp'] as const
export const IMPORT_ACCEPT = '.json,.png,.apng,.jpg,.jpeg,.webp'

/** The fields the Svelte character editor can represent. */
export type ImportedCharacter = {
  name: string
  description: string
  greeting: string
  persona: AppSchema.Persona
  scenario: string
  sampleChat: string
  systemPrompt: string
  postHistoryInstructions: string
  alternateGreetings: string[]
  tags: string[]
  creator: string
  characterVersion: string
  /** Present when the source was an image card; becomes the character's avatar. */
  avatar?: File
  /** The card's own lore, ready to be saved as `character.characterBook`. */
  characterBook?: AppSchema.MemoryBook
  /**
   * Recognised data the editor has no home for, reported to the user rather than dropped
   * silently.
   */
  unsupported: string[]
}

export type ExportFormat = 'native' | 'tavern' | 'ooba'

/* ------------------------------------------------------------------ byte helpers */

const bytesFromBase64 = (base64: string) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))

function base64FromBytes(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const utf8FromBytes = (bytes: Uint8Array) => new TextDecoder().decode(bytes)
const bytesFromUtf8 = (value: string) => new TextEncoder().encode(value)

/* ---------------------------------------------------------------------- importing */

const ensureArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

const textPersona = (...parts: Array<string | undefined>): AppSchema.Persona => ({
  kind: 'text',
  attributes: { text: [parts.filter(Boolean).join('\n')] },
})

type ImportFormat = 'agnai' | 'tavernV2' | 'tavern' | 'ooba' | 'charas'

function detectFormat(json: any): ImportFormat {
  if (json.kind === 'character' || isNativeCharacter(json)) return 'agnai'
  if (json.extensions?.charas) return 'charas'
  if ('char_name' in json) return 'ooba'
  if (json.spec === 'chara_card_v2' || json.spec === 'chara_card_v3') return 'tavernV2'
  if ('mes_example' in json) return 'tavern'
  throw new Error('Unrecognised character format')
}

const isNativeCharacter = (json: any) =>
  'name' in json && 'persona' in json && 'greeting' in json && 'scenario' in json

/**
 * Normalises escaped newlines and the `You:` convention the same way the legacy importer
 * did, so cards written for other frontends read correctly here.
 */
function sanitise<T extends Record<string, any>>(value: T): T {
  for (const key of Object.keys(value)) {
    const field = value[key]
    if (typeof field !== 'string') continue
    value[key as keyof T] = field
      .replace(/\\n/g, '\n')
      .replace(/^You:/i, '{{user}}:')
      .replace(/\nYou:/g, '\n{{user}}:') as T[keyof T]
  }
  return value
}

/** Falls back only for a missing or unparseable value, so a deliberate `0` survives. */
function numberOr(value: unknown, fallback: number) {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Reads a card's bundled lore into the shape `character.characterBook` expects.
 *
 * Two entry shapes reach here: the V2 card's (`keys`/`content`), which `characterBookToNative`
 * converts, and Agnai's own (`keywords`/`entry`), which native exports carry as-is. Either way
 * the result is re-checked field by field, because the fields the converter leaves optional are
 * all required by the server's book validator (`srv/api/memory/index.ts`), and a hand-written
 * card is under no obligation to supply them.
 *
 * Returns undefined when nothing usable survives, so the caller can still report the book as
 * dropped rather than saving one that could never match.
 */
function readCharacterBook(raw: any, characterName: string): AppSchema.MemoryBook | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const rawEntries = ensureArray<any>(raw.entries)
  if (!rawEntries.length) return undefined

  const isNative = rawEntries.some((entry) => entry && 'keywords' in entry)
  const book: AppSchema.MemoryBook = isNative
    ? raw
    : characterBookToNative({
        ...raw,
        entries: rawEntries,
        extensions: raw.extensions ?? {},
      } as CharacterBook)

  const entries = book.entries
    .map((source: any) => {
      const entry = sanitise({ ...source })
      return {
        ...entry,
        name: String(entry.name ?? '').trim() || 'Unnamed',
        entry: String(entry.entry ?? ''),
        keywords: ensureArray<unknown>(entry.keywords)
          .map((keyword) => String(keyword).trim())
          .filter(Boolean),
        priority: numberOr(entry.priority, 100),
        weight: numberOr(entry.weight, 100),
        // Only an explicit `false` disables an entry; cards routinely omit the field entirely.
        enabled: entry.enabled !== false,
      }
    })
    // An entry with no keyword can never trigger unless the card marked it constant, and one
    // with no text has nothing to insert either way.
    .filter((entry) => (entry.keywords.length > 0 || entry.constant) && entry.entry.trim())

  if (!entries.length) return undefined

  return {
    ...book,
    kind: 'memory',
    // Assigned by the character save; the converter's placeholder ids would be misleading here.
    _id: '',
    userId: '',
    // Read from the card, not from `book`: the converter substitutes a generic placeholder for
    // a missing name, and the character's own name is the more useful label.
    name: String(raw.name ?? '').trim() || `${characterName} lore`,
    description: book.description ?? '',
    entries,
  }
}

export function jsonToCharacter(json: any): ImportedCharacter {
  const format = detectFormat(json)
  const unsupported: string[] = []
  let rawBook: unknown

  const base = {
    name: '',
    description: '',
    greeting: '',
    persona: textPersona(''),
    scenario: '',
    sampleChat: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    alternateGreetings: [] as string[],
    tags: [] as string[],
    creator: '',
    characterVersion: '',
  }

  let parsed: typeof base

  if (format === 'agnai') {
    parsed = {
      ...base,
      name: json.name ?? '',
      description: json.description ?? '',
      greeting: json.greeting ?? '',
      persona: json.persona ?? textPersona(''),
      scenario: json.scenario ?? '',
      sampleChat: json.sampleChat ?? '',
      systemPrompt: json.systemPrompt ?? '',
      postHistoryInstructions: json.postHistoryInstructions ?? '',
      alternateGreetings: ensureArray<string>(json.alternateGreetings),
      tags: ensureArray<string>(json.tags),
      creator: json.creator ?? '',
      characterVersion: json.characterVersion ?? '',
    }
    rawBook = json.characterBook
  } else if (format === 'ooba') {
    parsed = {
      ...base,
      name: json.char_name ?? '',
      greeting: json.char_greeting ?? '',
      persona: textPersona(json.char_persona),
      scenario: json.world_scenario ?? '',
      sampleChat: json.example_dialogue ?? '',
    }
  } else if (format === 'tavernV2') {
    const data = json.data ?? {}
    const agnai = data.extensions?.agnai

    /*
     * A card can carry a lossless Agnai persona in its extensions, but another editor may
     * have changed `description` since it was written. Trust the structured persona only
     * when re-formatting it still reproduces the card's description.
     */
    const personaIsCurrent =
      agnai?.persona !== undefined && formatCharacter(data.name, agnai.persona) === data.description

    parsed = {
      ...base,
      name: data.name ?? '',
      description: data.creator_notes ?? '',
      greeting: data.first_mes ?? '',
      persona: personaIsCurrent ? agnai.persona : textPersona(data.description, data.personality),
      scenario: data.scenario ?? '',
      sampleChat: data.mes_example ?? '',
      systemPrompt: data.system_prompt ?? '',
      postHistoryInstructions: data.post_history_instructions ?? '',
      alternateGreetings: ensureArray<string>(data.alternate_greetings),
      tags: ensureArray<string>(data.tags),
      creator: data.creator ?? '',
      characterVersion: data.character_version ?? '',
    }
    rawBook = data.character_book
    if (json.spec === 'chara_card_v3') unsupported.push('Character Card V3 assets')
  } else if (format === 'charas') {
    const data = json.data ?? {}
    parsed = {
      ...base,
      name: json.name ?? '',
      description: json.description ?? '',
      greeting: json.first_mes ?? '',
      persona: textPersona(json.personality),
      scenario: json.scenario ?? '',
      sampleChat: json.mes_example ?? '',
      systemPrompt: data.system_prompt ?? '',
      postHistoryInstructions: data.post_history_instructions ?? '',
      alternateGreetings: ensureArray<string>(data.alternate_greetings),
      tags: ensureArray<string>(data.tags),
      creator: data.creator ?? '',
    }
  } else {
    parsed = {
      ...base,
      name: json.name ?? '',
      greeting: json.first_mes ?? '',
      persona: textPersona(json.description, json.personality),
      scenario: json.scenario ?? '',
      sampleChat: json.mes_example ?? '',
      alternateGreetings: ensureArray<string>(json.data?.alternate_greetings),
    }
    rawBook = json.data?.character_book
  }

  if (!parsed.name.trim()) throw new Error('The character card has no name')

  const characterBook = readCharacterBook(rawBook, parsed.name.trim())
  if (rawBook && !characterBook) unsupported.push('character book')

  return { ...sanitise(parsed), characterBook, unsupported }
}

/** Reads the `chara` tEXt chunk that PNG/APNG/JPEG cards store their JSON in. */
function readPngCard(bytes: Uint8Array): string {
  const chunks = extractPngChunks(bytes)
  if (!chunks.length) throw new Error('The image contains no PNG chunks')

  const [entry] = chunks
    .filter((chunk) => chunk.name === 'tEXt')
    .map((chunk) => pngText.decode(chunk.data))
  if (!entry) {
    throw new Error(
      `The image has no embedded character data (chunks: ${chunks.map((c) => c.name).join(', ')})`
    )
  }

  return utf8FromBytes(bytesFromBase64(entry.text))
}

/** WEBP cards keep the same JSON in the EXIF `UserComment` field. */
function readWebpCard(bytes: Uint8Array): string {
  const exif = loadExif(bytes as unknown as ArrayBuffer)
  const data = (exif.UserComment as any)?.description
  if (!data) throw new Error('The image has no embedded character data')

  // Older cards store the JSON directly; newer Tavern versions store a byte array.
  if (typeof data === 'string' && data.trimStart().startsWith('{')) return data
  return utf8FromBytes(Uint8Array.from(String(data).split(',').map(Number)))
}

export async function parseCharacterFile(file: File): Promise<ImportedCharacter> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (extension === 'json') {
    const parsed = jsonToCharacter(JSON.parse(await file.text()))
    return parsed
  }

  if (!(IMPORT_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new Error(`Unsupported file type ".${extension}"`)
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const raw = extension === 'webp' ? readWebpCard(bytes) : readPngCard(bytes)

  // The image the card travelled in becomes the avatar.
  return { ...jsonToCharacter(JSON.parse(raw)), avatar: file }
}

/* ---------------------------------------------------------------------- exporting */

export function characterToJson(character: AppSchema.Character, format: ExportFormat): string {
  if (format === 'native') {
    const { _id, ...rest } = character
    return JSON.stringify(rest, null, 2)
  }

  return JSON.stringify(exportCharacter({ ...character }, format), null, 2)
}

/**
 * Rewrites a PNG so it carries the character JSON in a `chara` tEXt chunk.
 *
 * Any existing tEXt chunks are dropped first, and the new one is inserted before IEND,
 * which must stay last for the file to remain valid.
 */
export function embedCardInPng(png: Uint8Array, json: string): Uint8Array {
  const chunks = extractPngChunks(png).filter((chunk) => chunk.name !== 'tEXt')
  const encoded = base64FromBytes(bytesFromUtf8(json))
  const last = chunks.length - 1

  return encodePngChunks([...chunks.slice(0, last), pngText.encode('chara', encoded), chunks[last]])
}

/** Re-encodes any image to PNG, which is the only format that can carry a tEXt chunk. */
function toPngBytes(source: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(source)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Could not process the avatar image'))
      ctx.drawImage(image, 0, 0)
      canvas.toBlob(async (blob) => {
        if (!blob) return reject(new Error('Could not convert the avatar to PNG'))
        resolve(new Uint8Array(await blob.arrayBuffer()))
      }, 'image/png')
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load the avatar image'))
    }

    image.src = url
  })
}

/**
 * A card image for characters with no avatar. A valid PNG is still required, because the
 * JSON rides inside its chunk list.
 */
function placeholderPng(name: string): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 600
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Could not create a card image'))

  ctx.fillStyle = '#151a23'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#a78bfa'
  ctx.font = 'bold 44px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name.slice(0, 16), canvas.width / 2, canvas.height / 2)

  return new Promise((resolve, reject) =>
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Could not create a card image'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/png')
  )
}

/**
 * Builds a Tavern-style PNG card. `avatarUrl` is fetched rather than drawn from an <img>
 * so an already-PNG avatar keeps its exact bytes instead of being re-encoded.
 */
export async function buildCharacterCard(
  character: AppSchema.Character,
  avatarUrl: string | undefined
): Promise<Blob> {
  const json = characterToJson(character, 'tavern')

  let png: Uint8Array
  if (!avatarUrl) {
    png = await placeholderPng(character.name)
  } else {
    const res = await fetch(avatarUrl)
    if (!res.ok) throw new Error(`Could not fetch the avatar (${res.status})`)
    const blob = await res.blob()
    png =
      blob.type === 'image/png' ? new Uint8Array(await blob.arrayBuffer()) : await toPngBytes(blob)
  }

  return new Blob([embedCardInPng(png, json)], { type: 'image/png' })
}

/** Triggers a browser download without leaking the object URL. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
