import { presetDefaults } from '/common/default-preset'
import { AppSchema } from '/common/types/schema'

const MAX_RISU_PRESET_SIZE = 16 * 1024 * 1024

// RisuAI's RPack decode table. RPack is a byte-substitution wrapper used by .risup files.
// Source: https://github.com/kwaroran/Risuai/tree/main/src/ts/rpack (AGPL-3.0 compatible)
const RPACK_DECODE_MAP_BASE64 =
  'LPeEi8ll+7afrrMDLQFpdB/ko+zuXDQhk0oPauJiAp4inP08/HHHxq1ZZwVwbYpEEvokhl+v0XpHzv5QY91RBm8Y4FKoCZ1Wc0y4U2zDoA4Zzz4NfgcyaEbqSPmZLqukSSBeVTU4DLzTsVgWeSgKGuHyzcQ526K6YHJ2fZXvf8jA3jeUv7UUgZIlRazn9WanKzZawRPjSzrojYMbfCewmkLrh6rcVI54JtJXKdS3+C+PiXXwQXfCHv/YFRHlBJcX8zHQmwDXyrRPKjvZsmvaXaE/MGG9kT1O5t++TYKMHSMQmGT0hTN7kEO7qYjx1qUc9sxuuVsLlu3V6cXLCKaAQA=='

type RisuPreset = Record<string, any>
type ToggleValues = Record<string, string | number | boolean | null>

export function isRisuPresetFilename(filename: string) {
  const lower = filename.toLowerCase()
  return lower.endsWith('.risup') || lower.endsWith('.risupreset')
}

export async function importRisuPreset(
  data: Uint8Array,
  filename: string
): Promise<AppSchema.GenSettings> {
  if (data.byteLength > MAX_RISU_PRESET_SIZE) {
    throw new Error('RisuAI preset is too large')
  }

  const packed = filename.toLowerCase().endsWith('.risup') ? decodeRPack(data) : data
  const outer = decodeMessagePack(await decompressGzip(packed)) as RisuPreset

  if (outer?.type !== 'preset' || ![0, 2].includes(outer?.presetVersion)) {
    throw new Error('Unsupported RisuAI preset format')
  }

  const encrypted = outer.preset ?? outer.pres
  if (!(encrypted instanceof Uint8Array)) {
    throw new Error('RisuAI preset payload is missing')
  }

  const decrypted = await decryptRisuPayload(encrypted)
  const preset = decodeMessagePack(decrypted) as RisuPreset

  if (!preset || typeof preset !== 'object' || !Array.isArray(preset.promptTemplate)) {
    throw new Error('RisuAI preset payload is invalid')
  }

  return convertRisuPreset(preset)
}

function convertRisuPreset(preset: RisuPreset): AppSchema.GenSettings {
  const toggles = parseToggleDefaults(preset.customPromptTemplateToggle)
  const prompt = convertPromptTemplate(preset.promptTemplate, toggles)
  const model = firstString(
    preset.customProxyRequestModel,
    preset.proxyRequestModel,
    preset.openrouterRequestModel,
    preset.aiModel
  )

  const imported: AppSchema.GenSettings = {
    ...presetDefaults,
    name: `${firstString(preset.name, 'RisuAI Preset')} - Imported`,
    description: buildImportDescription(preset, prompt.warnings),
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

  return imported
}

function buildImportDescription(preset: RisuPreset, warnings: string[]) {
  const provider = firstString(preset.currentPluginProvider)
  const details = [
    'Imported from a RisuAI .risup preset.',
    'RisuAI-only dynamic toggles were resolved to their first/default values.',
    'Chat-range splitting, cache blocks, author notes, and module positions cannot be represented exactly in Agnai.',
  ]

  if (provider) details.push(`Original RisuAI provider: ${provider}`)
  if (warnings.length) details.push(`Conversion notes: ${warnings.join('; ')}`)

  return details.join('\n')
}

function convertPromptTemplate(items: any[], toggles: ToggleValues) {
  const warnings = new Set<string>()
  const blocks: Array<{ role: 'system' | 'user' | 'bot'; text: string }> = []
  const chatIndexes = items
    .map((item, index) => (item?.type === 'chat' ? index : -1))
    .filter((index) => index >= 0)
  const historyIndex = chatIndexes.length ? chatIndexes[chatIndexes.length - 1] : -1
  let prefill = ''

  for (let index = 0; index < items.length; index++) {
    const item = items[index] || {}
    const role = normalizeRole(item.role)
    const text = renderRisuText(firstString(item.text), toggles).trim()
    const inner = renderRisuText(firstString(item.innerFormat), toggles)

    switch (item.type) {
      case 'plain': {
        if (role === 'bot' && index === items.length - 1) {
          prefill = text
          break
        }
        pushBlock(blocks, role, text)
        break
      }

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
        if (index === historyIndex) {
          pushBlock(blocks, role, [text, '{{history}}'].filter(Boolean).join('\n\n'))
        } else if (text) {
          pushBlock(blocks, role, text)
        }
        break

      case 'authornote':
        if (text || item.defaultText) warnings.add('author note omitted')
        break

      case 'cache':
        warnings.add('cache block omitted')
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
  if (!blocks.some((block) => block.text.includes('{{history}}'))) {
    pushBlock(blocks, 'system', '{{history}}')
  }
  pushBlock(blocks, 'bot', '{{post}}')

  const template = blocks
    .map((block) => `<${block.role}>\n${block.text.trim()}\n</${block.role}>`)
    .join('\n\n')
    .trim()

  return { template, prefill, warnings: Array.from(warnings) }
}

function pushBlock(
  blocks: Array<{ role: 'system' | 'user' | 'bot'; text: string }>,
  role: 'system' | 'user' | 'bot',
  value: string
) {
  const text = value.trim()
  if (!text) return

  const previous = blocks.length ? blocks[blocks.length - 1] : undefined
  if (previous?.role === role) {
    previous.text += `\n\n${text}`
  } else {
    blocks.push({ role, text })
  }
}

function normalizeRole(role: string): 'system' | 'user' | 'bot' {
  if (role === 'user') return 'user'
  if (role === 'bot' || role === 'assistant') return 'bot'
  return 'system'
}

function applySlot(format: string, slot: string) {
  return format ? format.split('{{slot}}').join(slot) : slot
}

function parseToggleDefaults(config: unknown): ToggleValues {
  const values: ToggleValues = {}
  if (typeof config !== 'string') return values

  for (const raw of config.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('=')) continue

    const [key, _label, type] = line.split('=')
    if (!key) continue
    values[`toggle_${key}`] = type === 'select' ? 0 : ''
  }

  return values
}

function renderRisuText(input: string, toggles: ToggleValues) {
  const renderSegment = (start: number, stopAtEnd: boolean): { output: string; offset: number } => {
    let output = ''
    let offset = start

    while (offset < input.length) {
      if (input.startsWith('{{/if}}', offset)) {
        if (stopAtEnd) return { output, offset: offset + 7 }
        offset += 7
        continue
      }

      let prefix = ''
      if (input.startsWith('{{#if_pure', offset)) prefix = '{{#if_pure'
      else if (input.startsWith('{{#if ', offset)) prefix = '{{#if '

      if (prefix) {
        const openEnd = findBalancedTagEnd(input, offset)
        if (openEnd < 0) {
          output += input.slice(offset)
          break
        }

        const expression = input.slice(offset + prefix.length, openEnd - 2).trim()
        const body = renderSegment(openEnd, true)
        if (evaluateExpression(expression, toggles)) output += body.output
        offset = body.offset
        continue
      }

      output += input[offset++]
    }

    return { output, offset }
  }

  return renderSegment(0, false)
    .output.replace(/\{\{getglobalvar::([^{}]+)\}\}/g, (_match, key) =>
      String(toggles[String(key).trim()] ?? '')
    )
    .replace(/\{\{position::[^{}]+\}\}/g, '')
    .replace(/\{\{\/if\}\}/g, '')
}

function findBalancedTagEnd(input: string, start: number) {
  let depth = 0

  for (let offset = start; offset < input.length - 1; offset++) {
    const pair = input.slice(offset, offset + 2)
    if (pair === '{{') {
      depth++
      offset++
    } else if (pair === '}}') {
      depth--
      offset++
      if (depth === 0) return offset + 1
    }
  }

  return -1
}

function evaluateExpression(expression: string, toggles: ToggleValues) {
  let output = expression
  const inner = /\{\{([^{}]*)\}\}/g
  let guard = 0

  while (/\{\{[^{}]*\}\}/.test(output) && guard++ < 1000) {
    output = output.replace(inner, (_match, tag) => String(evaluateTag(tag, toggles)))
  }

  return isTruthy(toScalar(output))
}

function evaluateTag(tagInput: string, toggles: ToggleValues): string | number | boolean | null {
  const tag = tagInput.trim()

  if (tag.startsWith('getglobalvar::')) {
    return toggles[tag.slice('getglobalvar::'.length).trim()] ?? null
  }

  if (tag.startsWith('not_equal::')) {
    const [left, right] = tag.slice('not_equal::'.length).split('::').map(toScalar)
    return left !== right
  }

  if (tag.startsWith('less::')) {
    const [left, right] = tag.slice('less::'.length).split('::').map(toScalar)
    return Number(left) < Number(right)
  }

  if (tag.startsWith('greater_equal::')) {
    const [left, right] = tag.slice('greater_equal::'.length).split('::').map(toScalar)
    return Number(left) >= Number(right)
  }

  if (tag.startsWith('all::')) {
    return tag.slice('all::'.length).split('::').map(toScalar).every(isTruthy)
  }

  if (tag.startsWith('?')) {
    let query = tag.slice(1).trim()
    let negate = false
    if (query.startsWith('!')) {
      negate = true
      query = query.slice(1).trim()
    }

    const separator = query.indexOf('=')
    const result =
      separator >= 0
        ? toScalar(query.slice(0, separator)) === toScalar(query.slice(separator + 1))
        : isTruthy(toScalar(query))
    return negate ? !result : result
  }

  return `{{${tagInput}}}`
}

function toScalar(input: unknown): string | number | boolean | null {
  if (typeof input !== 'string') return input as any

  const value = input.trim()
  if (!value) return ''
  if (value === 'null' || value === 'undefined') return null
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^[-+]?\d+(?:\.\d+)?$/.test(value)) return Number(value)
  return value
}

function isTruthy(value: unknown) {
  return !(
    value === false ||
    value === null ||
    value === undefined ||
    value === '' ||
    value === 0 ||
    value === '0' ||
    value === 'false' ||
    value === 'null'
  )
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

  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decryptRisuPayload(data: Uint8Array) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('risupreset'))
  const key = await crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['decrypt'])
  const encrypted = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer
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
    for (let index = 0; index < length; index++) {
      const key = this.read()
      output[String(key)] = this.read()
    }
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
