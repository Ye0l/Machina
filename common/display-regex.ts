import type { AppSchema } from './types/schema'

export const DISPLAY_REGEX_CONFIG_KEY = 'displayRegex'

export type DisplayRegexRule = {
  id: string
  name: string
  enabled: boolean
  pattern: string
  flags: string
  replacement: string
}

export type DisplayRegexConfig = {
  version: 1
  rules: DisplayRegexRule[]
}

type PresetWithTemporary = Partial<AppSchema.GenSettings> & {
  temporary?: Record<string, any>
}

function isRule(value: unknown): value is DisplayRegexRule {
  if (!value || typeof value !== 'object') return false
  const rule = value as Record<string, unknown>
  return (
    typeof rule.id === 'string' &&
    typeof rule.name === 'string' &&
    typeof rule.enabled === 'boolean' &&
    typeof rule.pattern === 'string' &&
    typeof rule.flags === 'string' &&
    typeof rule.replacement === 'string'
  )
}

export function getDisplayRegexRules(preset?: PresetWithTemporary): DisplayRegexRule[] {
  const config = preset?.temporary?.[DISPLAY_REGEX_CONFIG_KEY]
  if (!config || config.version !== 1 || !Array.isArray(config.rules)) return []
  return config.rules.filter(isRule).map((rule: DisplayRegexRule) => ({ ...rule }))
}

/** Stores display-only rules without changing any other temporary preset metadata. */
export function withDisplayRegexRules<T extends PresetWithTemporary>(
  preset: T,
  rules: DisplayRegexRule[]
): T {
  const temporary = { ...(preset.temporary ?? {}) }
  const clean = rules.filter(isRule).map((rule) => ({ ...rule }))

  if (clean.length) {
    temporary[DISPLAY_REGEX_CONFIG_KEY] = {
      version: 1,
      rules: clean,
    } satisfies DisplayRegexConfig
  } else {
    delete temporary[DISPLAY_REGEX_CONFIG_KEY]
  }

  return { ...preset, temporary }
}

export function displayRegexError(rule: Pick<DisplayRegexRule, 'pattern' | 'flags'>): string {
  if (!rule.pattern) return ''
  try {
    new RegExp(rule.pattern, rule.flags)
    return ''
  } catch (error) {
    return error instanceof Error ? error.message : 'Invalid regular expression'
  }
}

/**
 * Applies enabled rules in their saved order. Invalid rules are skipped so one typo can never make
 * an entire chat unreadable. This function changes only the rendered view; callers retain the raw
 * message for editing, history, retries, summaries and future prompts.
 */
export function applyDisplayRegexRules(text: string, rules: DisplayRegexRule[]): string {
  let output = text

  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue
    try {
      output = output.replace(new RegExp(rule.pattern, rule.flags), rule.replacement)
    } catch {
      // The settings screen reports the error. Rendering must remain fail-open.
    }
  }

  return output
}

export function applyPresetDisplayRegex(text: string, preset?: PresetWithTemporary): string {
  return applyDisplayRegexRules(text, getDisplayRegexRules(preset))
}
