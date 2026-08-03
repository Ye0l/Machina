import { describe, expect, it } from 'vitest'
import {
  buildSummaryPrompt,
  getSummaryWindow,
  joinSummaries,
  SUMMARY_CATEGORIES,
  takeWithinBudget,
} from '/common/summary'
import { toSecondarySettings } from '/common/providers'
import { parseTemplate } from '/common/template-parser'
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

// The grammar lists the split holders before the bare one; reversed, "summary" would swallow the
// prefix of "summary_world" and the three would silently resolve to the combined block
describe('summary placeholders', () => {
  const parse = (template: string, parts: Record<string, string>) =>
    parseTemplate(template, {
      char: { name: 'Robin' },
      replyAs: { name: 'Robin' },
      sender: { handle: 'Alex' },
      parts,
      lines: [],
      limit: { context: 8192, encoder: async (text: string) => text.length },
    } as never)

  it('resolves each split holder to its own part', async () => {
    const out = await parse(
      '[{{summary_world}}][{{summary_plot}}][{{summary_chars}}][{{summary}}]',
      { summaryWorld: 'W', summaryPlot: 'P', summaryChars: 'C', summary: 'ALL' }
    )

    expect(out.parsed).toBe('[W][P][C][ALL]')
  })

  it('keeps the bare and legacy aliases working', async () => {
    const out = await parse('[{{summary}}][{{story_summary}}]', { summary: 'ALL' })

    expect(out.parsed).toBe('[ALL][ALL]')
  })
})

describe('buildSummaryPrompt', () => {
  it('asks for first notes when there is nothing to build on', () => {
    const prompt = buildSummaryPrompt({
      category: 'plot',
      charName: 'Robin',
      events: ['Robin: hello'],
      maxWords: 200,
    })

    expect(prompt).toContain('no story notes yet')
    expect(prompt).toContain('Robin: hello')
    expect(prompt).toContain('under 200 words')
  })

  it('carries the previous notes through', () => {
    const prompt = buildSummaryPrompt({
      category: 'plot',
      charName: 'Robin',
      scenario: 'A quiet village',
      previous: 'They met at the inn.',
      events: ['Robin: hello'],
      maxWords: 200,
    })

    expect(prompt).toContain('They met at the inn.')
    expect(prompt).toContain('A quiet village')
    expect(prompt).not.toContain('no story notes yet')
  })

  // Each category is handed the same batch, so the only thing keeping them from converging on the
  // same notes is the instruction block and the notes they carry in
  it('gives each category its own instructions', () => {
    const prompts = SUMMARY_CATEGORIES.map((category) =>
      buildSummaryPrompt({ category, charName: 'Robin', events: ['Robin: hello'], maxWords: 200 })
    )

    expect(new Set(prompts).size).toBe(SUMMARY_CATEGORIES.length)
    expect(prompts[0]).toContain('setting notes')
    expect(prompts[1]).toContain('story notes')
    expect(prompts[2]).toContain('character notes')
  })

  it('does not leak one category’s notes into another', () => {
    const prompt = buildSummaryPrompt({
      category: 'world',
      charName: 'Robin',
      previous: 'The tavern sits on the north road.',
      events: ['Robin: hello'],
      maxWords: 200,
    })

    expect(prompt).toContain('The tavern sits on the north road.')
    expect(prompt).toContain('setting notes so far')
  })
})

describe('joinSummaries', () => {
  it('labels each set of notes', () => {
    const joined = joinSummaries({ world: '- a tavern', chars: '- Robin is wary' })

    expect(joined).toContain('Setting:\n- a tavern')
    expect(joined).toContain('Characters:\n- Robin is wary')
    expect(joined).not.toContain('Story:')
  })

  it('falls back to a pre-split prose summary', () => {
    expect(joinSummaries({}, 'They met at the inn.')).toBe('They met at the inn.')
    expect(joinSummaries({ plot: '- they met' }, 'They met at the inn.')).toBe('Story:\n- they met')
  })
})

describe('toSecondarySettings', () => {
  it('leaves the preset alone when no secondary is configured', () => {
    const preset = { providerId: 'main', providerModels: { main: 'big-model' } }

    expect(toSecondarySettings(preset)).toBe(preset)
  })

  it('retargets only the provider selection', () => {
    const result = toSecondarySettings({
      temp: 0.8,
      providerId: 'main',
      providerModels: { main: 'big-model' },
      secondaryProviderId: 'cheap',
      secondaryProviderModels: { cheap: 'small-model' },
    })

    expect(result.providerId).toBe('cheap')
    expect(result.providerModels).toEqual({ main: 'big-model', cheap: 'small-model' })
    expect(result.temp).toBe(0.8)
  })

  // A provider with no model picked would resolve to the main preset's model on the wrong endpoint
  it('ignores a secondary provider with no model', () => {
    const preset = { providerId: 'main', secondaryProviderId: 'cheap' }

    expect(toSecondarySettings(preset)).toBe(preset)
  })
})
