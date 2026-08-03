import { describe, expect, it } from 'vitest'
import {
  archiveVisibleVariant,
  resolveGenerationModel,
  rotateVariantState,
} from '/app/lib/generation-debug'

describe('generation debug metadata', () => {
  it('uses the model currently selected by the active provider', () => {
    expect(
      resolveGenerationModel({
        name: 'Preset fallback',
        providerId: 'provider-1',
        providerModels: { 'provider-1': 'current/model-v2' },
      } as any)
    ).toBe('current/model-v2')
  })

  it('archives and rotates metadata in the same order as response swipes', () => {
    const archived = archiveVisibleVariant('visible', ['next', 'previous'], 1)
    expect(archived).toEqual(['previous', 'visible', 'next'])

    expect(rotateVariantState('new', archived, -1)).toEqual({
      current: 'next',
      retries: ['new', 'previous', 'visible'],
    })
  })
})
