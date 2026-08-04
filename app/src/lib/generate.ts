import type { AppSchema } from '/common/types'
import { withAssetInstruction } from '/common/assets'
import { expandRisuHistoryRanges } from '/common/risu-import'
import { hasUnresolvedRisuMacros, renderRisuPreset } from '/common/risu-toggles'
import type { ChatDetailResponse, SendMessageBody, SendMessageResponse } from './contracts'
import { createPromptParts } from '/common/prompt'
import { getEncoder, prepareTokenizer } from '/common/tokenize'
import {
  generationSummary,
  redactGenerationSettings,
  resolveGenerationModel,
  type GenerationDebug,
  type GenerationRequestDebug,
} from './generation-debug'
import { api } from './api'
import { socketAuthenticated, subscribe } from './socket'
import { updateChatSummary, type SummaryResult } from './summary'

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

async function buildGenerationDebug(
  text: string,
  request: Omit<GenerationRequestDebug, 'settings'>,
  settings: Partial<AppSchema.GenSettings> | undefined,
  countTokens: (text: string) => Promise<number>
): Promise<GenerationDebug> {
  // Structured messages are what chat adapters consume; completion adapters fall back to the
  // flat prompt. Role labels approximate the small framing overhead while keeping the count
  // tied to the same tokenizer that assembled and trimmed this request.
  const inputText = request.messages.length
    ? request.messages
        .map(({ role, content }) => role + ': ' + content)
        .join(String.fromCharCode(10))
    : request.prompt

  return {
    model: resolveGenerationModel(settings),
    outputTokens: await countTokens(text),
    inputTokens: await countTokens(inputText),
    contextLimit: settings?.maxContextLength,
    request: {
      ...request,
      // Convert the Svelte proxy to plain data and recursively remove credentials.
      settings: redactGenerationSettings(settings),
    },
  }
}

type ChatWithRisuToggles = AppSchema.Chat & { risuToggleValues?: Record<string, string> }

/**
 * Risu toggle macros and chat ranges are views of a preset, not mutations of it. Resolve them
 * immediately before prompt assembly so the editor and exported preset keep the source intact.
 */
function runtimePreset(
  preset: Partial<AppSchema.GenSettings> | undefined,
  chat: AppSchema.Chat,
  messages: AppSchema.ChatMessage[],
  names: { user: string; bot: string }
): Partial<AppSchema.GenSettings> | undefined {
  const rendered = renderRisuPreset(preset, (chat as ChatWithRisuToggles).risuToggleValues)
  if (!rendered?.gaslight) return rendered
  const gaslight = expandRisuHistoryRanges(rendered.gaslight, messages, names)
  if (hasUnresolvedRisuMacros(gaslight)) {
    throw new Error(
      'This preset still contains unresolved RisuAI macros. Re-import it or attach its Risu toggle definition in preset settings.'
    )
  }
  return { ...rendered, gaslight }
}

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
  const settings = runtimePreset(preset, chat, messages, {
    user: impersonate?.name ?? profile.handle,
    bot: char.name,
  })

  // Model families tokenise differently and the count drives prompt trimming, so honour
  // the preset's tokenizer instead of the built-in cl100k default.
  if (settings?.tokenizer) await prepareTokenizer(settings.tokenizer)
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
      settings,
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

  const request = inferencePrompt(prompt, messages)
  const inferenceRequest = {
    requestId: control.requestId,
    chatId: chat._id,
    // Appended after assembly rather than through a placeholder: an asset the model was never
    // told about can never be shown, so this must not depend on the user editing a template.
    prompt: withAssetInstruction(request.prompt, char.assets),
    messages: request.messages,
  }
  const reply = await stream(
    inferenceRequest.requestId,
    inferenceRequest.prompt,
    inferenceRequest.messages,
    settings,
    user,
    chat._id,
    handlers
  )

  // Aborted: keep the persisted user message but drop the partial reply so a reload shows
  // a clean turn instead of a truncated bot message.
  if (!reply || control.stopped) return { userMessage: userMessage.message, botMessage: undefined }

  const debug = await buildGenerationDebug(reply, inferenceRequest, settings, encoder)
  const botMessage = await api.post<SendMessageResponse>(`/chat/${chat._id}/send`, {
    text: reply,
    messageId: newId(),
    parent: userMessage.message._id,
    bot: true,
    // `characterId`/`name` are taken from `impersonate` (srv/api/chat/message.ts:135,140);
    // without it the reply is stored unattributed and renders as the user's own message.
    impersonate: char,
    meta: { generation: generationSummary(debug) },
  } satisfies SendMessageBody)

  void summariseChat({ detail, user, profile, settings, messages, assembled: prompt, impersonate })

  return { userMessage: userMessage.message, botMessage: botMessage.message, debug }
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
  const settings = runtimePreset(preset, chat, messages, {
    user: impersonate?.name ?? profile.handle,
    bot: char.name,
  })

  if (settings?.tokenizer) await prepareTokenizer(settings.tokenizer)
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
      settings,
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

  const request = inferencePrompt(prompt, messages)
  const inferenceRequest = {
    requestId: control.requestId,
    chatId: chat._id,
    // Appended after assembly rather than through a placeholder: an asset the model was never
    // told about can never be shown, so this must not depend on the user editing a template.
    prompt: withAssetInstruction(request.prompt, char.assets),
    messages: request.messages,
  }
  const reply = await stream(
    inferenceRequest.requestId,
    inferenceRequest.prompt,
    inferenceRequest.messages,
    settings,
    user,
    chat._id,
    handlers
  )

  if (!reply || control.stopped) return undefined

  const debug = await buildGenerationDebug(reply, inferenceRequest, settings, encoder)
  void summariseChat({ detail, user, profile, settings, messages, assembled: prompt, impersonate })

  return { text: reply, debug }
}

/**
 * Prefer the structured role blocks produced by the template parser. Gemini rejects a request
 * that contains only a system instruction, so imported Risu templates that placed chat history
 * inside system blocks get the latest user turn appended as a real user message. The flat prompt
 * remains available for completion-style adapters.
 */
function inferencePrompt(
  assembled: Awaited<ReturnType<typeof createPromptParts>>,
  history: AppSchema.ChatMessage[]
) {
  const prompt = (assembled.template.parsed || assembled.template.blockPrompt || '').trim()
  const messages = assembled.template.blocks
    .filter((block) => block.content.trim())
    .map((block) => ({ role: block.role, content: block.content.trim() }))

  if (!messages.some((block) => block.role === 'user')) {
    const latest = [...history].reverse().find((message) => !!message.userId && message.msg.trim())
    if (latest) messages.push({ role: 'user', content: latest.msg.trim() })
  }

  if (!prompt && !messages.length) {
    throw new Error('The imported preset produced an empty inference request')
  }

  return { prompt, messages }
}

/**
 * `POST /chat/inference-stream` answers over the WebSocket as well as SSE
 * (`srv/api/chat/inference.ts` `wrapped`). The socket is used here so that the HTTP call
 * stays a plain JSON request.
 */
async function stream(
  requestId: string,
  prompt: string,
  messages: Array<{ role: string; content: string }>,
  settings: Partial<AppSchema.GenSettings> | undefined,
  user: AppSchema.User,
  chatId: string,
  handlers: StreamHandlers,
  /** Names a lock separate from the chat's message lock, so background work runs alongside a reply */
  lockScope?: string
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
      .post('/chat/inference-stream', {
        requestId,
        prompt,
        messages,
        settings,
        user,
        chatId,
        lockScope,
      })
      .catch((ex: unknown) => fail(ex instanceof Error ? ex.message : 'Request failed'))
  })
}

/**
 * Folds the messages that just fell out of the context window into the chat's rolling summary.
 *
 * Takes the prompt that was already assembled for the reply: `linesAddedCount` is how many history
 * lines survived the token fit, which is what makes "no longer visible to the model" measurable.
 *
 * Callers should not await this. The reply is already persisted and a second inference must never
 * delay it; `updateChatSummary` swallows its own failures.
 */
export async function summariseChat(opts: {
  detail: ChatDetailResponse
  user: AppSchema.User
  profile: AppSchema.Profile
  settings: Partial<AppSchema.GenSettings> | undefined
  messages: AppSchema.ChatMessage[]
  assembled: Awaited<ReturnType<typeof createPromptParts>>
  impersonate?: AppSchema.Character
}): Promise<SummaryResult | undefined> {
  const { detail } = opts
  const char = detail.character ?? detail.characters.find((c) => c._id === detail.chat.characterId)
  if (!char) return

  return updateChatSummary({
    chat: detail.chat,
    char,
    characters: detail.characters,
    members: detail.members,
    sender: opts.profile,
    impersonate: opts.impersonate,
    user: opts.user,
    messages: opts.messages,
    settings: opts.settings,
    history: opts.assembled.lines,
    linesAddedCount: opts.assembled.template.linesAddedCount,
    infer: ({ prompt, settings, lockScope }) =>
      stream(
        newId(),
        prompt,
        [],
        settings,
        opts.user,
        detail.chat._id,
        { onPartial: () => {}, onDone: () => {}, onError: () => {} },
        lockScope
      ),
  })
}
