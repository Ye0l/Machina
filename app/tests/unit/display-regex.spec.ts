import { describe, expect, it } from 'vitest'
import {
  applyDisplayRegexRules,
  displayRegexError,
  getDisplayRegexRules,
  withDisplayRegexRules,
  type DisplayRegexRule,
} from '/common/display-regex'

const rule = (overrides: Partial<DisplayRegexRule> = {}): DisplayRegexRule => ({
  id: 'rule-1',
  name: 'Hide thought block',
  enabled: true,
  pattern: '<think>[\\s\\S]*?</think>\\s*',
  flags: 'gi',
  replacement: '',
  ...overrides,
})

describe('display regex rules', () => {
  it('applies enabled rules in order with JavaScript capture replacements', () => {
    const output = applyDisplayRegexRules('Name: Aria <think>secret</think>', [
      rule(),
      rule({ id: 'rule-2', pattern: 'Name: (\\w+)', flags: '', replacement: '**$1**' }),
    ])

    expect(output).toBe('**Aria** ')
  })

  it('does not apply disabled rules', () => {
    expect(applyDisplayRegexRules('<think>secret</think>shown', [rule({ enabled: false })])).toBe(
      '<think>secret</think>shown'
    )
  })

  it('skips an invalid rule without hiding the message', () => {
    expect(applyDisplayRegexRules('still visible', [rule({ pattern: '[' })])).toBe('still visible')
    expect(displayRegexError(rule({ pattern: '[' }))).not.toBe('')
  })

  it('stores rules inside temporary metadata without dropping other features', () => {
    const preset = withDisplayRegexRules({ temporary: { risuPromptToggles: { version: 1 } } }, [
      rule(),
    ])

    expect(preset.temporary?.risuPromptToggles).toEqual({ version: 1 })
    expect(getDisplayRegexRules(preset)).toEqual([rule()])
  })

  it('removes only its own config when the last rule is deleted', () => {
    const preset = withDisplayRegexRules(
      {
        temporary: {
          risuPromptToggles: { version: 1 },
          displayRegex: { version: 1, rules: [rule()] },
        },
      },
      []
    )

    expect(preset.temporary).toEqual({ risuPromptToggles: { version: 1 } })
  })
})
