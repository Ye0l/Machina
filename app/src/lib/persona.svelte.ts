import type { AppSchema } from '/common/types'
import { api } from './api'
import { subscribe } from './socket'

/**
 * The character the user speaks as.
 *
 * Agnai has no separate persona entity: impersonation sends a whole character as
 * `impersonate`, whose name replaces the profile handle and whose persona reaches the prompt
 * as `{{impersonating}}` (`common/prompt.ts`). So a persona is just one of your own
 * characters, picked here.
 *
 * The choice is client-side. The server accepts `impersonate` per request but stores nothing,
 * so it is kept in `localStorage` to survive a reload rather than being lost like the legacy
 * client's in-memory store.
 */

const STORAGE_KEY = 'agnai.persona'

class Persona {
  /** The selected character in full: `CharacterSummary` has no `persona` to send. */
  character = $state<AppSchema.Character | undefined>()
  loading = $state(false)

  private id = $state<string>(localStorage.getItem(STORAGE_KEY) ?? '')

  get characterId() {
    return this.id
  }

  /** Resolves the stored id once the character list is known. Safe to call repeatedly. */
  async restore() {
    if (!this.id || this.character?._id === this.id || this.loading) return
    await this.select(this.id)
  }

  async select(characterId: string) {
    if (!characterId) return this.clear()

    this.loading = true
    try {
      const character = await api.get<AppSchema.Character>(`/character/${characterId}`)
      this.character = character
      this.id = characterId
      localStorage.setItem(STORAGE_KEY, characterId)
    } catch {
      // A persona whose character was deleted simply stops applying.
      this.clear()
    } finally {
      this.loading = false
    }
  }

  clear() {
    this.character = undefined
    this.id = ''
    localStorage.removeItem(STORAGE_KEY)
  }
}

export const persona = new Persona()

subscribe('app-logout', () => persona.clear())
