import { describe, expect, it } from 'vitest'
import { expandRisuHistoryRanges, isRisuPresetFilename } from '/common/risu-import'
import type { AppSchema } from '/common/types'

/** Minimal persisted message shape used by the range-expansion tests below. */
const message = (msg: string, user: boolean, name?: string): AppSchema.ChatMessage =>
  ({
    _id: crypto.randomUUID(),
    kind: 'chat-message',
    chatId: 'chat',
    msg,
    userId: user ? 'user' : undefined,
    name,
    createdAt: '',
    updatedAt: '',
  } as AppSchema.ChatMessage)

describe('RisuAI preset import helpers', () => {
  it('recognises both Risu preset extensions', () => {
    expect(isRisuPresetFilename('preset.risup')).toBe(true)
    expect(isRisuPresetFilename('preset.RISUPRESET')).toBe(true)
    expect(isRisuPresetFilename('preset.json')).toBe(false)
  })

  it('expands old, recent and last-message ranges', () => {
    const messages = [
      message('zero', true),
      message('one', false),
      message('two', true),
      message('three', false),
      message('four', true, 'Persona'),
    ]
    const template = [
      '{{history:0:-3}}',
      '--recent--',
      '{{history:-3:-1}}',
      '--last--',
      '{{history:-1:end}}',
    ].join('\n')

    expect(expandRisuHistoryRanges(template, messages, { user: 'User', bot: 'Bot' })).toBe(
      [
        'User: zero',
        'Bot: one',
        '--recent--',
        'User: two',
        'Bot: three',
        '--last--',
        'Persona: four',
      ].join('\n')
    )
  })

  it('clamps range boundaries to the available messages', () => {
    const messages = [message('one', true), message('two', false)]
    expect(
      expandRisuHistoryRanges('{{history:-99:99}}', messages, { user: 'User', bot: 'Bot' })
    ).toBe(['User: one', 'Bot: two'].join('\n'))
  })
})
