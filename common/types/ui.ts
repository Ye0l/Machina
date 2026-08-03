export const BG_THEME = ['truegray', 'coolgray', 'bluegray'] as const

export type FontSetting = keyof typeof FONT_FACES

export const FONT_FACES = {
  default: { face: 'unset', label: 'Default', style: 'normal' },
  lato: { face: 'Lato, sans-serif', label: 'Lato (Roko)', style: 'normal' },
  jersey: { face: '"Jersey 10", sans-serif', label: 'Jersey', style: 'normal' },
  shadows: {
    face: '"Annie Use Your Telescope", cursive',
    label: 'Shadows Into Light',
    style: 'normal',
  },
} satisfies Record<string, { face: string; label: string; style?: string }>

export const UI_FONT = Object.keys(FONT_FACES) as FontSetting[]

export const AVATAR_SIZES = [
  'hide',
  'xs',
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  '3xl',
  'max3xl',
  'custom',
] as const
export const AVATAR_CORNERS = ['sm', 'md', 'lg', 'circle', 'none'] as const

export const CHAT_WIDTHS = ['full', 'narrow', 'xl', '2xl', '3xl', 'fill'] as const

export const UI_MODE = ['light', 'dark'] as const
export const APP_THEMES = [
  'default',
  'agnoaster',
  'gruvbox',
  'automata',
  'overdose',
  'tokyo-night',
  'nord',
] as const
export const APP_THEME_LABELS: Record<(typeof APP_THEMES)[number], string> = {
  default: 'Default',
  agnoaster: 'Agnoaster',
  gruvbox: 'Gruvbox',
  automata: 'Automata',
  overdose: 'Overdose',
  'tokyo-night': 'Tokyo Night',
  nord: 'Nord Theme',
}
export const SCROLL_FOLLOW_MODES = ['always', 'when-at-bottom', 'never'] as const
export const SCROLL_FOLLOW_LABELS: Record<(typeof SCROLL_FOLLOW_MODES)[number], string> = {
  always: 'Always follow',
  'when-at-bottom': 'Follow while at bottom',
  never: 'Never follow',
}

export const UI_THEME = [
  'blue',
  'sky',
  'teal',
  'orange',
  'rose',
  'pink',
  'lime',
  'cyan',
  'fuchsia',
  'purple',
  'premium',
  'truegray',
  'coolgray',
  'bluegray',
] as const

export type ThemeColor = (typeof UI_THEME)[number]
export type ThemeBGColor = (typeof BG_THEME)[number]
export type ThemeMode = (typeof UI_MODE)[number]
export type AppTheme = (typeof APP_THEMES)[number]
export type ScrollFollowMode = (typeof SCROLL_FOLLOW_MODES)[number]

export function normalizeAppTheme(value: string | undefined): AppTheme {
  return APP_THEMES.includes(value as AppTheme) ? (value as AppTheme) : 'default'
}
export type AvatarSize = (typeof AVATAR_SIZES)[number]
export type AvatarCornerRadius = (typeof AVATAR_CORNERS)[number]
export type ChatWidth = (typeof CHAT_WIDTHS)[number]

export type CustomUI = {
  bgCustom?: string
  msgBackground: string
  botBackground: string
  chatTextColor: string
  chatEmphasisColor: string
  chatQuoteColor: string
  chatQuoteEmphasisColor: string
  chatQuoteEmphasisWeight: string
}

export type MessageOption =
  | 'edit'
  | 'regen'
  | 'trash'
  | 'fork'
  | 'prompt'
  | 'attach'
  | 'visible'
  | 'gen-image'
  | 'gen-json'

export type UISettings = {
  theme: string
  themeBg?: string

  mode: ThemeMode
  scrollFollow: ScrollFollowMode
  streamingOutput: boolean

  bgCustomGradient: string

  chatAvatarMode?: boolean
  avatarSize: AvatarSize
  avatarCorners: AvatarCornerRadius
  customAvatarWidth?: number
  customAvatarHeight?: number
  font: FontSetting
  imageWrap: boolean
  textSpeed?: number

  /** 0 -> 1. 0 = transparent. 1 = opaque */
  msgOpacity: number
  mobileSendOnEnter: boolean
  msgOptsInline: { [key in MessageOption]: { outer: boolean; pos: number } }

  viewMode?: 'split' | 'standard' | 'background' | 'background-contain' | 'background-cover'
  viewHeight?: number

  chatWidth?: ChatWidth
  chatAlternating?: number
  trimSentences?: boolean
  logPromptsToBrowserConsole: boolean
  contextWindowLine: boolean
  expandReasoning?: boolean
  displayReasoning?: 'all' | 'pre' | 'post'

  embeddingModel?: string
  captionModel?: string

  dark: CustomUI
  light: CustomUI

  fontSize?: number
}

const customUiGuard = {
  msgBackground: 'string',
  botBackground: 'string',
  chatTextColor: 'string',
  chatEmphasisColor: 'string',
  chatQuoteColor: 'string',
  chatQuoteEmphasisColor: 'string',
  chatQuoteEmphasisWeight: 'string',
} as const

export const uiGuard = {
  theme: 'string',
  themeBg: 'string?',
  mode: UI_MODE,
  scrollFollow: SCROLL_FOLLOW_MODES,
  streamingOutput: 'boolean',

  bgCustomGradient: 'string',

  chatAvatarMode: 'boolean?',
  avatarSize: AVATAR_SIZES,
  avatarCorners: AVATAR_CORNERS,
  imageWrap: 'boolean',
  msgOpacity: 'number',
  mobileSendOnEnter: 'boolean',

  chatWidth: CHAT_WIDTHS,
  logPromptsToBrowserConsole: 'boolean',

  light: customUiGuard,
  dark: customUiGuard,
} as const

export const defaultUIsettings: UISettings = {
  theme: 'default',
  themeBg: 'truegray',

  bgCustomGradient: '',

  mode: 'dark',
  scrollFollow: 'always',
  streamingOutput: true,
  avatarSize: 'md',
  avatarCorners: 'circle',
  font: 'default',
  msgOpacity: 0.8,
  mobileSendOnEnter: false,

  chatWidth: 'full',
  chatAvatarMode: true,
  logPromptsToBrowserConsole: false,
  contextWindowLine: false,
  imageWrap: false,

  light: {
    msgBackground: '--bg-800',
    botBackground: '--bg-800',
    chatTextColor: '--text-800',
    chatEmphasisColor: '--text-600',
    chatQuoteColor: '--text-800',
    chatQuoteEmphasisColor: '--text-800',
    chatQuoteEmphasisWeight: 'unset',
  },

  dark: {
    msgBackground: '--bg-800',
    botBackground: '--bg-800',
    chatTextColor: '--text-800',
    chatEmphasisColor: '--text-600',
    chatQuoteColor: '--text-800',
    chatQuoteEmphasisColor: '--text-800',
    chatQuoteEmphasisWeight: 'unset',
  },

  msgOptsInline: {
    edit: { outer: true, pos: 0 },
    prompt: { outer: false, pos: 3 },
    fork: { outer: false, pos: 2 },
    regen: { outer: true, pos: 1 },
    attach: { outer: false, pos: 6 },
    trash: { outer: false, pos: 4 },
    visible: { outer: false, pos: 3.9 },
    'gen-image': { outer: false, pos: 3.8 },
    'gen-json': { outer: false, pos: 3.81 },
  },
}
