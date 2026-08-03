import { expect } from 'chai'
import './init'
import { entities, reset, template, toMap } from './util'
import { buildPromptPlaceholders } from '/common/prompt'
import { getTokenCounter } from '/srv/tokenize'
import { AppSchema } from '/common/types/schema'

const summaryParts = (summary: string, settings: Partial<AppSchema.GenSettings>) =>
  buildPromptPlaceholders(
    {
      char: entities.main,
      sender: entities.profile,
      characters: toMap([entities.main, entities.replyAs]),
      chat: { ...entities.chat, summary },
      members: [entities.profile],
      replyAs: entities.replyAs,
      settings,
      book: entities.book,
      user: entities.user,
      kind: 'send',
      chatEmbeds: [],
      userEmbeds: [],
      resolvedScenario: '',
    },
    [],
    getTokenCounter('main', undefined)
  )

describe('Placeholder tests', () => {
  before(reset)

  it('will not include duplicates in {{all_personalities}}', async () => {
    const actual = await template(`{{personality}}\n\n{{all_personalities}}`, {})

    expect(actual).toMatchSnapshot()
  })

  it('will render {{summary}} when the story summary is enabled', async () => {
    const parts = await summaryParts('They met at the inn.', { summaryEnabled: true })
    const actual = await template(`{{summary}}`, { parts })

    expect(actual.parsed).to.equal('They met at the inn.')
  })

  it('will render nothing when the story summary is disabled', async () => {
    const parts = await summaryParts('They met at the inn.', {})
    const actual = await template(`{{summary}}`, { parts })

    expect(actual.parsed).to.equal('')
  })

  it('will drop the oldest lines of an over-budget summary', async () => {
    const parts = await summaryParts('OLDEST\nMIDDLE\nNEWEST', {
      summaryEnabled: true,
      summaryContextLimit: 2,
    })
    const actual = await template(`{{summary}}`, { parts })

    expect(actual.parsed).to.contain('NEWEST')
    expect(actual.parsed).to.not.contain('OLDEST')
  })
})
