import type { AppSchema } from '/common/types'
import type { InitResponse, LoginResponse } from './contracts'
import { api, ApiError, clearToken, getToken, setToken } from './api'
import { authenticateSocket, connectSocket, emit, logoutSocket } from './socket'
import { registerEncoder } from './tokenizer'

/**
 * Auth + bootstrap state.
 *
 * Boot is a single call: `GET /api/user/init` returns the user and profile together
 * (`srv/api/user/settings.ts` getInitialLoad).
 */
class Session {
  user = $state<AppSchema.User | undefined>()
  profile = $state<AppSchema.Profile | undefined>()
  presets = $state<AppSchema.UserGenPreset[]>([])

  /**
   * `canAuth` reports whether the deployment has a database, and therefore accounts at all
   * (`srv/api/settings.ts`). Registration is only offered when it does. Defaults to false so
   * a failed config fetch does not advertise a sign-up that cannot work.
   */
  canAuth = $state(false)

  loading = $state(false)
  error = $state('')

  /** Set when boot failed for a reason other than an expired session. */
  bootError = $state('')

  /** Booted with a session. Drives the auth gate. */
  authed = $derived(!!this.user)

  async login(username: string, password: string) {
    this.loading = true
    this.error = ''

    try {
      const res = await api.post<LoginResponse>('/user/login', { username, password })
      setToken(res.token)
      authenticateSocket()
      await this.init()
    } catch (ex) {
      this.error = ex instanceof ApiError ? ex.message : 'Could not reach the server'
    } finally {
      this.loading = false
    }
  }

  async register(handle: string, username: string, password: string) {
    this.loading = true
    this.error = ''

    try {
      const res = await api.post<LoginResponse>('/user/register', { handle, username, password })
      setToken(res.token)
      authenticateSocket()
      await this.init()
    } catch (ex) {
      this.error = ex instanceof ApiError ? ex.message : 'Could not reach the server'
    } finally {
      this.loading = false
    }
  }

  /** Loads and validates the stored login session. Safe to call on boot. */
  async init() {
    if (!getToken()) return

    try {
      const res = await api.get<InitResponse>('/user/init')
      this.user = res.user
      this.profile = res.profile
      this.presets = res.presets ?? []
    } catch (ex) {
      // Only the dedicated session validation endpoint is allowed to invalidate the stored
      // login. A 401 from any other API request is surfaced to that request's caller instead.
      if (ex instanceof ApiError && ex.status === 401) clearToken()
      throw ex
    }
  }

  logout() {
    clearToken()
    logoutSocket()
    // Local-only event: other stores drop per-account data without importing this module
    // back (which would be circular).
    emit({ type: 'app-logout' })
    this.user = undefined
    this.profile = undefined
    this.presets = []
  }
}

export const session = new Session()

export async function boot() {
  registerEncoder()
  connectSocket()
  session.bootError = ''

  // Public endpoint, and only used to decide whether to offer registration, so a failure
  // here must not block boot.
  api
    .get<{ canAuth?: boolean }>('/settings')
    .then((config) => (session.canAuth = !!config.canAuth))
    .catch(() => {})

  try {
    await session.init()
  } catch (ex) {
    // Session.init() clears the token only when /user/init itself confirms a 401. Anything
    // else (offline, 5xx) must preserve the stored JWT and present a recoverable boot error.
    if (ex instanceof ApiError && ex.status === 401) {
      session.logout()
      return
    }

    session.bootError = ex instanceof ApiError ? ex.message : 'Could not reach the server'
  }
}
