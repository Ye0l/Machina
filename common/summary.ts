import { AppSchema } from './types/schema'
import { HistoryLine } from './types/inference'
import { neat } from './util'

export const SUMMARY_CONTEXT_LIMIT = 1000
export const SUMMARY_THRESHOLD = 10

export type SummaryWindow = {
  /** Evicted messages the summary does not cover yet, oldest first */
  pending: AppSchema.ChatMessage[]
  /** How many messages the current summary already covers */
  covered: number
}

/**
 * Messages that have dropped out of the context window and are not yet covered by the summary.
 *
 * `history` is the over-fetched line list the prompt was built from and `linesAddedCount` is how
 * many of its newest entries survived the final token fit, so the rest are no longer visible to the
 * model.
 */
export function getSummaryWindow(opts: {
  messages: AppSchema.ChatMessage[]
  history: HistoryLine[]
  linesAddedCount: number
  summaryUpTo?: string
  summaryCount?: number
}): SummaryWindow {
  if (opts.linesAddedCount <= 0) return { pending: [], covered: 0 }

  const oldestInContext = opts.history.slice(-opts.linesAddedCount)[0]?._id
  if (!oldestInContext) return { pending: [], covered: 0 }

  const boundary = opts.messages.findIndex((msg) => msg._id === oldestInContext)
  if (boundary <= 0) return { pending: [], covered: 0 }

  let anchor = opts.summaryUpTo
    ? opts.messages.findIndex((msg) => msg._id === opts.summaryUpTo)
    : -1

  // Messages form a tree, so retrying or switching branches can leave the anchor off the current
  // path. Falling back to the count keeps us from re-summarising the chat from the beginning.
  if (anchor === -1 && opts.summaryCount) {
    anchor = Math.min(opts.summaryCount, boundary) - 1
  }

  return { pending: opts.messages.slice(anchor + 1, boundary), covered: anchor + 1 }
}

const INSTRUCTION = neat`
Update the running summary of this roleplay so it can stand in for the conversation that no longer
fits in context.

Rules:
- Merge the previous summary and the new events into one continuous account. Do not append the new
  events as a separate section.
- Write third-person past tense prose. Do not roleplay, do not write dialogue, do not address anyone.
- Keep established facts, relationships, promises, injuries, locations and unresolved threads.
- Compress older material harder than recent material when you run out of room.
- Reply with the summary text only. No preamble, no headings, no commentary.
`

export function buildSummaryPrompt(opts: {
  charName: string
  scenario?: string
  previous?: string
  events: string[]
  maxWords: number
}) {
  const sections: string[] = []

  sections.push(`This is a roleplay between a user and "${opts.charName}".`)

  if (opts.scenario?.trim()) {
    sections.push(`Scenario:\n${opts.scenario.trim()}`)
  }

  if (opts.previous?.trim()) {
    sections.push(`Summary so far:\n${opts.previous.trim()}`)
  } else {
    sections.push(`There is no summary yet. Write the first one.`)
  }

  sections.push(`New events, in order:\n${opts.events.join('\n')}`)
  sections.push(`${INSTRUCTION}\n\nKeep the summary under ${opts.maxWords} words.`)

  return sections.join('\n\n')
}

/**
 * Rough words-to-tokens ratio, used to keep the generated summary inside its prompt budget.
 */
export function summaryWordBudget(contextLimit: number) {
  return Math.max(50, Math.floor(contextLimit * 0.6))
}

/**
 * Takes as many lines as fit, oldest first.
 *
 * Deliberately not `fillPromptWithLines`, which fills from the newest line backwards: the summary
 * anchor only moves forward, so dropping the oldest lines of a batch would lose them permanently.
 * Anything left over is picked up by the next run.
 */
export async function takeWithinBudget<T>(opts: {
  items: T[]
  toText: (item: T) => string
  budget: number
  encoder: (text: string) => Promise<number>
}) {
  const taken: T[] = []
  let used = 0

  for (const item of opts.items) {
    const size = await opts.encoder(opts.toText(item))
    if (used + size > opts.budget && taken.length) break
    used += size
    taken.push(item)
  }

  return taken
}
