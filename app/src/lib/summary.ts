import type { AppSchema } from '/common/types'
import type { HistoryLine } from '/common/types/inference'
import { getMessageAuthor } from '/common/util'
import { getContextLimit } from '/common/prompt'
import { extractReasoning } from '/common/reasoning'
import {
  buildSummaryPrompt,
  getSummaryWindow,
  SUMMARY_CONTEXT_LIMIT,
  SUMMARY_THRESHOLD,
  summaryWordBudget,
  takeWithinBudget,
} from '/common/summary'
import { getEncoder } from '/common/tokenize'
import { api } from './api'

/**
 * Rolling story summary.
 *
 * After a reply lands, the messages that no longer fit in the context window are folded into a
 * prose summary stored on the chat, which `common/prompt` injects back as `{{summary}}`. Recent
 * messages stay verbatim; only evicted history is compressed.
 */

/** One summary per chat at a time - a second reply can land before the first run finishes. */
const inFlight = new Set<string>()

export type SummaryResult = {
  summary: string
  summaryUpTo: string
  summaryCount: number
}

function toEventLines(opts: {
  chat: AppSchema.Chat
  char: AppSchema.Character
  characters: AppSchema.Character[]
  members: AppSchema.Profile[]
  sender: AppSchema.Profile
  impersonate?: AppSchema.Character
  messages: AppSchema.ChatMessage[]
}) {
  const members = new Map(opts.members.map((member) => [member.userId, member]))
  const chars = Object.fromEntries(opts.characters.map((char) => [char._id, char]))

  return opts.messages.map((msg) => {
    const author = getMessageAuthor({
      chat: opts.chat,
      msg,
      chars,
      members,
      sender: opts.sender,
      impersonate: opts.impersonate,
      replyAs: opts.char,
    })

    return `${author.name}: ${msg.msg.trim()}`
  })
}

function isSummarisable(msg: AppSchema.ChatMessage) {
  return !!msg.msg?.trim() && msg.adapter !== 'image' && !msg.event && !msg.ooc
}

export type SummaryInput = {
  chat: AppSchema.Chat
  char: AppSchema.Character
  characters: AppSchema.Character[]
  members: AppSchema.Profile[]
  sender: AppSchema.Profile
  impersonate?: AppSchema.Character
  user: AppSchema.User
  messages: AppSchema.ChatMessage[]
  settings: Partial<AppSchema.GenSettings> | undefined
  /** The line list the prompt was assembled from, and how many of its newest lines survived */
  history: HistoryLine[]
  linesAddedCount: number
  /** Runs the summariser's own inference. Injected so this module stays off the generate path. */
  infer: (prompt: string, settings: Partial<AppSchema.GenSettings> | undefined) => Promise<string>
  /** Ignore the update threshold - used by the manual "Regenerate" action */
  force?: boolean
}

/**
 * Rewrites the chat's summary so it also covers the newly evicted messages and persists it.
 *
 * Never throws: this runs behind the user's reply, and leaving the anchor untouched means the same
 * messages are simply retried after the next response.
 */
export async function updateChatSummary(opts: SummaryInput): Promise<SummaryResult | undefined> {
  const chat = opts.chat
  const chatId = chat._id

  if (inFlight.has(chatId)) return
  if (!opts.force && !opts.settings?.summaryEnabled) return

  const window = getSummaryWindow({
    messages: opts.messages.filter(isSummarisable),
    history: opts.history,
    linesAddedCount: opts.linesAddedCount,
    summaryUpTo: chat.summaryUpTo,
    summaryCount: chat.summaryCount,
  })

  if (!window.pending.length) return
  if (!opts.force && window.pending.length < (opts.settings?.summaryThreshold || SUMMARY_THRESHOLD))
    return

  const contextLimit = opts.settings?.summaryContextLimit || SUMMARY_CONTEXT_LIMIT
  const maxWords = summaryWordBudget(contextLimit)
  const scenario = chat.scenario || opts.char.scenario

  inFlight.add(chatId)

  try {
    const encoder = await getEncoder()

    const scaffold = buildSummaryPrompt({
      charName: opts.char.name,
      scenario,
      previous: chat.summary,
      events: [],
      maxWords,
    })

    const budget = getContextLimit(opts.user, opts.settings) - (await encoder(scaffold))
    const taken = await takeWithinBudget({
      items: window.pending,
      toText: (msg) => msg.msg,
      budget: Math.max(200, budget),
      encoder,
    })

    const prompt = buildSummaryPrompt({
      charName: opts.char.name,
      scenario,
      previous: chat.summary,
      events: toEventLines({ ...opts, messages: taken }),
      maxWords,
    })

    const response = await opts.infer(prompt, opts.settings)
    const summary = extractReasoning(response || '', {
      tags: opts.settings?.reasoning,
    }).content.trim()

    if (!summary) return

    const result: SummaryResult = {
      summary,
      summaryUpTo: taken[taken.length - 1]._id,
      summaryCount: window.covered + taken.length,
    }

    await api.put(`/chat/${chatId}/summary`, result)
    return result
  } catch (ex) {
    console.warn('[summary] failed to update the chat summary', ex)
  } finally {
    inFlight.delete(chatId)
  }
}
