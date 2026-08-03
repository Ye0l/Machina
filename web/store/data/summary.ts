import { AppSchema } from '/common/types'
import { HistoryLine } from '/common/types/inference'
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
import { getStore } from '../create'
import { genApi } from './inference'
import type { PromptEntities } from './common'

/**
 * Summarising is fire-and-forget and can be kicked off again before the previous run lands, so a
 * chat is only ever summarised once at a time. Not persisted: a reload clears it.
 */
const inFlight = new Set<string>()

export const summaryApi = {
  updateChatSummary,
  isSummarising,
}

export function isSummarising(chatId: string) {
  return inFlight.has(chatId)
}

function toEventLines(opts: {
  entities: PromptEntities
  replyAs?: AppSchema.Character
  messages: AppSchema.ChatMessage[]
}) {
  const members = new Map(opts.entities.members.map((member) => [member.userId, member]))

  return opts.messages.map((msg) => {
    const author = getMessageAuthor({
      chat: opts.entities.chat,
      msg,
      chars: opts.entities.characters,
      members,
      sender: opts.entities.profile,
      impersonate: opts.entities.impersonating,
      replyAs: opts.replyAs || opts.entities.char,
    })

    return `${author.name}: ${msg.msg.trim()}`
  })
}

function isSummarisable(msg: AppSchema.ChatMessage) {
  return !!msg.msg?.trim() && msg.adapter !== 'image' && !msg.event && !msg.ooc
}

/**
 * Rewrites the chat's rolling summary so it also covers the messages that have dropped out of
 * context, then persists it.
 *
 * Never throws and never toasts: this runs behind the user's reply, and a failure just leaves the
 * anchor where it was so the same messages are retried after the next response.
 */
export async function updateChatSummary(opts: {
  entities: PromptEntities
  replyAs?: AppSchema.Character
  history: HistoryLine[]
  linesAddedCount: number
  /** Ignore the configured threshold - used by the manual "Regenerate" action */
  force?: boolean
}) {
  const { entities } = opts
  const chat = entities.chat
  const chatId = chat._id

  if (inFlight.has(chatId)) return

  const window = getSummaryWindow({
    messages: entities.messages.filter(isSummarisable),
    history: opts.history,
    linesAddedCount: opts.linesAddedCount,
    summaryUpTo: chat.summaryUpTo,
    summaryCount: chat.summaryCount,
  })

  const threshold = entities.settings.summaryThreshold || SUMMARY_THRESHOLD
  if (!window.pending.length) return
  if (!opts.force && window.pending.length < threshold) return

  const preset = entities.presets.summary || entities.settings
  const contextLimit = entities.settings.summaryContextLimit || SUMMARY_CONTEXT_LIMIT
  const maxWords = summaryWordBudget(contextLimit)
  const scenario = chat.scenario || entities.char.scenario

  inFlight.add(chatId)

  try {
    const encoder = await getEncoder()

    const scaffold = buildSummaryPrompt({
      charName: entities.char.name,
      scenario,
      previous: chat.summary,
      events: [],
      maxWords,
    })

    const budget = getContextLimit(entities.user, preset) - (await encoder(scaffold))

    const taken = await takeWithinBudget({
      items: window.pending,
      toText: (msg) => msg.msg,
      budget: Math.max(200, budget),
      encoder,
    })

    const prompt = buildSummaryPrompt({
      charName: entities.char.name,
      scenario,
      previous: chat.summary,
      events: toEventLines({ ...opts, messages: taken }),
      maxWords,
    })

    const res = await genApi.inferenceStream({ prompt, settings: preset, chatId })
    const response = res.result?.response || ''
    const summary = extractReasoning(response, { tags: preset.reasoning }).content.trim()

    if (!summary) {
      console.warn('[summary] the model returned an empty summary')
      return
    }

    // Summarising takes long enough that the user can edit the summary by hand while it runs.
    // Their edit wins - we would otherwise silently overwrite it.
    const current = getStore('chat').getState().details[chatId]?.chat
    if (current && current.summary !== chat.summary) {
      console.warn('[summary] the summary changed while generating, discarding this run')
      return
    }

    getStore('chat').editChatSummary(
      chatId,
      summary,
      { summaryUpTo: taken[taken.length - 1]._id, summaryCount: window.covered + taken.length },
      { quiet: true }
    )

    return summary
  } catch (ex: any) {
    console.warn('[summary] failed to update the chat summary', ex)
  } finally {
    inFlight.delete(chatId)
  }
}
