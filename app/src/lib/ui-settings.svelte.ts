import { defaultUIsettings, type UISettings } from '/common/types/ui'
import { api } from './api'
import { session } from './session.svelte'
import { subscribe } from './socket'

/**
 * Account-level chat display settings.
 *
 * The value is derived from `session.user.ui` merged over `defaultUIsettings`, so it
 * follows login/logout automatically and never needs its own reset path.
 *
 * Saves go through `POST /user/ui` (which returns `{ success: true }`, not the merged
 * document); `session.user.ui` is only updated after a successful response so navigation
 * always reflects the persisted value. `ui-update` pushes from the server carry the patch
 * body, so they are merged over the current value.
 */
class UISettingsStore {
  settings = $derived<UISettings>({ ...defaultUIsettings, ...(session.user?.ui ?? {}) })

  constructor() {
    subscribe('ui-update', (event) => {
      const patch = event.ui
      if (!patch || typeof patch !== 'object') return
      this.#merge(patch as Partial<UISettings>)
    })
  }

  #merge(patch: Partial<UISettings>) {
    if (!session.user) return
    session.user = {
      ...session.user,
      ui: { ...defaultUIsettings, ...(session.user.ui ?? {}), ...patch },
    }
  }

  async save(patch: Partial<UISettings>): Promise<boolean> {
    try {
      await api.post('/user/ui', patch)
      this.#merge(patch)
      return true
    } catch {
      return false
    }
  }
}

export const uiSettings = new UISettingsStore()
