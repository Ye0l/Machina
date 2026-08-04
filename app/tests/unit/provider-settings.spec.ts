import { describe, expect, it } from 'vitest'
import { mergeProviderSettings } from '/common/provider-settings'

describe('mergeProviderSettings', () => {
  it('adds and overrides provider-specific request fields last', () => {
    const payload = { temperature: 0.8, max_tokens: 300 }

    expect(
      mergeProviderSettings(payload, {
        temperature: 1,
        seed: 42,
        reasoning: { effort: 'high' },
      })
    ).toEqual({
      temperature: 1,
      max_tokens: 300,
      seed: 42,
      reasoning: { effort: 'high' },
    })
  })

  it('ignores non-object values', () => {
    expect(mergeProviderSettings({ temperature: 0.8 }, undefined)).toEqual({ temperature: 0.8 })
    expect(mergeProviderSettings({ temperature: 0.8 }, [] as any)).toEqual({ temperature: 0.8 })
  })
})
