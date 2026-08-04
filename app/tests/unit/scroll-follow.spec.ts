import { describe, expect, it } from 'vitest'
import { isScrollAtBottom, shouldFollowScroll } from '/app/lib/scroll-follow'

describe('scroll following', () => {
  it('recognises a viewport pinned near the bottom', () => {
    expect(isScrollAtBottom({ scrollHeight: 1000, scrollTop: 540, clientHeight: 400 })).toBe(true)
    expect(isScrollAtBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 400 })).toBe(false)
  })

  it('implements all three follow policies', () => {
    expect(shouldFollowScroll('always', false)).toBe(true)
    expect(shouldFollowScroll('when-at-bottom', true)).toBe(true)
    expect(shouldFollowScroll('when-at-bottom', false)).toBe(false)
    expect(shouldFollowScroll('never', true)).toBe(false)
  })
})
