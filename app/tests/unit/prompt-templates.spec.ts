import { beforeEach, describe, expect, it } from 'vitest'
import { BUILTIN_TEMPLATE_IDS, promptTemplates } from '/app/lib/prompt-templates.svelte'
import { getTemplate } from '/common/prompt'
import { templates } from '/common/presets/templates'
import type { AppSchema } from '/common/types'

const saved = (id: string, name: string, template: string) =>
  ({
    kind: 'prompt-template',
    _id: id,
    name,
    template,
    userId: 'user-1',
    createdAt: '',
    updatedAt: '',
  } satisfies AppSchema.PromptTemplate)

/** `getTemplate` only reads these two, so the rest of a generate request is irrelevant here. */
const request = (settings: Partial<AppSchema.GenSettings>) =>
  ({ settings, chat: {} } as Parameters<typeof getTemplate>[0])

describe('prompt templates', () => {
  beforeEach(() => {
    promptTemplates.list = []
  })

  describe('resolve', () => {
    it('knows the built-ins shipped in the shared layer', () => {
      expect(BUILTIN_TEMPLATE_IDS).toContain('Universal')
      expect(promptTemplates.resolve('Universal')?.template).toBe(templates.Universal)
    })

    it('resolves one of the user saved templates by id', () => {
      promptTemplates.list = [saved('tpl-1', 'Mine', 'MY-TEMPLATE')]
      expect(promptTemplates.resolve('tpl-1')?.template).toBe('MY-TEMPLATE')
    })

    it('yields nothing for an id that is neither', () => {
      expect(promptTemplates.resolve('tpl-gone')).toBeUndefined()
    })
  })

  /*
   * The regression these guard: this client assembles the prompt in the browser, and
   * `common/prompt` resolves `promptTemplateId` through a locator that is a no-op until a
   * frontend registers one. Importing the store registers it -- without that, every preset
   * below would silently generate from its `gaslight` instead.
   */
  describe('the locator common/prompt generates through', () => {
    it('uses a built-in template named by the preset', () => {
      expect(getTemplate(request({ promptTemplateId: 'Universal' }))).toBe(templates.Universal)
    })

    it('uses a saved template referenced by the preset', () => {
      promptTemplates.list = [saved('tpl-1', 'Mine', 'MY-TEMPLATE')]
      expect(getTemplate(request({ promptTemplateId: 'tpl-1' }))).toBe('MY-TEMPLATE')
    })

    it('outranks the raw template the preset carries', () => {
      promptTemplates.list = [saved('tpl-1', 'Mine', 'MY-TEMPLATE')]
      const template = getTemplate(
        request({
          promptTemplateId: 'tpl-1',
          gaslight: 'PRESET-RAW',
          useAdvancedPrompt: 'no-validation',
        })
      )

      expect(template).toBe('MY-TEMPLATE')
    })

    it('falls back to the raw template when the referenced one is gone', () => {
      const template = getTemplate(
        request({
          promptTemplateId: 'tpl-deleted',
          gaslight: 'PRESET-RAW',
          useAdvancedPrompt: 'no-validation',
        })
      )

      expect(template).toBe('PRESET-RAW')
    })

    it('leaves a preset with no template id on its own raw template', () => {
      const template = getTemplate(
        request({ gaslight: 'PRESET-RAW', useAdvancedPrompt: 'no-validation' })
      )

      expect(template).toBe('PRESET-RAW')
    })
  })
})
