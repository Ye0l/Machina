import type { AppSchema } from '/common/types'
import { api } from './api'
import { subscribe } from './socket'

/**
 * User personas (`srv/api/persona.ts`): who *you* are in a conversation.
 *
 * A persona is its own entity, not a character — it never appears in the character library and
 * cannot be chatted with. It reaches the wire as a character only because `impersonate` is
 * typed that way; `common/persona.ts` does that conversion.
 *
 * Which persona is selected is a client-side choice: the server accepts `impersonate` per
 * request and stores no preference, so the selection lives in `localStorage` rather than being
 * lost on reload.
 */

const STORAGE_KEY = 'agnai.persona'

export type PersonaDraft = {
  name: string
  persona: AppSchema.Persona
}

class Personas {
  list = $state<AppSchema.UserPersona[]>([])

  loading = $state(false)
  saving = $state(false)
  error = $state('')
  loaded = $state(false)

  /** The in-flight request rather than a boolean, for the reason given in `books.svelte.ts`. */
  private request: Promise<void> | undefined

  private id = $state<string>(localStorage.getItem(STORAGE_KEY) ?? '')

  /** The selected persona, or undefined when speaking as the account profile. */
  get selected(): AppSchema.UserPersona | undefined {
    return this.list.find((persona) => persona._id === this.id)
  }

  get selectedId() {
    // A persona that was deleted elsewhere stops applying rather than lingering as a dead id.
    return this.selected ? this.id : ''
  }

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
      const res = await api.get<{ personas: AppSchema.UserPersona[] }>('/persona')
      this.list = res.personas ?? []
      this.loaded = true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to load personas'
    } finally {
      this.loading = false
    }
  }

  get(personaId: string) {
    return this.list.find((persona) => persona._id === personaId)
  }

  select(personaId: string) {
    this.id = personaId
    if (personaId) localStorage.setItem(STORAGE_KEY, personaId)
    else localStorage.removeItem(STORAGE_KEY)
  }

  async create(draft: PersonaDraft): Promise<AppSchema.UserPersona | undefined> {
    this.saving = true
    this.error = ''
    try {
      const created = await api.post<AppSchema.UserPersona>('/persona', draft)
      this.list = [...this.list, created]
      return created
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save persona'
    } finally {
      this.saving = false
    }
  }

  async update(personaId: string, draft: PersonaDraft): Promise<AppSchema.UserPersona | undefined> {
    this.saving = true
    this.error = ''
    try {
      const updated = await api.post<AppSchema.UserPersona>(`/persona/${personaId}`, draft)
      this.list = this.list.map((persona) => (persona._id === personaId ? updated : persona))
      return updated
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save persona'
    } finally {
      this.saving = false
    }
  }

  async remove(personaId: string) {
    this.error = ''
    try {
      await api.del(`/persona/${personaId}`)
      this.list = this.list.filter((persona) => persona._id !== personaId)
      // Selection is resolved through the list, so a deleted persona deselects itself; the
      // stored id is cleared too so it cannot come back on the next reload.
      if (this.id === personaId) this.select('')
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete persona'
      return false
    }
  }

  reset() {
    this.list = []
    this.loaded = false
    this.error = ''
    this.select('')
  }
}

export const personas = new Personas()

subscribe('app-logout', () => personas.reset())
