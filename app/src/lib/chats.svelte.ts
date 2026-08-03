import type {
  CharacterSummary,
  ChatDetailResponse,
  ChatSummary,
  DeleteChatResponse,
  DeleteMessagesResponse,
  SendMessageResponse,
} from './contracts'
import type { AppSchema } from '/common/types'

import { defaultPresets, isDefaultPreset } from '/common/default-preset'
import { api } from './api'
import { books } from './books.svelte'
import { cancelGeneration, generateLastReply, sendMessage, type SendControl } from './generate'
import { personas } from './personas.svelte'
import { toImpersonate } from '/common/persona'
import { session } from './session.svelte'
import { subscribe } from './socket'
const delay = (ms: number) => {
  const { promise, resolve } = Promise.withResolvers<void>()
  setTimeout(resolve, ms)
  return promise
}

export type CharacterDraft = {
  name: string
  description: string
  persona: AppSchema.Persona
  scenario: string
  greeting: string
  sampleChat: string
  systemPrompt: string
  postHistoryInstructions: string
}

/**
 * Character / chat / message state for the core path.
 *
 * Note `GET /api/chat/:id` is the only endpoint that returns a chat with its messages,
 * characters and members in one payload (`srv/api/chat/get.ts` getChatDetail), so opening
 * a chat is a single request.
 */
class Chats {
  characters = $state<CharacterSummary[]>([])
  chats = $state<ChatSummary[]>([])

  detail = $state<ChatDetailResponse | undefined>()
  messages = $state<AppSchema.ChatMessage[]>([])

  /** Text streamed so far for the in-flight reply; empty when idle. */
  partial = $state('')
  generating = $state(false)
  /** Stop requested for the in-flight reply; clears once the stream settles. */
  stopping = $state(false)
  /** Current visible position for messages with alternate responses. */
  variantPositions = $state<Record<string, number>>({})
  private control: SendControl | undefined

  loading = $state(false)
  error = $state('')
  loaded = $state(false)

  /**
   * Dedicated in-flight guard for the list load. `loading` cannot serve this purpose: it is
   * shared with `openChat`, so a chat deep link (which opens a chat before the shell
   * mounts) would otherwise suppress the character and chat list entirely.
   */
  private listing = false

  async loadCharacters(force = false) {
    if ((this.loaded && !force) || this.listing) return

    this.listing = true
    this.loading = true
    this.error = ''
    try {
      const [chars, chats] = await Promise.all([
        api.get<{ characters: CharacterSummary[] }>('/character'),
        api.get<{ chats: ChatSummary[] }>('/chat'),
      ])
      this.characters = chars.characters ?? []
      this.chats = chats.chats ?? []
      this.loaded = true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to load characters'
    } finally {
      this.listing = false
      this.loading = false
    }
  }

  async getCharacter(characterId: string) {
    return api.get<AppSchema.Character>(`/character/${characterId}`)
  }

  async saveCharacter(characterId: string | null, draft: CharacterDraft) {
    const body = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      persona: draft.persona,
      scenario: draft.scenario,
      greeting: draft.greeting,
      sampleChat: draft.sampleChat,
      systemPrompt: draft.systemPrompt,
      postHistoryInstructions: draft.postHistoryInstructions,
    }

    const character = characterId
      ? await api.post<AppSchema.Character>(`/character/${characterId}/update`, body)
      : await api.post<AppSchema.Character>('/character', {
          ...body,
          persona: JSON.stringify(body.persona),
        })

    const index = this.characters.findIndex((item) => item._id === character._id)
    if (index === -1) {
      this.characters = [character, ...this.characters]
    } else {
      this.characters = this.characters.map((item) =>
        item._id === character._id ? character : item
      )
    }

    return character
  }

  async openChat(chatId: string) {
    const switchingChat = this.detail?.chat._id !== chatId
    this.loading = true
    this.error = ''
    try {
      const detail = await api.get<ChatDetailResponse>(`/chat/${chatId}`)
      this.detail = detail
      this.messages = detail.messages ?? []
      if (switchingChat) this.variantPositions = {}
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to open chat'
    } finally {
      this.loading = false
    }
  }

  /**
   * Every chat belonging to one character, newest first (`GET /chat/:id/chats`).
   *
   * The endpoint returns the character's whole list -- there is no server-side paging -- so
   * the caller is responsible for rendering it incrementally.
   */
  async listForCharacter(characterId: string): Promise<ChatSummary[]> {
    const res = await api.get<{ character: AppSchema.Character; chats: ChatSummary[] }>(
      `/chat/${characterId}/chats`
    )
    return (res.chats ?? [])
      .slice()
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  }

  /**
   * Reuses the most recent chat for a character, creating one only when none exists.
   *
   * Returns the chat id rather than opening it: the caller navigates to `/chat/:id` and the
   * route is what loads the chat, so the URL stays the single source of truth.
   */
  async resolveChatFor(character: CharacterSummary): Promise<string | undefined> {
    const existing = this.chats
      .filter((chat) => chat.characterId === character._id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

    if (existing) return existing._id

    this.loading = true
    this.error = ''
    try {
      const created = await api.post<ChatSummary>('/chat', {
        characterId: character._id,
        name: character.name,
        mode: null,
      })
      this.chats = [created, ...this.chats]
      return created._id
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to create chat'
    } finally {
      this.loading = false
    }
  }

  /**
   * `chat.genPreset` is either a user preset id or a builtin name (`agnaistic`, `openai`,
   * ...). Builtins are not in `/user/init`'s preset list, so resolving only against that
   * list would drop the chat's own settings and let the server fall back to the account
   * default.
   */
  private resolvePreset(genPreset: string | undefined) {
    if (!genPreset) return undefined

    const owned = session.presets.find((p) => p._id === genPreset)
    if (owned) return owned

    return isDefaultPreset(genPreset) ? defaultPresets[genPreset] : undefined
  }

  /**
   * The chat's attached memory book, if it still exists. `common/prompt` folds in the
   * character's own `characterBook` separately, so only the chat-level book is resolved.
   */
  private memoryBook() {
    const memoryId = this.detail?.chat.memoryId
    return memoryId ? books.get(memoryId) : undefined
  }

  /**
   * The selected persona in the character shape `impersonate` is typed as. Undefined means
   * speaking as the account profile, which is a real choice rather than an absence.
   */
  private impersonate() {
    const selected = personas.selected
    return selected ? toImpersonate(selected) : undefined
  }

  private setMessages(messages: AppSchema.ChatMessage[]) {
    this.messages = messages
    if (this.detail) this.detail = { ...this.detail, messages }
  }

  async send(text: string) {
    const detail = this.detail
    const user = session.user
    const profile = session.profile
    if (!detail || !user || !profile || this.generating) return

    const control: SendControl = { requestId: '', stopped: false }
    this.control = control
    this.generating = true
    this.stopping = false
    this.partial = ''
    this.error = ''

    const preset = this.resolvePreset(detail.chat.genPreset)

    try {
      const result = await sendMessage(
        detail,
        user,
        profile,
        preset,
        text,
        {
          onPartial: (value) => (this.partial = value),
          onDone: () => (this.partial = ''),
          onError: (value) => (this.error = value),
          onUserMessage: (message) => {
            const messages = [...this.messages.filter((item) => item._id !== message._id), message]
            this.setMessages(messages)
          },
        },
        control,
        this.memoryBook(),
        this.impersonate()
      )

      // Re-read rather than splice locally: the server assigns ids, parents and timestamps.
      await this.openChat(detail.chat._id)
      return result
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Generation failed'
    } finally {
      this.generating = false
      this.stopping = false
      this.partial = ''
      this.control = undefined
    }
  }

  /** Aborts the in-flight generation. The stream resolves with its partial, which is dropped. */
  async stop() {
    const control = this.control
    if (!control || !this.generating || control.stopped) return
    control.stopped = true
    this.stopping = true
    try {
      // The button appears while the browser is still assembling the prompt. If the first
      // cancel arrives before the server has registered its controller, retry briefly.
      for (let attempt = 0; attempt < 15 && this.control === control; attempt++) {
        if ((await cancelGeneration(control.requestId)).aborted) break
        await delay(100)
      }
    } catch {
      // Best-effort: the stream still resolves on its own via the final inference event.
    }
  }

  /**
   * Retries the current turn without duplicating its user message.
   *
   * - Last message is a user message: generate and persist the missing bot reply.
   * - Last message is a bot message: generate against its parent user turn, then keep the
   *   old response in `retries` and make the new response the visible variant.
   */
  async retry() {
    const detail = this.detail
    const user = session.user
    const profile = session.profile
    if (!detail || !user || !profile || this.generating) return

    const last = this.messages.at(-1)
    if (!last) return
    // `userId`, not `characterId`: an impersonated user message carries both
    // (srv/api/chat/message.ts:135), so a persona would otherwise look like a bot reply.
    const rerolling = !last.userId
    const promptMessages = rerolling ? this.messages.slice(0, -1) : this.messages
    if (!promptMessages.length || !promptMessages.at(-1)?.userId) return

    const control: SendControl = { requestId: '', stopped: false }
    this.control = control
    this.generating = true
    this.stopping = false
    this.partial = ''
    this.error = ''

    const preset = this.resolvePreset(detail.chat.genPreset)

    try {
      const reply = await generateLastReply(
        { ...detail, messages: promptMessages },
        user,
        profile,
        preset,
        {
          onPartial: (value) => (this.partial = value),
          onDone: () => (this.partial = ''),
          onError: (value) => (this.error = value),
        },
        control,
        this.memoryBook(),
        this.impersonate()
      )
      if (!reply || control.stopped) return

      if (rerolling) {
        const priorRetries = last.retries ?? []
        const priorTotal = priorRetries.length + 1
        const currentPosition = this.variantPositions[last._id] ?? 0
        const retries = Array<string>(priorTotal)
        retries[currentPosition] = last.msg
        priorRetries.forEach((text, index) => {
          retries[(currentPosition + index + 1) % priorTotal] = text
        })
        await api.put(`/chat/${last._id}/message-swap`, { msg: reply, retries })
        this.setMessages(
          this.messages.map((message) =>
            message._id === last._id ? { ...message, msg: reply, retries } : message
          )
        )
        this.variantPositions = {
          ...this.variantPositions,
          [last._id]: retries.length,
        }
      } else {
        const char =
          detail.character ??
          detail.characters.find((character) => character._id === detail.chat.characterId)
        if (!char) throw new Error('Chat has no character')
        await api.post<SendMessageResponse>(`/chat/${detail.chat._id}/send`, {
          text: reply,
          messageId: crypto.randomUUID(),
          parent: last._id,
          bot: true,
          impersonate: char,
        })
        await this.openChat(detail.chat._id)
      }
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Retry failed'
    } finally {
      this.generating = false
      this.stopping = false
      this.partial = ''
      this.control = undefined
    }
  }

  /**
   * Attaches (or detaches, with an empty id) a memory book to the open chat.
   *
   * `PUT /chat/:id` validates partially, so sending only `memoryId` leaves the rest of the
   * chat untouched.
   */
  async setMemoryBook(bookId: string) {
    const detail = this.detail
    if (!detail || bookId === (detail.chat.memoryId ?? '')) return

    const previous = detail.chat.memoryId
    this.detail = { ...detail, chat: { ...detail.chat, memoryId: bookId || undefined } }
    try {
      await api.put(`/chat/${detail.chat._id}`, { memoryId: bookId })
    } catch (ex) {
      this.detail = { ...detail, chat: { ...detail.chat, memoryId: previous } }
      this.error = ex instanceof Error ? ex.message : 'Failed to update memory book'
    }
  }

  /**
   * Persists a hand-edited story summary.
   *
   * The anchor is left where it is: it records which messages the summary already covers, so
   * moving it here would make the summariser skip everything between the old and new positions.
   */
  async setSummary(summary: string) {
    const detail = this.detail
    if (!detail || summary === (detail.chat.summary ?? '')) return

    const previous = detail.chat
    this.detail = { ...detail, chat: { ...detail.chat, summary } }
    try {
      await api.put(`/chat/${detail.chat._id}/summary`, {
        summary,
        summaryUpTo: detail.chat.summaryUpTo,
        summaryCount: detail.chat.summaryCount,
      })
    } catch (ex) {
      this.detail = { ...detail, chat: previous }
      this.error = ex instanceof Error ? ex.message : 'Failed to update the story summary'
    }
  }

  /** Drops the summary and its anchor, so the next run rebuilds it from the top of the chat. */
  async clearSummary() {
    const detail = this.detail
    if (!detail) return

    const previous = detail.chat
    this.detail = {
      ...detail,
      chat: { ...detail.chat, summary: '', summaryUpTo: '', summaryCount: 0 },
    }
    try {
      await api.put(`/chat/${detail.chat._id}/summary`, {
        summary: '',
        summaryUpTo: '',
        summaryCount: 0,
      })
    } catch (ex) {
      this.detail = { ...detail, chat: previous }
      this.error = ex instanceof Error ? ex.message : 'Failed to clear the story summary'
    }
  }

  /** Persists the chat's generation preset (PUT /chat/:id/preset) and updates local state. */
  async setPreset(presetId: string) {
    const detail = this.detail
    if (!detail || presetId === detail.chat.genPreset) return
    // Optimistic so the dropdown reflects the choice immediately; reverted on failure.
    this.detail = { ...detail, chat: { ...detail.chat, genPreset: presetId } }
    try {
      await api.put(`/chat/${detail.chat._id}/preset`, { preset: presetId })
    } catch (ex) {
      this.detail = detail
      this.error = ex instanceof Error ? ex.message : 'Failed to update preset'
    }
  }

  /** Rotates through a message's persisted response variants without discarding any. */
  async cycleVariant(messageId: string, direction: -1 | 1) {
    const message = this.messages.find((item) => item._id === messageId)
    const retries = message?.retries ?? []
    if (!message || !retries.length) return

    const total = retries.length + 1
    const currentPosition = this.variantPositions[messageId] ?? 0
    const nextPosition = (currentPosition + direction + total) % total
    const nextMsg = direction === 1 ? retries[0] : retries.at(-1)!
    const nextRetries =
      direction === 1 ? [...retries.slice(1), message.msg] : [message.msg, ...retries.slice(0, -1)]
    const updated = { ...message, msg: nextMsg, retries: nextRetries }

    this.setMessages(this.messages.map((item) => (item._id === messageId ? updated : item)))
    this.variantPositions = { ...this.variantPositions, [messageId]: nextPosition }
    try {
      await api.put(`/chat/${messageId}/message-swap`, {
        msg: nextMsg,
        retries: nextRetries,
      })
    } catch (ex) {
      this.setMessages(this.messages.map((item) => (item._id === messageId ? message : item)))
      this.variantPositions = {
        ...this.variantPositions,
        [messageId]: currentPosition,
      }
      this.error = ex instanceof Error ? ex.message : 'Failed to switch swipe'
    }
  }

  /**
   * Edits a message's text (`PUT /chat/:messageId/message`). `:id` is the MESSAGE id here,
   * matching `message-swap`. Applied optimistically and reverted if the server rejects it.
   *
   * The visible variant is what gets edited; `retries` is left untouched, so cycling back
   * to another swipe still returns the original text of that swipe.
   */
  async editMessage(messageId: string, text: string) {
    const original = this.messages.find((item) => item._id === messageId)
    if (!original || original.msg === text) return true

    this.setMessages(
      this.messages.map((item) => (item._id === messageId ? { ...item, msg: text } : item))
    )
    this.error = ''
    try {
      await api.put(`/chat/${messageId}/message`, { message: text })
      return true
    } catch (ex) {
      this.setMessages(this.messages.map((item) => (item._id === messageId ? original : item)))
      this.error = ex instanceof Error ? ex.message : 'Failed to edit message'
      return false
    }
  }

  /**
   * Deletes a message and relinks survivors (`DELETE /chat/:chatId/messages-v2`). `:id` =
   * CHAT id. The server returns the re-parented survivors + new leaf; applied locally
   * rather than re-fetching the whole chat.
   */
  async deleteMessage(messageId: string) {
    const detail = this.detail
    if (!detail) return
    const leafId = detail.chat.treeLeafId ?? this.messages.at(-1)?._id ?? ''
    this.error = ''
    try {
      const res = await api.del<DeleteMessagesResponse>(`/chat/${detail.chat._id}/messages-v2`, {
        ids: [messageId],
        leafId,
      })
      const links = new Map(res.messages.map((m) => [m._id, m.parent]))
      this.messages = this.messages
        .filter((m) => m._id !== messageId)
        .map((m) => (links.has(m._id) ? { ...m, parent: links.get(m._id) } : m))
      if (res.chat.treeLeafId !== undefined) {
        this.detail = { ...detail, chat: { ...detail.chat, treeLeafId: res.chat.treeLeafId } }
      }
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete message'
    }
  }

  /**
   * Deletes any chat by id, whether or not it is the open one. Throws so a list view can
   * surface the failure next to the row rather than in the chat's error banner.
   */
  async deleteChatById(chatId: string) {
    await api.del<DeleteChatResponse>(`/chat/${chatId}`)
    this.chats = this.chats.filter((c) => c._id !== chatId)
    // Leaving the deleted chat open would render a chat the server no longer has.
    if (this.detail?.chat._id === chatId) this.close()
  }

  /**
   * Deletes the open chat (`DELETE /chat/:id`). Returns true when the caller should leave
   * the chat route; the deleted id must not stay in the address bar.
   */
  async deleteChat() {
    const detail = this.detail
    if (!detail) return false
    const chatId = detail.chat._id
    this.error = ''
    try {
      await api.del<DeleteChatResponse>(`/chat/${chatId}`)
      this.chats = this.chats.filter((c) => c._id !== chatId)
      this.close()
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete chat'
      return false
    }
  }

  /**
   * Always creates a fresh chat for a character (`POST /chat`), unlike `resolveChatFor`
   * which reuses an existing one. The server auto-inserts the greeting, using the
   * character's `alternateGreetings` as the initial swipe set.
   *
   * Returns the new chat id for the caller to navigate to.
   */
  async startNewChat(character: CharacterSummary): Promise<string | undefined> {
    this.loading = true
    this.error = ''
    try {
      const created = await api.post<ChatSummary>('/chat', {
        characterId: character._id,
        name: character.name,
        mode: null,
      })
      this.chats = [created, ...this.chats]
      return created._id
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to create chat'
    } finally {
      this.loading = false
    }
  }

  close() {
    this.detail = undefined
    this.messages = []
    this.variantPositions = {}
  }

  /** Drops everything tied to the signed-in account. */
  reset() {
    this.close()
    this.characters = []
    this.chats = []
    this.partial = ''
    this.generating = false
    this.stopping = false
    this.loaded = false
    this.error = ''
  }
}

export const chats = new Chats()

subscribe('app-logout', () => chats.reset())
