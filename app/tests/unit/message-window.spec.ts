import { describe, expect, it } from 'vitest'
import { expandMessageWindow, findMessageWindowStart } from '/common/message-window'

describe('message rendering windows', () => {
  const messages = (lengths: number[]) => lengths.map((length) => ({ msg: 'x'.repeat(length) }))

  it('fills the initial window backwards by character count', () => {
    expect(findMessageWindowStart(messages([5, 8, 7, 6]), 15)).toBe(2)
  })

  it('keeps a single oversized message whole', () => {
    expect(findMessageWindowStart(messages([5, 30]), 10)).toBe(1)
  })

  it('expands one older page without disturbing the current end', () => {
    const list = messages([6, 6, 6, 6, 6])
    const initial = findMessageWindowStart(list, 12)
    expect(initial).toBe(3)
    expect(expandMessageWindow(list, initial, 12)).toBe(1)
    expect(expandMessageWindow(list, 1, 12)).toBe(0)
  })

  it('clamps invalid boundaries and budgets', () => {
    expect(findMessageWindowStart(messages([3, 3]), 0, 99)).toBe(1)
    expect(expandMessageWindow(messages([3, 3]), -5, 10)).toBe(0)
  })
})
