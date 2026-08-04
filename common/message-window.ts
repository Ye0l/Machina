export const INITIAL_MESSAGE_WINDOW_CHARS = 24_000
export const MESSAGE_WINDOW_STEP_CHARS = 24_000

export type WindowedMessage = {
  msg: string
}

/**
 * Finds the first message to render when filling a window backwards from `end`.
 *
 * A single oversized message is always kept whole. Character count is used instead of a
 * fixed message count because roleplay turns vary from one line to many pages.
 */
export function findMessageWindowStart(
  messages: WindowedMessage[],
  budget = INITIAL_MESSAGE_WINDOW_CHARS,
  end = messages.length
) {
  const safeEnd = Math.max(0, Math.min(end, messages.length))
  const safeBudget = Math.max(1, budget)
  let used = 0
  let start = safeEnd

  while (start > 0) {
    const next = messages[start - 1]?.msg.length ?? 0
    if (start < safeEnd && used + next > safeBudget) break
    used += next
    start--
  }

  return start
}

/** Adds one older character-budgeted page before the currently rendered window. */
export function expandMessageWindow(
  messages: WindowedMessage[],
  currentStart: number,
  budget = MESSAGE_WINDOW_STEP_CHARS
) {
  return findMessageWindowStart(messages, budget, currentStart)
}
