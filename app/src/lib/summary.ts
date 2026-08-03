import type { AppSchema } from '/common/types'
import type { HistoryLine } from '/common/types/inference'
import { getMessageAuthor } from '/common/util'
import { getContextLimit } from '/common/prompt'
import { toSecondarySettings } from '/common/providers'
import { extractReasoning } from '/common/reasoning'
import {
  buildSummaryPrompt,
  getSummaryWindow,
  SUMMARY_CATEGORIES,
  SUMMARY_CONTEXT_LIMIT,
  SUMMARY_THRESHOLD,
  summaryWordBudget,
  takeWithinBudget,
  type ChatSummaries,
  type SummaryCategory,
} from '/common/summary'
import { getEncoder, prepareTokenizer } from '/common/tokenize'
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
  summaries: ChatSummaries
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
  /**
   * Runs one summariser inference. Injected so this module stays off the generate path.
   * `lockScope` keeps the three calls from queueing behind each other on the server's chat lock.
   */
  infer: (opts: {
    prompt: string
    settings: Partial<AppSchema.GenSettings> | undefined
    lockScope: string
  }) => Promise<string>
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

  const active = SUMMARY_CATEGORIES.filter(
    (category) => opts.settings?.summaryCategories?.[category] !== false
  )
  if (!active.length) return

  // The categories share the budget, so each set of notes is a third of the injected block
  const contextLimit = opts.settings?.summaryContextLimit || SUMMARY_CONTEXT_LIMIT
  const maxWords = summaryWordBudget(Math.floor(contextLimit / SUMMARY_CATEGORIES.length))
  const scenario = chat.scenario || opts.char.scenario

  // Summarising runs on the secondary model, which usually has a smaller window than the roleplay
  // model, so the batch has to be sized against that preset rather than the main one.
  const settings = toSecondarySettings(opts.settings ?? {})
  const previousOf = (category: SummaryCategory) =>
    chat.summaries?.[category] ?? (category === 'plot' ? chat.summary : undefined)

  inFlight.add(chatId)

  try {
    if (settings.tokenizer) await prepareTokenizer(settings.tokenizer)
    const encoder = await getEncoder()

    const scaffolds = await Promise.all(
      active.map((category) =>
        encoder(
          buildSummaryPrompt({
            category,
            charName: opts.char.name,
            scenario,
            previous: previousOf(category),
            events: [],
            maxWords,
          })
        )
      )
    )

    // One batch for every category, so it has to fit inside the largest scaffold
    const budget = getContextLimit(opts.user, settings) - Math.max(...scaffolds)
    const taken = await takeWithinBudget({
      items: window.pending,
      toText: (msg) => msg.msg,
      budget: Math.max(200, budget),
      encoder,
    })

    const events = toEventLines({ ...opts, messages: taken })

    const settled = await Promise.allSettled(
      active.map(async (category) => {
        const response = await opts.infer({
          prompt: buildSummaryPrompt({
            category,
            charName: opts.char.name,
            scenario,
            previous: previousOf(category),
            events,
            maxWords,
          }),
          settings,
          lockScope: `summary:${category}`,
        })

        const text = extractReasoning(response || '', { tags: settings.reasoning }).content.trim()
        if (!text) throw new Error(`The ${category} summariser returned nothing`)
        return text
      })
    )

    const summaries: ChatSummaries = { ...chat.summaries }

    active.forEach((category, index) => {
      const outcome = settled[index]
      if (outcome.status === 'fulfilled') summaries[category] = outcome.value
      else console.warn(`[summary] the ${category} summariser failed`, outcome.reason)
    })

    const complete = settled.every((outcome) => outcome.status === 'fulfilled')
    if (!settled.some((outcome) => outcome.status === 'fulfilled')) return

    /**
     * The anchor only moves when every category made it, so a failed one never silently skips the
     * messages the others just absorbed. Re-running over the same batch is harmless: each prompt
     * merges its previous notes with the new events rather than appending to them.
     */
    const result: SummaryResult = {
      summaries,
      summaryUpTo: complete ? taken[taken.length - 1]._id : chat.summaryUpTo ?? '',
      summaryCount: complete ? window.covered + taken.length : chat.summaryCount ?? 0,
    }

    await api.put(`/chat/${chatId}/summary`, result)
    return result
  } catch (ex) {
    console.warn('[summary] failed to update the chat summary', ex)
  } finally {
    inFlight.delete(chatId)
  }
}
