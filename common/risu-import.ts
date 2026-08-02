import { presetDefaults } from './default-preset'
import { withRisuToggleConfig } from './risu-toggles'
import type { AppSchema } from './types/schema'

const MAX_PRESET_BYTES = 16 * 1024 * 1024
const RPACK_DECODE_MAP_BASE64 =
  'LPeEi8ll+7afrrMDLQFpdB/ko+zuXDQhk0oPauJiAp4inP08/HHHxq1ZZwVwbYpEEvokhl+v0XpHzv5QY91RBm8Y4FKoCZ1Wc0y4U2zDoA4Zzz4NfgcyaEbqSPmZLqukSSBeVTU4DLzTsVgWeSgKGuHyzcQ526K6YHJ2fZXvf8jA3jeUv7UUgZIlRazn9WanKzZawRPjSzrojYMbfCewmkLrh6rcVI54JtJXKdS3+C+PiXXwQXfCHv/YFRHlBJcX8zHQmwDXyrRPKjvZsmvaXaE/MGG9kT1O5t++TYKMHSMQmGT0hTN7kEO7qYjx1qUc9sxuuVsLlu3V6cXLCKaAQA=='

type RisuPreset = Record<string, any>
type Role = 'system' | 'user' | 'bot'

type ConvertedPrompt = {
  template: string
  prefill: string
  warnings: string[]
}

export function isRisuPresetFilename(filename: string) {
  const lower = filename.toLowerCase()
  return lower.endsWith('.risup') || lower.endsWith('.risupreset')
}

export async function importRisuPreset(
  bytes: Uint8Array,
  filename: string
): Promise<AppSchema.GenSettings> {
  if (bytes.byteLength > MAX_PRESET_BYTES) throw new Error('RisuAI preset is too large')

  const packed = filename.toLowerCase().endsWith('.risup') ? decodeRPack(bytes) : bytes
  const outer = decodeMessagePack(await decompressGzip(packed)) as RisuPreset
  if (outer?.type !== 'preset' || ![0, 2].includes(outer?.presetVersion)) {
    throw new Error('Unsupported RisuAI preset format')
  }

  const encrypted = outer.preset ?? outer.pres
  if (!(encrypted instanceof Uint8Array)) throw new Error('RisuAI preset payload is missing')

  const preset = decodeMessagePack(await decryptPayload(encrypted)) as RisuPreset
  if (!preset || typeof preset !== 'object' || !Array.isArray(preset.promptTemplate)) {
    throw new Error('RisuAI preset payload is invalid')
  }

  return convertPreset(preset)
}

function convertPreset(preset: RisuPreset): AppSchema.GenSettings {
  const prompt = convertPromptTemplate(preset.promptTemplate, preset)
  const model = firstString(
    preset.customProxyRequestModel,
    preset.proxyRequestModel,
    preset.openrouterRequestModel,
    preset.aiModel
  )

  const imported: AppSchema.GenSettings = {
    ...presetDefaults,
    name: `${firstString(preset.name, 'RisuAI Preset')} - Imported`,
    description: importDescription(preset, prompt.warnings),
    service: 'third-party',
    thirdPartyFormat: 'openai-chat',
    thirdPartyModel: model === 'custom' ? '' : model,
    presetMode: 'advanced',
    useAdvancedPrompt: 'no-validation',
    gaslight: prompt.template,
    prefill: prompt.prefill,
    temp: isDisabled(preset.temperature)
      ? presetDefaults.temp
      : numberOr(preset.temperature, 80) / 100,
    maxTokens: positiveInt(preset.maxResponse, presetDefaults.maxTokens),
    maxContextLength: positiveInt(preset.maxContext, presetDefaults.maxContextLength),
    topP: normalizeDisabled(numberOr(preset.top_p, presetDefaults.topP), presetDefaults.topP),
    topK: normalizeDisabled(numberOr(preset.top_k, presetDefaults.topK), presetDefaults.topK),
    topA: normalizeDisabled(numberOr(preset.top_a, presetDefaults.topA), presetDefaults.topA),
    minP: normalizeDisabled(numberOr(preset.min_p, presetDefaults.minP), presetDefaults.minP),
    repetitionPenalty: normalizeDisabled(
      numberOr(preset.repetition_penalty, presetDefaults.repetitionPenalty),
      presetDefaults.repetitionPenalty
    ),
    frequencyPenalty: normalizePenalty(preset.frequencyPenalty),
    presencePenalty: normalizePenalty(preset.PresensePenalty),
    systemPrompt: firstString(preset.mainPrompt),
    ultimeJailbreak: firstString(preset.jailbreak),
    jinjaTemplate: firstString(preset.JinjaTemplate),
    jinjaEnabled: !!preset.useInstructPrompt && !!preset.JinjaTemplate,
    streamResponse: true,
  }

  const thinkingTokens = positiveInt(preset.thinkingTokens, 0)
  if (thinkingTokens > 0 && preset.thinkingType !== 'none') {
    imported.reasoning = {
      enabled: true,
      effort: 'custom',
      maxTokens: Math.min(thinkingTokens, imported.maxTokens),
      exclude: true,
      start: '<think>',
      end: '</think>',
    }
  }

  return withRisuToggleConfig(
    imported,
    firstString(preset.customPromptTemplateToggle),
    prompt.template
  ) as AppSchema.GenSettings
}

function importDescription(preset: RisuPreset, warnings: string[]) {
  const details = [
    'Imported from a RisuAI preset.',
    'Dynamic toggles are preserved and evaluated per chat.',
    'Chat ranges, author notes, and embedded module positions are converted.',
    'Cache boundaries are flattened because this Agnai client currently sends one prompt string; cache-block content is preserved.',
  ]
  const provider = firstString(preset.currentPluginProvider)
  if (provider) details.push(`Original RisuAI provider: ${provider}`)
  if (warnings.length) details.push(`Conversion notes: ${warnings.join('; ')}`)
  return details.join('\n')
}

function convertPromptTemplate(items: any[], preset: RisuPreset): ConvertedPrompt {
  const blocks: Array<{ role: Role; text: string }> = []
  const warnings = new Set<string>()
  const positions = collectModulePositions(preset, items)
  let prefill = ''

  for (let index = 0; index < items.length; index++) {
    const item = items[index] ?? {}
    const role = normalizeRole(item.role)
    const text = resolvePositions(firstString(item.text), positions).trim()
    const inner = resolvePositions(firstString(item.innerFormat), positions)

    switch (item.type) {
      case 'plain':
        if (role === 'bot' && index === items.length - 1) prefill = text
        else pushBlock(blocks, role, text)
        break
      case 'persona':
        pushBlock(blocks, role, applySlot(inner, '{{impersonating}}'))
        break
      case 'description':
        pushBlock(blocks, role, applySlot(inner, '{{personality}}'))
        break
      case 'memory':
        pushBlock(blocks, role, applySlot(inner, '{{chat_embed}}'))
        break
      case 'lorebook':
        pushBlock(blocks, role, [text, '{{memory}}'].filter(Boolean).join('\n\n'))
        break
      case 'chat':
        pushBlock(
          blocks,
          role,
          [text, `{{history:${rangeBoundary(item.rangeStart, '0')}:${rangeBoundary(item.rangeEnd, 'end')}}}`]
            .filter(Boolean)
            .join('\n\n')
        )
        break
      case 'authornote': {
        const note = text || resolvePositions(firstString(item.defaultText), positions)
        if (note) pushBlock(blocks, role, note)
        break
      }
      case 'cache':
        if (text) pushBlock(blocks, role, text)
        warnings.add('cache boundary flattened')
        break
      case 'postEverything':
        if (text) pushBlock(blocks, role, text)
        break
      default:
        if (text) {
          warnings.add(`unknown block type ${String(item.type)}`)
          pushBlock(blocks, role, text)
        }
        break
    }
  }

  if (!blocks.some((block) => block.text.includes('{{personality}}'))) {
    pushBlock(blocks, 'system', '{{personality}}')
  }
  if (!blocks.some((block) => block.text.includes('{{history'))) {
    pushBlock(blocks, 'system', '{{history}}')
  }
  pushBlock(blocks, 'bot', '{{post}}')

  return {
    template: blocks
      .map((block) => `<${block.role}>\n${block.text.trim()}\n</${block.role}>`)
      .join('\n\n')
      .trim(),
    prefill,
    warnings: [...warnings],
  }
}

function collectModulePositions(preset: RisuPreset, items: any[]) {
  const positions = new Map<string, string>()
  const seen = new Set<unknown>()

  const visit = (value: unknown, hintedKey = '') => {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }

    const item = value as Record<string, any>
    const key = firstString(item.position, item.slot, item.key, item.id, item.name, hintedKey)
    const text = firstString(item.prompt, item.text, item.content, item.value)
    if (key && text) positions.set(key.replace(/^position::/i, ''), text)
    for (const [childKey, child] of Object.entries(item)) visit(child, childKey)
  }

  visit(preset.modules)
  visit(preset.promptModules)
  visit(preset.moduleData)
  for (const item of items) {
    const key = firstString(item?.position, item?.slot, item?.type2)
    if (key && /^m\d+$/i.test(key) && firstString(item?.text)) positions.set(key, item.text)
  }
  return positions
}

function resolvePositions(input: string, positions: Map<string, string>) {
  return input.replace(/{{position::([^{}]+)}}/gi, (_match, key) => {
    return positions.get(String(key).trim()) ?? ''
  })
}

function rangeBoundary(value: unknown, fallback: string) {
  if (value === 'end') return 'end'
  if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value))
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return value.trim()
  return fallback
}

function pushBlock(blocks: Array<{ role: Role; text: string }>, role: Role, value: string) {
  const text = value.trim()
  if (!text) return
  const previous = blocks.at(-1)
  if (previous?.role === role) previous.text += `\n\n${text}`
  else blocks.push({ role, text })
}

function normalizeRole(value: unknown): Role {
  if (value === 'user') return 'user'
  if (value === 'bot' || value === 'assistant') return 'bot'
  return 'system'
}

function applySlot(format: string, slot: string) {
  return format ? format.split('{{slot}}').join(slot) : slot
}

export function expandRisuHistoryRanges(
  template: string,
  messages: AppSchema.ChatMessage[],
  names: { user: string; bot: string }
) {
  const lines = messages
    .filter((message) => message.adapter !== 'image')
    .map((message) => `${message.name || (message.userId ? names.user : names.bot)}: ${message.msg}`)

  return template.replace(/{{history:([^{}:]+):([^{}:]+)}}/gi, (_match, rawStart, rawEnd) => {
    const start = historyBoundary(String(rawStart), lines.length, 0)
    const end = historyBoundary(String(rawEnd), lines.length, lines.length)
    return lines.slice(Math.min(start, end), Math.max(start, end)).join('\n')
  })
}

function historyBoundary(raw: string, length: number, fallback: number) {
  const value = raw.trim().toLowerCase()
  if (value === 'end') return length
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, Math.min(length, parsed < 0 ? length + parsed : parsed))
}

function decodeRPack(data: Uint8Array) {
  const map = decodeBase64(RPACK_DECODE_MAP_BASE64)
  const output = new Uint8Array(data.length)
  for (let index = 0; index < data.length; index++) output[index] = map[data[index]]
  return output
}

async function decompressGzip(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decompress RisuAI presets')
  }
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decryptPayload(data: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('risupreset'))
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
  const encrypted = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(12) },
    key,
    encrypted
  )
  return new Uint8Array(decrypted)
}

function decodeBase64(input: string) {
  const binary = atob(input)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeMessagePack(data: Uint8Array) {
  return new MessagePackDecoder(data).read()
}

class MessagePackDecoder {
  private offset = 0
  private view: DataView
  private decoder = new TextDecoder()

  constructor(private data: Uint8Array) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  read(): any {
    const head = this.uint8()
    if (head <= 0x7f) return head
    if (head >= 0xe0) return head - 0x100
    if ((head & 0xf0) === 0x80) return this.map(head & 0x0f)
    if ((head & 0xf0) === 0x90) return this.array(head & 0x0f)
    if ((head & 0xe0) === 0xa0) return this.string(head & 0x1f)

    switch (head) {
      case 0xc0:
        return null
      case 0xc2:
        return false
      case 0xc3:
        return true
      case 0xc4:
        return this.binary(this.uint8())
      case 0xc5:
        return this.binary(this.uint16())
      case 0xc6:
        return this.binary(this.uint32())
      case 0xc7:
        return this.extension(this.uint8())
      case 0xc8:
        return this.extension(this.uint16())
      case 0xc9:
        return this.extension(this.uint32())
      case 0xca: {
        const value = this.view.getFloat32(this.offset)
        this.offset += 4
        return value
      }
      case 0xcb: {
        const value = this.view.getFloat64(this.offset)
        this.offset += 8
        return value
      }
      case 0xcc:
        return this.uint8()
      case 0xcd:
        return this.uint16()
      case 0xce:
        return this.uint32()
      case 0xcf:
        return this.uint64()
      case 0xd0:
        return this.int8()
      case 0xd1:
        return this.int16()
      case 0xd2:
        return this.int32()
      case 0xd3:
        return this.int64()
      case 0xd4:
        return this.extension(1)
      case 0xd5:
        return this.extension(2)
      case 0xd6:
        return this.extension(4)
      case 0xd7:
        return this.extension(8)
      case 0xd8:
        return this.extension(16)
      case 0xd9:
        return this.string(this.uint8())
      case 0xda:
        return this.string(this.uint16())
      case 0xdb:
        return this.string(this.uint32())
      case 0xdc:
        return this.array(this.uint16())
      case 0xdd:
        return this.array(this.uint32())
      case 0xde:
        return this.map(this.uint16())
      case 0xdf:
        return this.map(this.uint32())
      default:
        throw new Error(`Unsupported MessagePack marker 0x${head.toString(16)}`)
    }
  }

  private uint8() {
    return this.data[this.offset++]
  }
  private int8() {
    const value = this.view.getInt8(this.offset)
    this.offset += 1
    return value
  }
  private uint16() {
    const value = this.view.getUint16(this.offset)
    this.offset += 2
    return value
  }
  private int16() {
    const value = this.view.getInt16(this.offset)
    this.offset += 2
    return value
  }
  private uint32() {
    const value = this.view.getUint32(this.offset)
    this.offset += 4
    return value
  }
  private int32() {
    const value = this.view.getInt32(this.offset)
    this.offset += 4
    return value
  }
  private uint64() {
    const value = this.view.getBigUint64(this.offset)
    this.offset += 8
    return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value
  }
  private int64() {
    const value = this.view.getBigInt64(this.offset)
    this.offset += 8
    return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value
  }
  private bytes(length: number) {
    const value = this.data.slice(this.offset, this.offset + length)
    this.offset += length
    return value
  }
  private string(length: number) {
    return this.decoder.decode(this.bytes(length))
  }
  private binary(length: number) {
    return this.bytes(length)
  }
  private array(length: number) {
    return Array.from({ length }, () => this.read())
  }
  private map(length: number) {
    const output: Record<string, any> = {}
    for (let index = 0; index < length; index++) output[String(this.read())] = this.read()
    return output
  }
  private extension(length: number) {
    return { type: this.int8(), data: this.bytes(length) }
  }
}

function isDisabled(value: unknown) {
  return typeof value === 'number' && value <= -999
}
function normalizeDisabled(value: number, fallback: number) {
  return value <= -999 ? fallback : value
}
function normalizePenalty(value: unknown) {
  const parsed = numberOr(value, 0)
  return parsed <= -999 ? 0 : parsed / 100
}
function positiveInt(value: unknown, fallback: number) {
  const parsed = Math.floor(numberOr(value, fallback))
  return parsed > 0 ? parsed : fallback
}
function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
