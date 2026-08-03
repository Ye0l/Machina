import { describe, expect, it } from 'vitest'
import {
  assetInstruction,
  findAsset,
  hasAssetTag,
  replaceAssetTags,
  withAssetInstruction,
} from '/common/assets'
import type { AppSchema } from '/common/types'

const assets: AppSchema.CharacterAsset[] = [
  { name: 'smiling', uri: 'smiling.png' },
  { name: 'Angry Face', uri: 'angry.png' },
]

const render = (text: string, list = assets) =>
  replaceAssetTags(text, list, (asset, name) =>
    asset ? `[img:${asset.uri}]` : `[missing:${name}]`
  )

describe('asset tags', () => {
  it('replaces the Risu double-colon form', () => {
    expect(render('before {{asset::smiling}} after')).toBe('before [img:smiling.png] after')
  })

  it('keeps the legacy single-colon form compatible', () => {
    expect(render('before {{asset:smiling}} after')).toBe('before [img:smiling.png] after')
  })

  it('matches the name case-insensitively and ignores padding', () => {
    // Models are inconsistent about both, and neither changes which asset was meant.
    expect(render('{{ asset :: ANGRY FACE }}')).toBe('[img:angry.png]')
  })

  it('replaces every tag in a message, not just the first', () => {
    expect(render('{{asset::smiling}} then {{asset:smiling}}')).toBe(
      '[img:smiling.png] then [img:smiling.png]'
    )
  })

  it('hands an unknown name back rather than deciding for the caller', () => {
    expect(render('{{asset::nope}}')).toBe('[missing:nope]')
  })

  it('leaves ordinary placeholders alone', () => {
    expect(render('{{char}} waves at {{user}}')).toBe('{{char}} waves at {{user}}')
  })

  it('leaves text untouched when the character has no assets', () => {
    expect(render('{{asset::smiling}}', [])).toBe('[missing:smiling]')
  })

  describe('detection', () => {
    it('finds either supported form anywhere in the text', () => {
      expect(hasAssetTag('a {{asset::x}} b')).toBe(true)
      expect(hasAssetTag('a {{asset:x}} b')).toBe(true)
      expect(hasAssetTag('no tags here')).toBe(false)
    })

    it('is not left stateful by a previous test, unlike a shared global regex', () => {
      expect(hasAssetTag('{{asset::x}}')).toBe(true)
      expect(hasAssetTag('{{asset::x}}')).toBe(true)
    })
  })

  describe('lookup', () => {
    it('resolves a name regardless of case', () => {
      expect(findAsset(assets, 'SMILING')?.uri).toBe('smiling.png')
    })

    it('yields nothing for an unknown name or an empty list', () => {
      expect(findAsset(assets, 'missing')).toBeUndefined()
      expect(findAsset([], 'smiling')).toBeUndefined()
      expect(findAsset(undefined, 'smiling')).toBeUndefined()
    })
  })
})

describe('the prompt instruction', () => {
  it('names every asset, so the model can only pick a real one', () => {
    const instruction = assetInstruction(assets)
    expect(instruction).toContain('- smiling')
    expect(instruction).toContain('- Angry Face')
    expect(instruction).toContain('{{asset::name}}')
  })

  it('is empty when there is nothing to show', () => {
    expect(assetInstruction([])).toBe('')
    expect(assetInstruction(undefined)).toBe('')
  })

  it('appends to the prompt, nearest the reply', () => {
    const prompt = withAssetInstruction('PROMPT-BODY', assets)
    expect(prompt.startsWith('PROMPT-BODY')).toBe(true)
    expect(prompt).toContain('- smiling')
  })

  it('leaves the prompt byte-identical when the character has no assets', () => {
    expect(withAssetInstruction('PROMPT-BODY', [])).toBe('PROMPT-BODY')
    expect(withAssetInstruction('PROMPT-BODY', undefined)).toBe('PROMPT-BODY')
  })
})
