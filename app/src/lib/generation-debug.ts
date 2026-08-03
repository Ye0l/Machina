import type { AppSchema } from '/common/types'

export type GenerationRequestDebug = {
  requestId: string
  chatId: string
  prompt: string
  messages: Array<{ role: string; content: string }>
  settings?: Partial<AppSchema.GenSettings>
}

export type GenerationSummary = {
  model: string
  outputTokens: number
}

export type GenerationDebug = GenerationSummary & {
  request: GenerationRequestDebug
}

export type GenerationRequestStack = {
  current?: GenerationRequestDebug
  retries?: Array<GenerationRequestDebug | undefined>
}

type MessageGenerationMeta = {
  generation?: GenerationSummary
  retryGenerations?: Array<GenerationSummary | undefined>
}

const asSummary = (value: unknown): GenerationSummary | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const model = (value as { model?: unknown }).model
  const outputTokens = (value as { outputTokens?: unknown }).outputTokens
  if (typeof model !== 'string' || typeof outputTokens !== 'number') return undefined
  return { model, outputTokens }
}

export function resolveGenerationModel(
  settings: Partial<AppSchema.GenSettings> | undefined
): string {
  if (!settings) return 'Unknown model'

  const providerModel = settings.providerId
    ? settings.providerModels?.[settings.providerId]
    : undefined
  const subscriptionModel = (settings as Partial<AppSchema.SubscriptionModel>).subModel
  const candidates: unknown[] = [
    providerModel,
    settings.thirdPartyModel,
    settings.openRouterModel,
    settings.oaiModel,
    settings.claudeModel,
    settings.googleModel,
    settings.mistralModel,
    settings.novelModel,
    settings.featherlessModel,
    settings.arliModel,
    settings.replicateModelName,
    subscriptionModel,
    settings.name,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  return 'Unknown model'
}

export const generationSummary = (debug: GenerationDebug): GenerationSummary => ({
  model: debug.model,
  outputTokens: debug.outputTokens,
})

export function readGenerationSummary(message: AppSchema.ChatMessage): GenerationSummary | undefined {
  return asSummary((message.meta as MessageGenerationMeta | undefined)?.generation)
}

export function readRetryGenerationSummaries(
  message: AppSchema.ChatMessage
): Array<GenerationSummary | undefined> {
  const retries = (message.meta as MessageGenerationMeta | undefined)?.retryGenerations
  return Array.isArray(retries) ? retries.map(asSummary) : []
}

export function writeGenerationMeta(
  original: unknown,
  current: GenerationSummary | undefined,
  retries: Array<GenerationSummary | undefined>
): Record<string, unknown> {
  const base = original && typeof original === 'object' ? original : {}
  return { ...base, generation: current, retryGenerations: retries }
}

/** Places the visible variant into the same circular slot order used by message retries. */
export function archiveVisibleVariant<T>(
  visible: T | undefined,
  retries: Array<T | undefined>,
  currentPosition: number
): Array<T | undefined> {
  const total = retries.length + 1
  const archived = new Array<T | undefined>(total)
  archived[currentPosition] = visible
  retries.forEach((value, index) => {
    archived[(currentPosition + index + 1) % total] = value
  })
  return archived
}

/** Rotates metadata or request details alongside the message text swipe stack. */
export function rotateVariantState<T>(
  visible: T | undefined,
  retries: Array<T | undefined>,
  direction: -1 | 1
): { current: T | undefined; retries: Array<T | undefined> } {
  if (!retries.length) return { current: visible, retries }
  return direction === 1
    ? { current: retries[0], retries: [...retries.slice(1), visible] }
    : { current: retries.at(-1), retries: [visible, ...retries.slice(0, -1)] }
}
