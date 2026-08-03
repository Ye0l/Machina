import type { AppSchema } from '/common/types'
import type { ProviderFormat } from '/common/providers'
import type { AIAdapter } from '/common/adapters'
import type { ModelFormat } from '/common/presets/templates'
import { presetDefaults } from '/common/default-preset'
import { defaultTemplate } from '/common/mode-templates'
import { SIMPLE_ORDER } from '/common/prompt-order'
import type { SummaryCategory } from '/common/summary'
import { api } from './api'
import { session } from './session.svelte'

/**
 * Provider + preset management for the Settings route.
 *
 * Providers live on `session.user.providers` and presets on `session.presets`.
 * Every mutating call persists through the (unchanged) Express API and then writes
 * the server's response straight back onto the session store so the rest of the app
 * sees the change immediately.
 *
 * Provider keys are never returned by the server: `toSafeUser` (srv/db/user.ts)
 * blanks `key` and sets `keySet`. Sending an empty `key` on update is safe —
 * `saveUserProvider` only overwrites the stored key when a non-empty one arrives.
 */

/** Built-in provider templates surfaced in the Providers tab. */
export type ProviderTemplate = {
  id: string
  label: string
  /** Stored on `Provider.provider`, prefixed by category. */
  provider: string
  url: string
  format: ProviderFormat
  /** Suggested starter model for presets created against this provider. */
  model: string
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    provider: 'known-openai',
    url: 'https://api.openai.com/v1',
    format: { type: 'service', value: 'openai' },
    model: 'gpt-4o',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    provider: 'known-claude',
    url: 'https://api.anthropic.com/v1',
    format: { type: 'service', value: 'claude' },
    model: 'claude-3-5-sonnet-20241022',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    provider: 'known-openrouter',
    url: 'https://openrouter.ai/api/v1',
    format: { type: 'service', value: 'openrouter' },
    model: 'openai/gpt-4o-mini',
  },
  {
    id: 'vercel',
    label: 'Vercel AI Gateway',
    provider: 'known-vercel',
    url: 'https://ai-gateway.vercel.sh/v1',
    format: { type: 'format', value: 'openai-chatv2' },
    model: 'openai/gpt-4o-mini',
  },
  {
    id: 'google',
    label: 'Google AI',
    provider: 'known-gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    format: { type: 'format', value: 'gemini' },
    model: 'gemini-1.5-pro',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    provider: 'known-mistral',
    url: 'https://api.mistral.ai/v1',
    format: { type: 'format', value: 'openai-chatv2' },
    model: 'mistral-large-latest',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    provider: 'known-deepseek',
    url: 'https://api.deepseek.com/v1',
    format: { type: 'format', value: 'openai-chatv2' },
    model: 'deepseek-chat',
  },
  {
    id: 'custom',
    label: 'Custom (OpenAI-compatible)',
    provider: 'custom-openai-chatv2',
    url: '',
    format: { type: 'format', value: 'openai-chatv2' },
    model: '',
  },
]

export function findTemplate(providerValue: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.provider === providerValue)
}

export function findTemplateById(id: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find((t) => t.id === id)
}

/** Human label for a stored provider. */
export function providerLabel(provider: AppSchema.Provider): string {
  return findTemplate(provider.provider)?.label ?? provider.name ?? 'Provider'
}

/**
 * The `service` (AIAdapter) a preset should record for a given provider.
 *
 * Service-typed providers (openai, claude, openrouter) carry their adapter directly.
 * Format-typed providers (gemini, openai-compat, …) resolve their adapter from the
 * provider at generation time via `getPresetConnection`, so the stored value is only
 * a validator-satisfying placeholder — `openai` is always valid.
 */
export function serviceForProvider(provider: AppSchema.Provider): AIAdapter {
  if (provider.format?.type === 'service') return provider.format.value as AIAdapter
  return 'openai'
}

/** Current model string for a preset: provider-scoped model, else legacy fallbacks. */
export function presetModel(preset: AppSchema.UserGenPreset): string {
  if (preset.providerId) return preset.providerModels?.[preset.providerId] ?? ''
  return preset.thirdPartyModel ?? preset.oaiModel ?? ''
}

export type ProviderInput = {
  _id?: string
  name: string
  provider: string
  url: string
  key: string
  format?: ProviderFormat
}

export type JsonMode = 'off' | 'standard' | 'separate'
export type JsonSource = 'character' | 'preset' | 'json-preset'

export type { SummaryCategory }

export const PROMPT_SECTION_IDS = [
  'system_prompt',
  'scenario',
  'personality',
  'impersonating',
  'chat_embed',
  'memory',
  'summary',
  'example_dialogue',
  'history',
  'ujb',
] as const

export type PromptSectionId = (typeof PROMPT_SECTION_IDS)[number]
export type PromptOrder = NonNullable<AppSchema.GenSettings['promptOrder']>

export function normalizePromptOrder(order?: AppSchema.GenSettings['promptOrder']): PromptOrder {
  const supported = new Set<string>(PROMPT_SECTION_IDS)
  const seen = new Set<string>()
  const normalized: PromptOrder = []

  for (const item of order ?? SIMPLE_ORDER) {
    if (!supported.has(item.placeholder) || seen.has(item.placeholder)) continue
    seen.add(item.placeholder)
    normalized.push({ placeholder: item.placeholder, enabled: !!item.enabled })
  }

  for (const placeholder of PROMPT_SECTION_IDS) {
    if (seen.has(placeholder)) continue
    normalized.push({ placeholder, enabled: true })
  }

  return normalized
}

export const DEFAULT_PROMPT_TEMPLATE = defaultTemplate

export type PresetInput = {
  name: string
  providerId: string
  model: string
  temp: number
  maxTokens: number
  maxContext: number
  jsonEnabled: JsonMode
  jsonSource: JsonSource
  useAdvancedPrompt: 'basic' | 'no-validation'
  modelFormat: ModelFormat
  promptOrder: PromptOrder
  gaslight: string
  promptTemplateId?: string
  systemPrompt: string
  ultimeJailbreak: string
  prefill: string
  ignoreCharacterSystemPrompt: boolean
  ignoreCharacterUjb: boolean
  summaryEnabled: boolean
  summaryContextLimit: number
  summaryThreshold: number
  summaryCategories: Record<SummaryCategory, boolean>
  secondaryProviderId: string
  secondaryModel: string
}

export type ConnectionTestResult = { success: boolean; url: string }

export type ProviderModelsResult = {
  data?: Array<string | { id?: string; name?: string; value?: string }>
  url?: string
}

export function parseProviderModels(result: ProviderModelsResult): string[] {
  const models = (result.data ?? [])
    .map((model) =>
      typeof model === 'string' ? model : model.id ?? model.value ?? model.name ?? ''
    )
    .map((model) => model.trim())
    .filter(Boolean)

  return [...new Set(models)]
}

class SettingsStore {
  /** Last error from any provider/preset operation; cleared on the next action. */
  error = $state('')
  providerSaving = $state(false)
  presetSaving = $state(false)
  defaultSaving = $state(false)

  clearError() {
    this.error = ''
  }

  /** Create or update a provider. Empty `key` preserves an existing key server-side. */
  async saveProvider(input: ProviderInput): Promise<boolean> {
    this.providerSaving = true
    this.error = ''
    try {
      const body = {
        _id: input._id ?? '',
        name: input.name.trim(),
        provider: input.provider,
        url: input.url.trim(),
        key: input.key,
        format: input.format,
      }
      const user = await api.post<AppSchema.User>('/user/provider', body)
      session.user = user
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save provider'
      return false
    } finally {
      this.providerSaving = false
    }
  }

  async deleteProvider(providerId: string): Promise<boolean> {
    this.error = ''
    try {
      const user = await api.del<AppSchema.User>('/user/provider', { providerId })
      session.user = user
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete provider'
      return false
    }
  }

  async testConnection(input: {
    url: string
    key?: string
    providerId?: string
  }): Promise<ConnectionTestResult> {
    return api.post<ConnectionTestResult>('/user/preset-test', input)
  }

  async getProviderModels(input: {
    url: string
    key?: string
    providerId?: string
    id?: string
  }): Promise<{ models: string[]; url?: string }> {
    const result = await api.post<ProviderModelsResult>('/user/preset-models', input)
    return { models: parseProviderModels(result), url: result.url }
  }

  async savePreset(input: PresetInput, existing?: AppSchema.UserGenPreset): Promise<boolean> {
    this.presetSaving = true
    this.error = ''
    try {
      const providerModels = {
        ...(existing?.providerModels ?? {}),
        ...(input.providerId ? { [input.providerId]: input.model.trim() } : {}),
      }

      const promptFields = {
        presetMode: 'advanced' as const,
        useAdvancedPrompt: input.useAdvancedPrompt,
        modelFormat: input.modelFormat,
        promptOrder: normalizePromptOrder(input.promptOrder),
        gaslight: input.gaslight,
        promptTemplateId: input.promptTemplateId,
        systemPrompt: input.systemPrompt,
        ultimeJailbreak: input.ultimeJailbreak,
        prefill: input.prefill,
        ignoreCharacterSystemPrompt: input.ignoreCharacterSystemPrompt,
        ignoreCharacterUjb: input.ignoreCharacterUjb,
        summaryEnabled: input.summaryEnabled,
        summaryContextLimit: input.summaryContextLimit,
        summaryThreshold: input.summaryThreshold,
        summaryCategories: input.summaryCategories,
        secondaryProviderId: input.secondaryProviderId,
        // Keyed like `providerModels`, and merged the same way so switching the secondary provider
        // back and forth keeps each one's model choice.
        secondaryProviderModels: {
          ...(existing?.secondaryProviderModels ?? {}),
          ...(input.secondaryProviderId
            ? { [input.secondaryProviderId]: input.secondaryModel.trim() }
            : {}),
        },
      }

      if (existing) {
        // Strip identifiers/metadata; send the editable fields plus everything kept.
        const rest: Partial<AppSchema.UserGenPreset> = { ...existing }
        delete rest._id
        delete rest.userId
        delete rest.kind
        delete rest.updatedAt
        const body = {
          ...rest,
          ...promptFields,
          name: input.name.trim(),
          temp: input.temp,
          maxTokens: input.maxTokens,
          maxContextLength: input.maxContext,
          useMaxContext: true,
          providerId: input.providerId,
          providerModels,
          jsonEnabled: input.jsonEnabled,
          jsonSource: input.jsonSource,
        }
        const updated = await api.post<AppSchema.UserGenPreset>(
          `/user/presets/${existing._id}`,
          body
        )
        session.presets = session.presets.map((p) => (p._id === updated._id ? updated : p))
        return true
      }

      const provider = session.user?.providers?.find((p) => p._id === input.providerId)
      const body = {
        ...presetDefaults,
        ...promptFields,
        name: input.name.trim(),
        service: provider ? serviceForProvider(provider) : presetDefaults.service,
        providerId: input.providerId,
        providerModels,
        temp: input.temp,
        maxTokens: input.maxTokens,
        maxContextLength: input.maxContext,
        useMaxContext: true,
        jsonEnabled: input.jsonEnabled,
        jsonSource: input.jsonSource,
      }
      const created = await api.post<AppSchema.UserGenPreset>('/user/presets', body)
      session.presets = [...session.presets, created]
      // createUserPreset auto-assigns the default when the user has none — mirror it.
      if (session.user && !session.user.defaultPreset) {
        session.user = { ...session.user, defaultPreset: created._id }
      }
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to save preset'
      return false
    } finally {
      this.presetSaving = false
    }
  }

  async deletePreset(presetId: string): Promise<boolean> {
    this.error = ''
    try {
      await api.del(`/user/presets/${presetId}`)
      session.presets = session.presets.filter((p) => p._id !== presetId)
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete preset'
      return false
    }
  }

  /** Set the user's default generation preset via the partial-config endpoint. */
  async setDefaultPreset(presetId: string): Promise<boolean> {
    this.defaultSaving = true
    this.error = ''
    try {
      const user = await api.post<AppSchema.User>('/user/config/partial', {
        defaultPreset: presetId,
      })
      session.user = user
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to set default preset'
      return false
    } finally {
      this.defaultSaving = false
    }
  }
}

export const settings = new SettingsStore()
