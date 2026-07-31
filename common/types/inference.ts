import type { JsonField, PromptPlaceholders } from '../prompt'
import type { AppSchema } from './schema'
import type { StructureEntities } from '../guidance/json-schema'
import type { Memory } from './index'
import type { ThirdPartyFormat } from '../adapters'
import type { AppLog } from '../logger'

/**
 * Inference DTOs shared by the server, the shared prompt layer and the browser.
 *
 * These used to live in `srv/adapter/type.ts`, which also holds server-only contracts
 * (`AdapterProps`, `ModelAdapter`, `GenerateOptions`). Keeping the shared subset here lets
 * `common/` and the frontend stay off the `srv/` import graph; `srv/adapter/type.ts`
 * re-exports everything below, so server callers are unaffected.
 */

export type MsgAttachment = { type: 'image'; image: string }
export type RequestAttachments = { [messageId: string]: MsgAttachment[] }

export type HistoryLine = {
  _id: string
  msg: string
  role: 'user' | 'model'
  json: Record<string, string>
}

export type ChatRole = 'user' | 'assistant' | 'system'

export type Completion<T = Inference> = {
  id: string
  created: number
  model: string
  object: string
  choices: CompletionContent<T>
  error?: { message: string }
}

export type CompletionTick =
  | { token: string }
  | { tokens: string; gens?: string[] }
  | { tokens: string }
  | { thoughts: string }
  | void

export type CompletionGenerator<T = Completion> = (opts: {
  userId: string
  url: string
  headers: Record<string, string | string[] | number>
  body: any
  service: string
  signal: AbortController
  log: AppLog | undefined
  format?: ThirdPartyFormat | 'openrouter' | 'raw'
}) => AsyncGenerator<
  { error?: string; tokens?: string; token?: string; index?: any; thoughts?: string } | T,
  T | undefined
>

export type CompletionItem<T extends string = ChatRole> = {
  role: T
  content: string
  name?: string
}

export type CompletionContent<T> = Array<
  { finish_reason: string; index: number } & ({ text: string } | T)
>

export type Inference = { message: { content: string; role: ChatRole } }
export type AsyncDelta = { delta: Partial<Inference['message']> }

/**
 * Structural form of `getSubscriptionPreset()` in `srv/adapter/agnaistic.ts`.
 *
 * Declared explicitly rather than inferred from that function so the type does not drag
 * the agnaistic adapter -- and with it the whole server graph -- into shared code.
 */
export type SubscriptionPreset = {
  level: number
  preset: AppSchema.SubscriptionModel | undefined
  error?: string
  warning?: string
  tier?: AppSchema.SubscriptionTier
}

export type GenerateRequestV2 = {
  requestId: string
  v?: number
  kind:
    | 'send'
    | 'send-event:world'
    | 'send-event:character'
    | 'send-event:hidden'
    | 'send-event:ooc'
    | 'send-noreply'
    | 'ooc'
    | 'retry'
    | 'continue'
    | 'self'
    | 'summary'
    | 'request'
    | 'plain'
    | 'chat-query'

  /** For chat-adjacent tasks such as captioning, summarizing, etc */
  systemPrompt?: string

  chat: AppSchema.Chat
  char: AppSchema.Character
  replyAs: AppSchema.Character
  user: AppSchema.User
  members: AppSchema.Profile[]
  sender: AppSchema.Profile

  parts: PromptPlaceholders

  history?: HistoryLine[]

  linesCount?: number
  text?: string
  settings?: Partial<AppSchema.GenSettings>
  replacing?: AppSchema.ChatMessage
  continuing?: AppSchema.ChatMessage
  characters: Record<string, AppSchema.Character>
  impersonate?: AppSchema.Character
  book?: AppSchema.MemoryBook
  resolvedScenario?: string

  jsonSchema?: { fields: JsonField[]; entities: StructureEntities }
  jsonValues?: Record<string, any>

  /** Base64 attachments */
  attachments?: RequestAttachments
  indexes?: { [messageId: string]: number }
  hasAttachments?: boolean

  /** Chat Tree  */
  parent?: string

  /** Date ISO string */
  lastMessage?: string

  chatEmbeds?: Array<Memory.UserEmbed<{ name: string }>>
  userEmbeds?: Memory.UserEmbed[]

  /**
   * For 'local requests'
   * If the response is generated on the client, we pass the generated response here
   * then pass the whole payload to the same endpoint, but skip the generation to re-use the same message creation logic
   */
  response?: string
  eventStream?: boolean
  subscription?: SubscriptionPreset

  /** Deprecated fields */
  lines: string[] /** Deprecated */
  imageData?: string /** Deprecated */
  reschemaPrompt?: string /** Deprecated */
}
