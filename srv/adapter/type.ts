import type { PromptLine, PromptPlaceholders } from '../../common/prompt'
import { AppSchema } from '../../common/types/schema'
import { AppLog } from '../middleware'
import { PresetConnection } from '/common/providers'
import { TokenCounter } from '/common/types'
import type {
  GenerateRequestV2,
  RequestAttachments,
  SubscriptionPreset,
} from '/common/types/inference'

/**
 * Shared inference DTOs now live in `common/types/inference.ts` so that the shared prompt
 * layer and the frontend do not have to resolve into `srv/`. Re-exported here to keep the
 * server's existing import sites working.
 */
export type {
  AsyncDelta,
  ChatRole,
  Completion,
  CompletionContent,
  CompletionGenerator,
  CompletionItem,
  CompletionTick,
  GenerateRequestV2,
  HistoryLine,
  Inference,
  MsgAttachment,
  RequestAttachments,
  SubscriptionPreset,
} from '/common/types/inference'

export type GenerateOptions = {
  senderId: string
  chatId: string
  message: string
  log: AppLog
  retry?: AppSchema.ChatMessage
  continue?: string
}

export type AdapterProps = {
  kind: GenerateRequestV2['kind']
  conn: PresetConnection
  chat: AppSchema.Chat
  char: AppSchema.Character
  replyAs: AppSchema.Character
  user: AppSchema.User
  members: AppSchema.Profile[]
  sender: AppSchema.Profile

  prompt: string
  messages?: Array<{ role: string; content: string }>

  parts: PromptPlaceholders

  lines: string[]
  promptLines: PromptLine[]

  characters: Record<string, AppSchema.Character>
  impersonate: AppSchema.Character | undefined
  lastMessage?: string
  requestId: string
  encoder?: TokenCounter

  jsonSchema?: any
  reschemaPrompt?: string
  jsonValues: Record<string, any> | undefined

  hasAttachments?: boolean
  imageData?: string
  attachments?: RequestAttachments

  guidance?: boolean
  placeholders?: Record<string, string>
  lists?: Record<string, string[]>
  previous?: Record<string, string>

  subscription?: SubscriptionPreset

  /** GenSettings mapped to an object for the target adapter */
  gen: Partial<AppSchema.GenSettings>
  mappedSettings: any
  guest?: string
  log: AppLog
  isThirdParty: boolean
  inserts?: Map<number, string>
  contextSize?: number
  signal: AbortController
}

export type ModelAdapter = (
  opts: AdapterProps
) => AsyncGenerator<
  | string
  | { gens: string[] }
  | { partial: string }
  | { error: any }
  | { meta: any }
  | { prompt: any }
  | { warning: string }
  | { thoughts: string }
>
