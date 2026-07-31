import { wsOrigin } from './config'
import { getToken, setSocketId } from './api'

/**
 * WebSocket client and the application event bus.
 *
 * The server multiplexes everything over a single socket opened at the origin root
 * (`srv/api/ws/setup.ts` upgrades any path). Every frame is `{ type, ...payload }`.
 *
 * Streamed generation arrives here rather than on the HTTP response: the server writes
 * SSE *and* pushes the same events over the socket (`srv/api/chat/inference.ts`), and the
 * socket is the path the legacy client actually consumes.
 *
 * `emit` dispatches into the same listener map, so locally produced events and
 * server-pushed events are indistinguishable to subscribers.
 */

export type SocketEvent = { type: string } & Record<string, unknown>
type Handler = (body: SocketEvent) => void

const listeners = new Map<string, Set<Handler>>()

const BASE_RETRY = 100
const MAX_RETRY = 5000
let retryDelay = 0
let socket: WebSocket | undefined

export function subscribe(type: string, handler: Handler) {
  let set = listeners.get(type)
  if (!set) {
    set = new Set()
    listeners.set(type, set)
  }
  set.add(handler)

  return () => {
    set!.delete(handler)
  }
}

/** Dispatch an event locally without a server round-trip. */
export function emit(event: SocketEvent) {
  for (const handler of listeners.get(event.type) ?? []) {
    handler(event)
  }
}

export function publish(event: SocketEvent) {
  if (socket?.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(event))
}

/**
 * Server-acknowledged authentication.
 *
 * Generation results are routed by `userId` (`srv/api/chat/inference.ts` sendOne), so a
 * request issued before the socket has authenticated would stream into the void. Callers
 * await `socketAuthenticated()` first.
 */
let authed = false
let authWaiters: Array<() => void> = []

/** Sends `login` now if possible, and again on every (re)connect. */
export function authenticateSocket() {
  const token = getToken()
  if (!token) return
  if (socket?.readyState === WebSocket.OPEN) publish({ type: 'login', token })
}

/** Drops server-side authentication so a later login is awaited rather than assumed. */
export function logoutSocket() {
  authed = false
  publish({ type: 'logout' })
}

export function socketAuthenticated(timeoutMs = 10_000) {
  if (authed) return Promise.resolve()

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      authWaiters = authWaiters.filter((waiter) => waiter !== onAuthed)
      reject(new Error('Timed out waiting for the server connection'))
    }, timeoutMs)

    const onAuthed = () => {
      clearTimeout(timer)
      resolve()
    }

    authWaiters.push(onAuthed)
  })
}

/** Idempotent: callers (boot, retry, reconnect timer) may invoke this freely. */
export function connectSocket() {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return

  const ws = new WebSocket(wsOrigin)
  socket = ws

  ws.onopen = () => {
    retryDelay = 0
    publish({ type: 'version', version: 1, sha: 'local' })
    authenticateSocket()
  }

  ws.onmessage = (msg) => {
    let payload: SocketEvent | undefined
    try {
      payload = JSON.parse(msg.data)
    } catch {
      return
    }
    if (!payload?.type) return
    emit(payload)
  }

  ws.onclose = () => {
    authed = false
    retryDelay = retryDelay === 0 ? BASE_RETRY : Math.min(retryDelay * 2, MAX_RETRY)
    setTimeout(connectSocket, retryDelay)
  }
}

subscribe('connected', (body) => {
  if (typeof body.uid === 'string') setSocketId(body.uid)
})
subscribe('ping', () => publish({ type: 'pong' }))
subscribe('login', (body) => {
  authed = body.success === true
  if (!authed) return

  const waiters = authWaiters
  authWaiters = []
  for (const waiter of waiters) waiter()
})
