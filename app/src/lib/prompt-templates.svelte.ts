import type { AppSchema } from '/common/types'
import { registerTemplateLocator } from '/common/prompt'
import { isDefaultTemplate, templates as builtins } from '/common/presets/templates'
import { api } from './api'
import { subscribe } from './socket'

/**
 * Reusable prompt templates (`srv/api/user/presets.ts`, routed under `/user/templates`).
 *
 * A preset points at one through `promptTemplateId`, and that id wins over both the raw
 * `gaslight` template and the basic prompt order -- see `getTemplate` in `common/prompt.ts`.
 * Resolution goes through a locator that `common/prompt` leaves as a no-op until a frontend
 * registers one, because the shared layer has no way to reach either store.
 *
 * That matters here more than it does on the server: this client assembles the prompt in the
 * browser and posts the finished text to `/chat/inference-stream`, so without the locator
 * below a preset carrying a template id would quietly generate from its `gaslight` instead.
 */

/** Template names shipped in `common/presets/templates.ts`. */
export const BUILTIN_TEMPLATE_IDS = Object.keys(builtins) as Array<keyof typeof builtins>

/**
 * A built-in presented as a stored template. The ids are names rather than object ids, which
 * is what `isDefaultTemplate` keys off and what the server stores on the preset.
 */
function builtinTemplate(id: string): AppSchema.PromptTemplate {
  return {
    kind: 'prompt-template',
    _id: id,
    name: id,
    template: builtins[id as keyof typeof builtins],
    userId: '',
    createdAt: '',
    updatedAt: '',
  }
}

class PromptTemplates {
  list = $state<AppSchema.PromptTemplate[]>([])

  loading = $state(false)
  saving = $state(false)
  error = $state('')
  loaded = $state(false)

  /** The in-flight request rather than a boolean, for the reason given in `books.svelte.ts`. */
  private request: Promise<void> | undefined

  async load(force = false) {
    if (this.loaded && !force) return
    if (this.request) return this.request

    this.request = this.fetch()
    try {
      await this.request
    } finally {
      this.request = undefined
    }
  }

  private async fetch() {
    this.loading = true
    this.error = ''
    try {
      const res = await api.get<{ templates: AppSchema.PromptTemplate[] }>('/user/templates')
      this.list = res.templates ?? []
      this.loaded = true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to load prompt templates'
    } finally {
      this.loading = false
    }
  }

  /**
   * Resolves an id the way the server does (`srv/api/chat/message.ts`): a built-in name first,
   * then one of the user's saved templates.
   */
  resolve(id: string): AppSchema.PromptTemplate | undefined {
    if (isDefaultTemplate(id)) return builtinTemplate(id)
    return this.list.find((template) => template._id === id)
  }

  async create(name: string, template: string): Promise<AppSchema.PromptTemplate | undefined> {
    this.saving = true
    this.error = ''
    try {
      const created = await api.post<AppSchema.PromptTemplate>('/user/templates', {
        name: name.trim(),
        template,
      })
      this.list = [...this.list, created]
      return created
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save prompt template'
    } finally {
      this.saving = false
    }
  }

  async update(
    id: string,
    name: string,
    template: string
  ): Promise<AppSchema.PromptTemplate | undefined> {
    this.saving = true
    this.error = ''
    try {
      const updated = await api.post<AppSchema.PromptTemplate>(`/user/templates/${id}`, {
        name: name.trim(),
        template,
      })
      // The route answers with the stored record; fall back to the sent values if it is empty.
      const next = updated?._id ? updated : { ...this.resolve(id)!, name: name.trim(), template }
      this.list = this.list.map((item) => (item._id === id ? next : item))
      return next
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save prompt template'
    } finally {
      this.saving = false
    }
  }

  async remove(id: string) {
    this.error = ''
    try {
      await api.del(`/user/templates/${id}`)
      this.list = this.list.filter((template) => template._id !== id)
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete prompt template'
      return false
    }
  }

  reset() {
    this.list = []
    this.loaded = false
    this.error = ''
  }
}

export const promptTemplates = new PromptTemplates()

// Registered on import, as the legacy client does in `web/store/data/bot-generate.ts`.
registerTemplateLocator((id) => promptTemplates.resolve(id))

subscribe('app-logout', () => promptTemplates.reset())
