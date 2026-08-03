import type { AppSchema } from './types/schema'
import type { HistoryLine } from './types/inference'
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

/**
 * The summary is kept as three independent notes rather than one prose blob.
 *
 * Each call is handed the same batch of evicted messages but asked for one narrow view of it, which
 * is a far easier task than "summarise everything" and loses less of what matters. They carry their
 * own previous notes as continuity, so none depends on another's output and all three can run at
 * once. (The idea is borrowed from MARP, a RisuAI plugin, which splits per-turn analysis the same
 * way -- though it chains worldbuilding into the other two, which persistent notes make unnecessary.)
 */
export const SUMMARY_CATEGORIES = ['world', 'plot', 'chars'] as const

export type SummaryCategory = (typeof SUMMARY_CATEGORIES)[number]

export type ChatSummaries = Partial<Record<SummaryCategory, string>>

export const SUMMARY_CATEGORY_LABELS: Record<SummaryCategory, string> = {
  world: 'Setting',
  plot: 'Story',
  chars: 'Characters',
}

const SHARED_RULES = neat`
- Merge your previous notes and the new events into one list. Do not append the new events as a
  separate section, and do not repeat a point you already have.
- Write terse bullet points, one fact per line, starting with "- ". No prose paragraphs.
- Do not roleplay, do not write dialogue, do not address anyone.
- Drop or compress the least consequential lines when you run out of room. Never drop something the
  story still depends on.
- Reply with the bullet list only. No preamble, no headings, no commentary.
`

const CATEGORY_INSTRUCTIONS: Record<SummaryCategory, string> = {
  world: neat`
    Maintain the setting notes for this roleplay: locations and how they connect, factions and
    institutions, rules of the world, technology or magic and its limits, and how much time has
    passed. Record only what the story has established as true.
    Ignore who feels what and what happens next -- other notes cover those.
  `,
  plot: neat`
    Maintain the story notes for this roleplay: what happened and why, in order; decisions and their
    consequences; promises, debts, threats and goals; and every thread still left open.
    Ignore descriptions of places and personalities -- other notes cover those.
  `,
  chars: neat`
    Maintain the character notes for this roleplay: who each person is, how they speak and behave,
    what they want, what they know and believe, how they stand with each other, and any lasting
    change to their condition. Group the lines by character.
    Ignore world description and plot sequence -- other notes cover those.
  `,
}

export function buildSummaryPrompt(opts: {
  category: SummaryCategory
  charName: string
  scenario?: string
  previous?: string
  events: string[]
  maxWords: number
}) {
  const sections: string[] = []
  const label = SUMMARY_CATEGORY_LABELS[opts.category].toLowerCase()

  sections.push(`This is a roleplay between a user and "${opts.charName}".`)

  if (opts.scenario?.trim()) {
    sections.push(`Scenario:\n${opts.scenario.trim()}`)
  }

  if (opts.previous?.trim()) {
    sections.push(`Your ${label} notes so far:\n${opts.previous.trim()}`)
  } else {
    sections.push(`There are no ${label} notes yet. Write the first ones.`)
  }

  sections.push(`New events, in order:\n${opts.events.join('\n')}`)
  sections.push(
    `${CATEGORY_INSTRUCTIONS[opts.category]}\n\n${SHARED_RULES}\n\nKeep the notes under ${
      opts.maxWords
    } words.`
  )

  return sections.join('\n\n')
}

/**
 * The three notes as one labelled block, for the combined `{{summary}}` placeholder.
 */
export function joinSummaries(summaries: ChatSummaries | undefined, legacy?: string) {
  const blocks = SUMMARY_CATEGORIES.filter((category) => summaries?.[category]?.trim()).map(
    (category) => `${SUMMARY_CATEGORY_LABELS[category]}:\n${summaries![category]!.trim()}`
  )

  // Chats summarised before the split still carry a single prose summary.
  if (!blocks.length) return legacy?.trim() || ''

  return blocks.join('\n\n')
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
