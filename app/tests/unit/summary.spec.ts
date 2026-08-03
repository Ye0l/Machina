import { describe, expect, it } from 'vitest'
import { buildSummaryPrompt, getSummaryWindow, takeWithinBudget } from '/common/summary'
import { normalizePromptOrder } from '/app/lib/settings.svelte'
import { promptOrderToTemplate } from '/common/prompt-order'
import type { AppSchema } from '/common/types'
import type { HistoryLine } from '/common/types/inference'

const msg = (id: string, text = `message ${id}`) =>
  ({ _id: id, msg: text, kind: 'chat-message' } as AppSchema.ChatMessage)

const line = (id: string): HistoryLine => ({ _id: id, msg: '', role: 'user', json: {} })

/** Six messages, of which the newest `fitted` survived the context fit. */
const chat = (fitted: number) => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f']
  return {
    messages: ids.map((id) => msg(id)),
    history: ids.map(line),
    linesAddedCount: fitted,
  }
}

describe('getSummaryWindow', () => {
  it('returns the messages that no longer fit', () => {
    const window = getSummaryWindow(chat(4))

    expect(window.pending.map((m) => m._id)).toEqual(['a', 'b'])
    expect(window.covered).toBe(0)
  })

  it('is empty while the whole chat still fits', () => {
    expect(getSummaryWindow(chat(6)).pending).toEqual([])
  })

  it('skips the messages the summary already covers', () => {
    const window = getSummaryWindow({ ...chat(3), summaryUpTo: 'a', summaryCount: 1 })

    expect(window.pending.map((m) => m._id)).toEqual(['b', 'c'])
    expect(window.covered).toBe(1)
  })

  it('is empty when the summary already covers everything evicted', () => {
    expect(getSummaryWindow({ ...chat(4), summaryUpTo: 'b', summaryCount: 2 }).pending).toEqual([])
  })

  // Messages are a tree, so retrying forks the branch and the anchor message can vanish from it
  it('falls back to the count when the anchor is not on this branch', () => {
    const window = getSummaryWindow({ ...chat(3), summaryUpTo: 'gone', summaryCount: 2 })

    expect(window.pending.map((m) => m._id)).toEqual(['c'])
    expect(window.covered).toBe(2)
  })

  it('re-summarises from the start when there is no usable anchor at all', () => {
    const window = getSummaryWindow({ ...chat(3), summaryUpTo: 'gone' })

    expect(window.pending.map((m) => m._id)).toEqual(['a', 'b', 'c'])
    expect(window.covered).toBe(0)
  })

  it('is empty when nothing fit in context', () => {
    expect(getSummaryWindow(chat(0)).pending).toEqual([])
  })
})

describe('takeWithinBudget', () => {
  const encoder = async (text: string) => text.length

  it('takes from the oldest end so the anchor never skips a message', async () => {
    const taken = await takeWithinBudget({
      items: ['aaa', 'bbb', 'ccc', 'ddd'],
      toText: (item) => item,
      budget: 7,
      encoder,
    })

    expect(taken).toEqual(['aaa', 'bbb'])
  })

  it('always takes at least one item, even when it blows the budget', async () => {
    const taken = await takeWithinBudget({
      items: ['a very long line', 'another'],
      toText: (item) => item,
      budget: 2,
      encoder,
    })

    expect(taken).toEqual(['a very long line'])
  })
})

// normalizePromptOrder drops any section it does not know about, so a placeholder missing from
// PROMPT_SECTION_IDS never reaches the template no matter what the shared layer does with it
describe('summary prompt section', () => {
  it('survives prompt order normalization', () => {
    const order = normalizePromptOrder([{ placeholder: 'history', enabled: true }])

    expect(order.map((item) => item.placeholder)).toContain('summary')
  })

  it('reaches the generated template', () => {
    const template = promptOrderToTemplate('Universal', normalizePromptOrder())

    expect(template).toContain('{{summary}}')
  })
})

describe('buildSummaryPrompt', () => {
  it('asks for a first summary when there is nothing to build on', () => {
    const prompt = buildSummaryPrompt({
      charName: 'Robin',
      events: ['Robin: hello'],
      maxWords: 200,
    })

    expect(prompt).toContain('There is no summary yet')
    expect(prompt).toContain('Robin: hello')
    expect(prompt).toContain('under 200 words')
  })

  it('carries the previous summary through', () => {
    const prompt = buildSummaryPrompt({
      charName: 'Robin',
      scenario: 'A quiet village',
      previous: 'They met at the inn.',
      events: ['Robin: hello'],
      maxWords: 200,
    })

    expect(prompt).toContain('They met at the inn.')
    expect(prompt).toContain('A quiet village')
    expect(prompt).not.toContain('There is no summary yet')
  })
})
