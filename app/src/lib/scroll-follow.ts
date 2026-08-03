import type { ScrollFollowMode } from '/common/types/ui'

export const SCROLL_BOTTOM_THRESHOLD = 64

export function isScrollAtBottom(
  element: Pick<HTMLElement, 'scrollHeight' | 'scrollTop' | 'clientHeight'>,
  threshold = SCROLL_BOTTOM_THRESHOLD
) {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold
}

export function shouldFollowScroll(mode: ScrollFollowMode, wasAtBottom: boolean) {
  return mode === 'always' || (mode === 'when-at-bottom' && wasAtBottom)
}
