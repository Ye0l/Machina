import type { AsyncEncoder } from '/common/types'
import { setDefaultEncoder } from '/common/tokenize'
import TokenizerWorker from './tokenizer.worker?worker'

/**
 * Worker-backed encoder registered into `common/tokenize`.
 *
 * `common/` intentionally ships no tokenizer: token counts drive prompt trimming, so it
 * fails loudly rather than guessing. This adapter keeps that contract -- a dead worker or
 * a malformed reply rejects instead of yielding a plausible-but-wrong count.
 *
 * Encoding runs off the main thread because prompt assembly tokenises the whole chat
 * history on every send.
 */
type Reply = { id: string; tokens?: number[]; text?: string }
type Deferred = { resolve: (value: Reply) => void; reject: (reason: Error) => void }

const REQUEST_TIMEOUT_MS = 15_000

const pending = new Map<string, Deferred>()
let worker: Worker | undefined
let nextId = 0

function failAll(reason: string) {
  for (const [id, deferred] of pending) {
    pending.delete(id)
    deferred.reject(new Error(reason))
  }
  worker = undefined
}

function getWorker() {
  if (worker) return worker

  const next = new TokenizerWorker()

  next.onmessage = (event: MessageEvent<Reply>) => {
    const deferred = pending.get(event.data?.id)
    if (!deferred) return
    pending.delete(event.data.id)
    deferred.resolve(event.data)
  }

  next.onerror = () => failAll('Tokenizer worker crashed')
  next.onmessageerror = () => failAll('Tokenizer worker sent an undeserialisable message')

  worker = next
  return next
}

function post(request: { op: 'encode'; text: string } | { op: 'decode'; tokens: number[] }) {
  const id = String(nextId++)

  const reply = new Promise<Reply>((resolve, reject) => {
    pending.set(id, { resolve, reject })

    setTimeout(() => {
      if (!pending.delete(id)) return
      reject(new Error(`Tokenizer did not respond within ${REQUEST_TIMEOUT_MS}ms`))
    }, REQUEST_TIMEOUT_MS)
  })

  getWorker().postMessage({ id, ...request })
  return reply
}

async function encode(text: string) {
  const { tokens } = await post({ op: 'encode', text })
  if (!Array.isArray(tokens)) throw new Error('Tokenizer returned no tokens')
  return tokens
}

export const webEncoder: AsyncEncoder = {
  name: 'cl100k_base',
  encode,
  count: (text) => encode(text).then((tokens) => tokens.length),
  decode: async (tokens) => {
    const reply = await post({ op: 'decode', tokens })
    if (typeof reply.text !== 'string') throw new Error('Tokenizer returned no text')
    return reply.text
  },
}

export function registerEncoder() {
  setDefaultEncoder(webEncoder)
}
