import type { AppSchema } from '/common/types'
import { withAssetInstruction } from '/common/assets'
import type { ChatDetailResponse, SendMessageBody, SendMessageResponse } from './contracts'
import { createPromptParts } from '/common/prompt'
import { getEncoder, prepareTokenizer } from '/common/tokenize'
import { api } from './api'
import { socketAuthenticated, subscribe } from './socket'

/**
 * Browser-side generation, mirroring the legacy pipeline in
 * `web/store/data/bot-generate.ts`:
 *
 *   1. persist the user message  -> POST /chat/:id/send
 *   2. assemble the prompt here  -> common/prompt createPromptParts
 *   3. stream it                 -> POST /chat/inference-stream
 *   4. persist the reply         -> POST /chat/:id/send { bot: true }
 *
 * Step 4 matters: `/chat/inference-stream` only generates. Without it the reply renders
 * but vanishes on reload. (`/chat/:id/generate` is the other design -- server-side
 * assembly *and* persistence -- and must not be mixed with this one.)
 */

export type StreamHandlers = {
  onPartial: (text: string) => void
  onDone: (text: string) => void
  onError: (error: string) => void
  /** Persisted user message, emitted before prompt assembly and inference begin. */
  onUserMessage?: (message: AppSchema.ChatMessage) => void
}

export type SendControl = {
  /** requestId of the in-flight stream; assigned by sendMessage / generateLastReply. */
  requestId: string
  /** Flipped by the caller to request an abort mid-stream. */
  stopped: boolean
}

/**
 * Aborts a running inference stream on the server
 * (`srv/api/chat/inference.ts` `cancelInference`). The server aborts the underlying
 * request, the stream resolves with whatever partial it had, and the caller decides
 * whether to keep it.
 */
export async function cancelGeneration(requestId: string) {
  return api.post<{ success: boolean; aborted: boolean }>('/chat/inference-cancel', { requestId })
}

const STREAM_TIMEOUT_MS = 120_000

const newId = () => crypto.randomUUID()

export async function sendMessage(
  detail: ChatDetailResponse,
  user: AppSchema.User,
  profile: AppSchema.Profile,
  preset: Partial<AppSchema.GenSettings> | undefined,
  text: string,
  handlers: StreamHandlers,
  control: SendControl,
  book?: AppSchema.MemoryBook,
  impersonate?: AppSchema.Character
) {
  const { chat, characters } = detail
  const char = detail.character ?? characters.find((c) => c._id === chat.characterId)
  if (!char) throw new Error('Chat has no character')

  // Assigned up front so `cancelGeneration` can target this stream before it starts.
  control.requestId = newId()

  const parent = detail.messages.at(-1)?._id

  const userMessage = await api.post<SendMessageResponse>(`/chat/${chat._id}/send`, {
    text,
    messageId: newId(),
    parent,
    impersonate,
  })
  handlers.onUserMessage?.(userMessage.message)

  const messages = [...detail.messages, userMessage.message]

  // Model families tokenise differently and the count drives prompt trimming, so honour
  // the preset's tokenizer instead of the built-in cl100k default.
  if (preset?.tokenizer) await prepareTokenizer(preset.tokenizer)
  const encoder = await getEncoder()

  const prompt = await createPromptParts(
    {
      char,
      chat,
      user,
      sender: profile,
      members: detail.members,
      replyAs: char,
      characters: Object.fromEntries(characters.map((c) => [c._id, c])),
      messages,
      settings: preset,
      lastMessage: messages.at(-1)?.createdAt ?? '',
      chatEmbeds: [],
      userEmbeds: [],
      resolvedScenario: chat.scenario ?? char.scenario ?? '',
      jsonValues: undefined,
      // The chat's attached memory book. `common/prompt` also folds in the replying
      // character's and the persona's own `characterBook`, so only the chat-level one is
      // supplied here.
      book,
      // Who the user is speaking as; drives the sender name and `{{impersonating}}`.
      impersonate,
      kind: 'send',
    },
    encoder
  )

  const reply = await stream(
    control.requestId,
    // Appended after assembly rather than through a placeholder: an asset the model was never
    // told about can never be shown, so this must not depend on the user editing a template.
    withAssetInstruction(prompt.template.parsed, char.assets),
    preset,
    user,
    chat._id,
    handlers
  )

  // Aborted: keep the persisted user message but drop the partial reply so a reload shows
  // a clean turn instead of a truncated bot message.
  if (!reply || control.stopped) return { userMessage: userMessage.message, botMessage: undefined }

  const botMessage = await api.post<SendMessageResponse>(`/chat/${chat._id}/send`, {
    text: reply,
    messageId: newId(),
    parent: userMessage.message._id,
    bot: true,
    // `characterId`/`name` are taken from `impersonate` (srv/api/chat/message.ts:135,140);
    // without it the reply is stored unattributed and renders as the user's own message.
    impersonate: char,
  } satisfies SendMessageBody)

  return { userMessage: userMessage.message, botMessage: botMessage.message }
}

/**
 * Generates another reply to the user message at the end of `detail.messages`.
 * Persistence is deliberately owned by `Chats.retry`: a failed-turn resend creates a
 * bot message, while a reroll stores the text as another variant of the existing bubble.
 */
export async function generateLastReply(
  detail: ChatDetailResponse,
  user: AppSchema.User,
  profile: AppSchema.Profile,
  preset: Partial<AppSchema.GenSettings> | undefined,
  handlers: StreamHandlers,
  control: SendControl,
  book?: AppSchema.MemoryBook,
  impersonate?: AppSchema.Character
) {
  const { chat, characters } = detail
  const char = detail.character ?? characters.find((c) => c._id === chat.characterId)
  if (!char) throw new Error('Chat has no character')

  const messages = detail.messages
  const parent = messages.at(-1)?._id
  if (!parent) return undefined

  control.requestId = newId()

  if (preset?.tokenizer) await prepareTokenizer(preset.tokenizer)
  const encoder = await getEncoder()

  const prompt = await createPromptParts(
    {
      char,
      chat,
      user,
      sender: profile,
      members: detail.members,
      replyAs: char,
      characters: Object.fromEntries(characters.map((c) => [c._id, c])),
      messages,
      settings: preset,
      lastMessage: messages.at(-1)?.createdAt ?? '',
      chatEmbeds: [],
      userEmbeds: [],
      resolvedScenario: chat.scenario ?? char.scenario ?? '',
      jsonValues: undefined,
      // The chat's attached memory book. `common/prompt` also folds in the replying
      // character's and the persona's own `characterBook`, so only the chat-level one is
      // supplied here.
      book,
      // Who the user is speaking as; drives the sender name and `{{impersonating}}`.
      impersonate,
      kind: 'send',
    },
    encoder
  )

  const reply = await stream(
    control.requestId,
    // Appended after assembly rather than through a placeholder: an asset the model was never
    // told about can never be shown, so this must not depend on the user editing a template.
    withAssetInstruction(prompt.template.parsed, char.assets),
    preset,
    user,
    chat._id,
    handlers
  )

  if (!reply || control.stopped) return undefined
  return reply
}

/**
 * `POST /chat/inference-stream` answers over the WebSocket as well as SSE
 * (`srv/api/chat/inference.ts` `wrapped`). The socket is used here so that the HTTP call
 * stays a plain JSON request.
 */
async function stream(
  requestId: string,
  prompt: string,
  settings: Partial<AppSchema.GenSettings> | undefined,
  user: AppSchema.User,
  chatId: string,
  handlers: StreamHandlers
) {
  // Results are pushed to the socket keyed by userId, so a request sent before the socket
  // has authenticated would stream into the void.
  await socketAuthenticated()

  return new Promise<string>((resolve, reject) => {
    const unsubscribe: Array<() => void> = []

    const timer = setTimeout(() => {
      fail('The server stopped responding')
    }, STREAM_TIMEOUT_MS)

    const settle = (fn: () => void) => {
      clearTimeout(timer)
      for (const off of unsubscribe) off()
      unsubscribe.length = 0
      fn()
    }

    const fail = (error: string) =>
      settle(() => {
        handlers.onError(error)
        reject(new Error(error))
      })

    unsubscribe.push(
      subscribe('inference-partial', (body) => {
        if (body.requestId !== requestId) return
        if (typeof body.partial === 'string') handlers.onPartial(body.partial)
      }),
      subscribe('inference-error', (body) => {
        if (body.requestId !== requestId) return
        fail(typeof body.error === 'string' ? body.error : 'Generation failed')
      }),
      subscribe('inference', (body) => {
        if (body.requestId !== requestId) return
        const response = typeof body.response === 'string' ? body.response : ''
        settle(() => {
          handlers.onDone(response)
          resolve(response)
        })
      })
    )

    api
      .post('/chat/inference-stream', { requestId, prompt, settings, user, chatId })
      .catch((ex: unknown) => fail(ex instanceof Error ? ex.message : 'Request failed'))
  })
}
