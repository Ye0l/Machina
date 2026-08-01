import './init'
import { expect } from 'chai'
import { buildMemoryPrompt } from '../common/memory'
import { getTokenCounter } from '/srv/tokenize'
import { toBook, toChar, toChat, toEntry, toProfile, toUser } from '../common/dummy'
import { AppSchema } from '/common/types/schema'

/**
 * `constant` marks an entry that is inserted whether or not a keyword triggered it. The field
 * has always been carried by import and export; these cover it actually reaching the prompt.
 */

const char = toChar('Rory')
const { user } = toUser('Author')
const profile = toProfile('Author')
const chat = toChat(char)

const constant = (entry: AppSchema.MemoryEntry): AppSchema.MemoryEntry => ({
  ...entry,
  constant: true,
})

const build = (entries: AppSchema.MemoryEntry[], lines: string[]) =>
  buildMemoryPrompt(
    {
      user,
      chat,
      char,
      members: [profile],
      books: [toBook('Lore', entries)],
      lines,
      settings: {},
    },
    getTokenCounter('main', undefined)
  )

describe('memory entries marked constant', () => {
  it('is inserted with no keyword and nothing in the history to match', async () => {
    const prompt = await build(
      [constant(toEntry([], 'ALWAYS-FACT'))],
      ['Author: unrelated chatter']
    )
    expect(prompt).to.include('ALWAYS-FACT')
  })

  it('leaves a keyword entry that did not match out, as before', async () => {
    const prompt = await build(
      [constant(toEntry([], 'ALWAYS-FACT')), toEntry(['dragon'], 'DRAGON-FACT')],
      ['Author: unrelated chatter']
    )

    expect(prompt).to.include('ALWAYS-FACT')
    expect(prompt).to.not.include('DRAGON-FACT')
  })

  it('still inserts a keyword entry when its keyword does match', async () => {
    const prompt = await build(
      [constant(toEntry([], 'ALWAYS-FACT')), toEntry(['dragon'], 'DRAGON-FACT')],
      ['Author: tell me about the dragon']
    )

    expect(prompt).to.include('ALWAYS-FACT')
    expect(prompt).to.include('DRAGON-FACT')
  })

  it('is skipped when disabled, exactly like any other entry', async () => {
    const entry = { ...constant(toEntry([], 'ALWAYS-FACT')), enabled: false }
    const prompt = await build([entry], ['Author: unrelated chatter'])
    expect(prompt).to.not.include('ALWAYS-FACT')
  })

  it('keeps its keywords working as a normal entry would', async () => {
    // Constant and keyworded is legal: the keyword just stops being the reason it appears.
    const prompt = await build(
      [constant(toEntry(['dragon'], 'BOTH-FACT'))],
      ['Author: unrelated chatter']
    )
    expect(prompt).to.include('BOTH-FACT')
  })

  it('is dropped when the context limit cannot fit it, like every other match', async () => {
    const prompt = await buildMemoryPrompt(
      {
        user,
        chat,
        char,
        members: [profile],
        books: [toBook('Lore', [constant(toEntry([], 'ALWAYS-FACT'))])],
        lines: ['Author: unrelated chatter'],
        // Smaller than the entry, so the budget loop rejects it.
        settings: { memoryContextLimit: 1 },
      },
      getTokenCounter('main', undefined)
    )

    expect(prompt).to.not.include('ALWAYS-FACT')
  })
})
