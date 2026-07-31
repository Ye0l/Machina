import type { CharacterSummary, ChatDetailResponse, ChatSummary } from './contracts'
import type { AppSchema } from '/common/types'
import { defaultPresets, isDefaultPreset } from '/common/default-preset'
import { api } from './api'
import { sendMessage } from './generate'
import { session } from './session.svelte'
import { subscribe } from './socket'

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

  loading = $state(false)
  error = $state('')
  loaded = $state(false)

  async loadCharacters(force = false) {
    if ((this.loaded && !force) || this.loading) return

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
    this.loading = true
    this.error = ''
    try {
      const detail = await api.get<ChatDetailResponse>(`/chat/${chatId}`)
      this.detail = detail
      this.messages = detail.messages ?? []
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to open chat'
    } finally {
      this.loading = false
    }
  }

  /** Reuses the most recent chat for a character, creating one only when none exists. */
  async openCharacter(character: CharacterSummary) {
    const existing = this.chats
      .filter((chat) => chat.characterId === character._id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]

    if (existing) return this.openChat(existing._id)

    this.loading = true
    this.error = ''
    try {
      const created = await api.post<ChatSummary>('/chat', {
        characterId: character._id,
        name: character.name,
        mode: null,
      })
      this.chats = [created, ...this.chats]
      return this.openChat(created._id)
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

  async send(text: string) {
    const detail = this.detail
    const user = session.user
    const profile = session.profile
    if (!detail || !user || !profile || this.generating) return

    this.generating = true
    this.partial = ''
    this.error = ''

    const preset = this.resolvePreset(detail.chat.genPreset)

    try {
      const result = await sendMessage(detail, user, profile, preset, text, {
        onPartial: (value) => (this.partial = value),
        onDone: () => (this.partial = ''),
        onError: (value) => (this.error = value),
      })

      // Re-read rather than splice locally: the server assigns ids, parents and timestamps.
      await this.openChat(detail.chat._id)
      return result
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Generation failed'
    } finally {
      this.generating = false
      this.partial = ''
    }
  }

  close() {
    this.detail = undefined
    this.messages = []
  }

  /** Drops everything tied to the signed-in account. */
  reset() {
    this.close()
    this.characters = []
    this.chats = []
    this.partial = ''
    this.generating = false
    this.loaded = false
    this.error = ''
  }
}

export const chats = new Chats()

subscribe('app-logout', () => chats.reset())
