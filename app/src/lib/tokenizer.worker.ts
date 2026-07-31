import { getEncoding } from 'js-tiktoken'

/**
 * Tokenizer worker.
 *
 * Encoding runs off the main thread: prompt assembly tokenises the whole chat history on
 * every send, which visibly stalls rendering on long chats if done inline.
 */
type Request =
  | { id: string; op: 'encode'; text: string }
  | { id: string; op: 'decode'; tokens: number[] }

const encoder = getEncoding('cl100k_base')

self.onmessage = (event: MessageEvent<Request>) => {
  const req = event.data

  if (req.op === 'encode') {
    self.postMessage({ id: req.id, tokens: encoder.encode(req.text) })
    return
  }

  self.postMessage({ id: req.id, text: encoder.decode(req.tokens) })
}
