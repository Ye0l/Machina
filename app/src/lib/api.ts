import { apiOrigin } from './config'

/**
 * HTTP client for the (unchanged) Express API.
 *
 * Auth is header-based, never cookie-based: the server reads `Authorization: Bearer <jwt>`
 * in `srv/middleware.ts`. `Socket-ID` links a request to this tab's WebSocket so that
 * streamed tokens can be routed back to it.
 */

const TOKEN_KEY = 'agnai-auth'

let token: string | null = localStorage.getItem(TOKEN_KEY)
let socketId = ''

export function getToken() {
  return token
}

export function setToken(next: string) {
  token = next
  localStorage.setItem(TOKEN_KEY, next)
}

export function clearToken() {
  token = null
  localStorage.removeItem(TOKEN_KEY)
}

export function setSocketId(id: string) {
  socketId = id
}

/** Thrown for any non-2xx response so callers can decide whether the failure invalidates auth. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

function headers(): Record<string, string> {
  const result: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Socket-ID': socketId,
  }

  if (token) {
    result.Authorization = `Bearer ${token}`
  }

  return result
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${apiOrigin}/api${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await res.json().catch(() => undefined)

  if (!res.ok) {
    // A 401 from an individual resource or provider request does not prove that the stored
    // login token is invalid. Session ownership is decided by Session.init(), which calls
    // the dedicated /user/init endpoint and clears auth only when that check returns 401.
    throw new ApiError(res.status, payload?.message || `${res.status} ${res.statusText}`)
  }

  return payload as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
}
