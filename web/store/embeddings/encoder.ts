import type { AsyncEncoder } from '/common/types'
import { setDefaultEncoder } from '/common/tokenize'
import { embedApi } from './index'

/**
 * Adapter that satisfies `common/tokenize`'s encoder contract using the existing
 * embeddings worker. Registered at boot so token counts behave exactly as before.
 *
 * `embedApi.encode/decode` dispatch to `web/store/embeddings/worker.ts` so that
 * tokenizing long prompts never blocks the UI thread. Keep the worker boundary:
 * running a tokenizer inline on the main thread stalls rendering on large chats.
 *
 * Note: `embedApi` also owns chat/article embedding, caching and toasts, so this is a
 * behaviour-preserving shim rather than a standalone module. A replacement frontend
 * that does not want the rest of `embedApi` needs a token-only worker transport.
 */
export const webEncoder: AsyncEncoder = {
  name: 'default',
  encode: embedApi.encode,
  decode: embedApi.decode,
  count: (text) => embedApi.encode(text).then((tokens) => tokens.length),
}

export function registerWebEncoder() {
  setDefaultEncoder(webEncoder)
}
