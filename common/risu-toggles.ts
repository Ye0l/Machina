import type { AppSchema } from './types/schema'

export const RISU_TOGGLE_CONFIG_KEY = 'risuPromptToggles'

export type RisuToggleDefinition =
  | { kind: 'group'; label: string }
  | { kind: 'divider'; label: string }
  | { kind: 'select'; key: string; label: string; options: string[]; defaultValue: string }
  | { kind: 'text'; key: string; label: string; defaultValue: string }
  | { kind: 'boolean'; key: string; label: string; defaultValue: string }

export type RisuToggleConfig = {
  version: 1
  /** Original `customPromptTemplateToggle` text from RisuAI. */
  source: string
  /** Prompt template before Risu toggle macros are evaluated. */
  template: string
  /** Preset-wide values used when a chat has not overridden a control. */
  defaults?: Record<string, string>
}

type RisuPreset = Partial<AppSchema.GenSettings> & {
  temporary?: Record<string, any>
}

export function getRisuToggleConfig(preset?: RisuPreset): RisuToggleConfig | undefined {
  const config = preset?.temporary?.[RISU_TOGGLE_CONFIG_KEY]
  if (!config || config.version !== 1) return
  if (typeof config.source !== 'string' || typeof config.template !== 'string') return
  if (
    config.defaults !== undefined &&
    (!config.defaults ||
      typeof config.defaults !== 'object' ||
      Array.isArray(config.defaults) ||
      Object.values(config.defaults).some((value) => typeof value !== 'string'))
  )
    return
  return config as RisuToggleConfig
}

export function withRisuToggleConfig(
  preset: RisuPreset,
  source: string,
  template: string
): RisuPreset {
  const defaults = getRisuToggleConfig(preset)?.defaults
  return {
    ...preset,
    presetMode: 'advanced',
    useAdvancedPrompt: 'no-validation',
    gaslight: template,
    promptTemplateId: undefined,
    temporary: {
      ...(preset.temporary ?? {}),
      [RISU_TOGGLE_CONFIG_KEY]: {
        version: 1,
        source,
        template,
        ...(defaults ? { defaults } : {}),
      } satisfies RisuToggleConfig,
    },
  }
}

export function withRisuToggleDefaults(
  preset: RisuPreset,
  defaults: Record<string, string>
): RisuPreset {
  const config = getRisuToggleConfig(preset)
  if (!config) return preset

  return {
    ...preset,
    temporary: {
      ...(preset.temporary ?? {}),
      [RISU_TOGGLE_CONFIG_KEY]: { ...config, defaults } satisfies RisuToggleConfig,
    },
  }
}

export function withoutRisuToggleConfig(preset: RisuPreset): RisuPreset {
  const temporary = { ...(preset.temporary ?? {}) }
  delete temporary[RISU_TOGGLE_CONFIG_KEY]
  return { ...preset, temporary }
}

/** Splits on an unescaped delimiter and unescapes `\\=`, `\\,` and `\\\\`. */
function splitEscaped(value: string, delimiter: string): string[] {
  const parts: string[] = []
  let current = ''
  let escaped = false

  for (const char of value) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }
    if (char === '\\') {
      escaped = true
      continue
    }
    if (char === delimiter) {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }

  if (escaped) current += '\\'
  parts.push(current)
  return parts
}

export function parseRisuToggleSyntax(source: string): RisuToggleDefinition[] {
  const result: RisuToggleDefinition[] = []

  for (const rawLine of source.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('//')) continue

    const parts = splitEscaped(line, '=').map((part) => part.trim())
    const key = parts[0] ?? ''
    const label = parts[1] || key
    const type = (parts[2] || '').toLowerCase()

    if (type === 'group') {
      result.push({ kind: 'group', label })
      continue
    }
    if (type === 'divider') {
      result.push({ kind: 'divider', label })
      continue
    }
    if (!key) continue

    if (type === 'select') {
      const options = splitEscaped(parts.slice(3).join('='), ',').map((option) => option.trim())
      const normalisedOptions = options.length ? options : ['']
      const markedDefault = normalisedOptions.findIndex((option) =>
        /(?:\(|\[|【)\s*(?:기본|default)\s*(?:\)|\]|】)/i.test(option)
      )
      result.push({
        kind: 'select',
        key,
        label,
        options: normalisedOptions,
        // Risu does not export the live global toggle state with a preset. Prefer an option
        // explicitly marked as the default, otherwise use the first option just as Risu does.
        defaultValue: String(markedDefault >= 0 ? markedDefault : 0),
      })
      continue
    }

    if (type === 'text') {
      result.push({ kind: 'text', key, label, defaultValue: parts[3] ?? '' })
      continue
    }

    // A two-column line is RisuAI's checkbox syntax: `key=label`.
    result.push({
      kind: 'boolean',
      key,
      label,
      defaultValue: parts[3] === '1' ? '1' : '0',
    })
  }

  return result
}

export function defaultRisuToggleValues(source: string): Record<string, string> {
  return Object.fromEntries(
    parseRisuToggleSyntax(source).flatMap((definition) =>
      'key' in definition ? [[definition.key, definition.defaultValue]] : []
    )
  )
}

export function resolvedRisuToggleValues(
  source: string,
  values?: Record<string, string>
): Record<string, string> {
  return { ...defaultRisuToggleValues(source), ...(values ?? {}) }
}

type Mustache = { raw: string; inner: string; end: number }

/** Reads one `{{...}}`, including nested Risu mustaches inside the outer expression. */
function readMustache(input: string, start: number): Mustache | undefined {
  if (!input.startsWith('{{', start)) return

  let depth = 0
  for (let index = start; index < input.length - 1; index++) {
    if (input.startsWith('{{', index)) {
      depth++
      index++
      continue
    }
    if (input.startsWith('}}', index)) {
      depth--
      index++
      if (depth === 0) {
        const end = index + 1
        const raw = input.slice(start, end)
        return { raw, inner: raw.slice(2, -2).trim(), end }
      }
    }
  }
}

function splitTopLevel(value: string, delimiter: string): string[] {
  const result: string[] = []
  let depth = 0
  let start = 0

  for (let index = 0; index <= value.length - delimiter.length; index++) {
    if (value.startsWith('{{', index)) {
      depth++
      index++
      continue
    }
    if (value.startsWith('}}', index)) {
      depth = Math.max(0, depth - 1)
      index++
      continue
    }
    if (depth === 0 && value.startsWith(delimiter, index)) {
      result.push(value.slice(start, index))
      start = index + delimiter.length
      index += delimiter.length - 1
    }
  }

  result.push(value.slice(start))
  return result
}

function unwrapExpression(value: string): string {
  const trimmed = value.trim()
  const tag = readMustache(trimmed, 0)
  return tag && tag.end === trimmed.length ? tag.inner : trimmed
}

function scalar(value: unknown): string | number | boolean | null {
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  const text = String(value ?? '').trim()
  if (text === 'null' || text === 'undefined') return null
  if (text === 'true') return true
  if (text === 'false') return false
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(text)) return Number(text)
  return text
}

function truthy(value: unknown): boolean {
  const parsed = scalar(value)
  if (parsed === null || parsed === false || parsed === 0 || parsed === '') return false
  if (typeof parsed === 'string' && parsed.toLowerCase() === 'false') return false
  return true
}

function equal(left: unknown, right: unknown): boolean {
  const a = scalar(left)
  const b = scalar(right)
  if (typeof a === 'number' && typeof b === 'number') return a === b
  return a === b || String(a ?? '') === String(b ?? '')
}

function numeric(value: unknown): number {
  const parsed = Number(scalar(value))
  return Number.isFinite(parsed) ? parsed : 0
}

type ComparisonOperator = '=' | '==' | '===' | '!=' | '!==' | '<' | '>' | '<=' | '>=' | '≤' | '≥'

function topLevelComparison(
  expression: string
): { left: string; right: string; operator: ComparisonOperator } | undefined {
  const operators: ComparisonOperator[] = [
    '!==',
    '===',
    '!=',
    '==',
    '<=',
    '>=',
    '≤',
    '≥',
    '<',
    '>',
    '=',
  ]
  let depth = 0
  for (let index = 0; index < expression.length; index++) {
    if (expression.startsWith('{{', index)) {
      depth++
      index++
      continue
    }
    if (expression.startsWith('}}', index)) {
      depth = Math.max(0, depth - 1)
      index++
      continue
    }
    if (depth !== 0) continue

    const operator = operators.find((candidate) => expression.startsWith(candidate, index))
    if (!operator) continue
    return {
      left: expression.slice(0, index),
      right: expression.slice(index + operator.length),
      operator,
    }
  }
}

function evaluateQuestion(expression: string, values: Record<string, string>): boolean {
  let body = expression.trim()
  let negateResult = false
  if (body.startsWith('!') && !body.startsWith('!=')) {
    negateResult = true
    body = body.slice(1).trim()
  }

  const comparison = topLevelComparison(body)
  let result: boolean
  if (!comparison) {
    result = truthy(evaluateRisuExpression(body, values))
  } else {
    const left = evaluateRisuExpression(comparison.left, values)
    const right = evaluateRisuExpression(comparison.right, values)
    switch (comparison.operator) {
      case '!=':
      case '!==':
        result = !equal(left, right)
        break
      case '<':
        result = numeric(left) < numeric(right)
        break
      case '>':
        result = numeric(left) > numeric(right)
        break
      case '<=':
      case '≤':
        result = numeric(left) <= numeric(right)
        break
      case '>=':
      case '≥':
        result = numeric(left) >= numeric(right)
        break
      default:
        result = equal(left, right)
    }
  }

  return negateResult ? !result : result
}

function evaluateRisuExpression(expression: string, values: Record<string, string>): unknown {
  const body = unwrapExpression(expression)
  const [operator, ...args] = splitTopLevel(body, '::').map((part) => part.trim())

  switch (operator.toLowerCase()) {
    case 'getglobalvar': {
      const name = args.join('::').replace(/^toggle_/, '')
      return values[name] ?? null
    }
    case 'all':
      return args.every((arg) => truthy(evaluateRisuExpression(arg, values)))
    case 'not_equal':
      return !equal(
        evaluateRisuExpression(args[0] ?? '', values),
        evaluateRisuExpression(args[1] ?? '', values)
      )
    case 'less':
      return (
        numeric(evaluateRisuExpression(args[0] ?? '', values)) <
        numeric(evaluateRisuExpression(args[1] ?? '', values))
      )
    case 'greater_equal':
      return (
        numeric(evaluateRisuExpression(args[0] ?? '', values)) >=
        numeric(evaluateRisuExpression(args[1] ?? '', values))
      )
    case 'greater':
      return (
        numeric(evaluateRisuExpression(args[0] ?? '', values)) >
        numeric(evaluateRisuExpression(args[1] ?? '', values))
      )
    case 'less_equal':
      return (
        numeric(evaluateRisuExpression(args[0] ?? '', values)) <=
        numeric(evaluateRisuExpression(args[1] ?? '', values))
      )
    case 'equal':
      return equal(
        evaluateRisuExpression(args[0] ?? '', values),
        evaluateRisuExpression(args[1] ?? '', values)
      )
    case 'position':
      // Module insertion points are handled by RisuAI modules, not by a preset toggle.
      return ''
    case '?':
      return evaluateQuestion(args.length ? args.join('::') : body.slice(1), values)
  }

  if (body.startsWith('?')) return evaluateQuestion(body.slice(1), values)

  const nested = readMustache(body, 0)
  if (nested && nested.end === body.length) return evaluateRisuExpression(nested.inner, values)
  return scalar(body)
}

function isRisuInlineExpression(inner: string): boolean {
  const lower = inner.toLowerCase()
  return (
    lower.startsWith('getglobalvar::') ||
    lower.startsWith('all::') ||
    lower.startsWith('not_equal::') ||
    lower.startsWith('less::') ||
    lower.startsWith('greater_equal::') ||
    lower.startsWith('greater::') ||
    lower.startsWith('less_equal::') ||
    lower.startsWith('equal::') ||
    lower.startsWith('position::') ||
    lower.startsWith('?')
  )
}

function renderInline(input: string, values: Record<string, string>): string {
  let output = ''
  let index = 0

  while (index < input.length) {
    const start = input.indexOf('{{', index)
    if (start < 0) return output + input.slice(index)
    output += input.slice(index, start)

    const tag = readMustache(input, start)
    if (!tag) return output + input.slice(start)

    if (isRisuInlineExpression(tag.inner)) {
      const evaluated = evaluateRisuExpression(tag.inner, values)
      output +=
        typeof evaluated === 'boolean' ? (evaluated ? 'true' : 'false') : String(evaluated ?? '')
    } else {
      output += tag.raw
    }
    index = tag.end
  }

  return output
}

type RenderStop = { kind: 'else' | 'close'; raw: string }
type RenderResult = { text: string; index: number; stop?: RenderStop }

function conditionIsRisu(kind: string, expression: string): boolean {
  if (kind === '#if_pure') return true
  return /(?:getglobalvar|not_equal|less|greater|equal|all)::|^\s*\?/i.test(expression)
}

function renderRange(
  input: string,
  values: Record<string, string>,
  from: number,
  stopAtControl: boolean
): RenderResult {
  let output = ''
  let index = from

  while (index < input.length) {
    const start = input.indexOf('{{', index)
    if (start < 0)
      return { text: output + renderInline(input.slice(index), values), index: input.length }

    output += renderInline(input.slice(index, start), values)
    const tag = readMustache(input, start)
    if (!tag) return { text: output + input.slice(start), index: input.length }

    const inner = tag.inner.trim()
    const lower = inner.toLowerCase()

    if (stopAtControl && (lower === '/if' || lower === '#else' || lower === 'else')) {
      return {
        text: output,
        index: tag.end,
        stop: { kind: lower === '/if' ? 'close' : 'else', raw: tag.raw },
      }
    }

    const match = inner.match(/^(#if_pure|#if)\s+([\s\S]+)$/i)
    if (!match) {
      output += renderInline(tag.raw, values)
      index = tag.end
      continue
    }

    const kind = match[1].toLowerCase()
    const expression = match[2]
    const yes = renderRange(input, values, tag.end, true)
    let no: RenderResult | undefined
    let closeRaw = '{{/if}}'

    if (yes.stop?.kind === 'else') {
      no = renderRange(input, values, yes.index, true)
      if (no.stop?.kind === 'close') closeRaw = no.stop.raw
    } else if (yes.stop?.kind === 'close') {
      closeRaw = yes.stop.raw
    }

    if (conditionIsRisu(kind, expression)) {
      const enabled = truthy(evaluateRisuExpression(expression, values))
      output += enabled ? yes.text : no?.text ?? ''
    } else {
      output += tag.raw + yes.text
      if (yes.stop?.kind === 'else') output += yes.stop.raw + (no?.text ?? '')
      output += closeRaw
    }

    index = no ? no.index : yes.index
  }

  return { text: output, index }
}

/**
 * Resolves the subset of RisuAI prompt macros used by toggle-driven presets while leaving
 * Agnai placeholders and its ordinary `{{#if ...}}` blocks intact for the normal parser.
 */
export function renderRisuToggleMacros(
  template: string,
  source: string,
  values?: Record<string, string>
): string {
  const resolved = resolvedRisuToggleValues(source, values)
  return renderRange(template, resolved, 0, false).text
}

export function hasUnresolvedRisuMacros(template: string) {
  return /{{\s*(?:#if_pure\b|getglobalvar::)/i.test(template)
}

/**
 * Renders the supplied working template with a preset's Risu toggle definition. Unlike
 * renderRisuPreset, this is suitable for an editor preview where the text may have unsaved edits.
 */
export function renderRisuTemplate(
  template: string,
  preset: RisuPreset | undefined,
  values?: Record<string, string>
) {
  const config = getRisuToggleConfig(preset)
  if (!config) return template
  return renderRisuToggleMacros(template, config.source, {
    ...(config.defaults ?? {}),
    ...(values ?? {}),
  })
}

/** Returns a generation-only clone. The stored preset and source template are untouched. */
export function renderRisuPreset(
  preset: RisuPreset | undefined,
  values?: Record<string, string>
): RisuPreset | undefined {
  const config = getRisuToggleConfig(preset)
  if (!preset || !config) return preset

  return {
    ...preset,
    presetMode: 'advanced',
    useAdvancedPrompt: 'no-validation',
    promptTemplateId: undefined,
    gaslight: renderRisuTemplate(config.template, preset, values),
  }
}
