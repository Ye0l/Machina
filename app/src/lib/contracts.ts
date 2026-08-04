import type { AppSchema } from '/common/types'

/**
 * Response contracts for the endpoints this app calls.
 *
 * Auth screens only read a handful of fields, but the generation path feeds these objects
 * straight into `common/prompt`, so it needs the real `AppSchema` shapes. Now that the
 * shared layer no longer reaches into `srv/`, importing them here costs nothing.
 */

export type LoginResponse = {
  token: string
  user: AppSchema.User
  profile: AppSchema.Profile
}

/** `GET /api/user/init` (srv/api/user/settings.ts getInitialLoad). */
export type InitResponse = {
  user: AppSchema.User
  profile: AppSchema.Profile
  presets: AppSchema.UserGenPreset[]
}

/** Projection returned by `GET /api/character` (srv/db/characters.ts getCharacters). */
export type CharacterSummary = Pick<
  AppSchema.Character,
  '_id' | 'name' | 'avatar' | 'description' | 'favorite' | 'updatedAt' | 'tags' | 'folder'
>

export type ChatSummary = Pick<
  AppSchema.Chat,
  '_id' | 'name' | 'characterId' | 'updatedAt' | 'genPreset'
>

/** `GET /api/chat/:id` (srv/api/chat/get.ts getChatDetail). */
export type ChatDetailResponse = {
  chat: AppSchema.Chat
  messages: AppSchema.ChatMessage[]
  character?: AppSchema.Character
  characters: AppSchema.Character[]
  members: AppSchema.Profile[]
}

export type SendMessageBody = {
  text: string
  messageId?: string
  parent?: string
  bot?: boolean
  ooc?: boolean
  kind?: string
  /** Source of the message's `characterId` and `name` (srv/api/chat/message.ts:108,135). */
  impersonate?: AppSchema.Character
  meta?: unknown
}

export type SendMessageResponse = { success: boolean; message: AppSchema.ChatMessage }

/** `DELETE /api/chat/:chatId/messages-v2` returns tree relinking updates. */
export type DeleteMessagesResponse = {
  chat: Partial<AppSchema.Chat>
  messages: Array<Pick<AppSchema.ChatMessage, '_id' | 'parent'>>
}

export type BranchChatResponse = {
  chat: AppSchema.Chat
  messages: AppSchema.ChatMessage[]
}

export type DeleteChatResponse = { success: boolean }
