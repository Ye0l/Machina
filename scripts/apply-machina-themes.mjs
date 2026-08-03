import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (path) => readFileSync(path, 'utf8')
const write = (path, content) => writeFileSync(path, content)

function replaceOnce(path, before, after, label = before.slice(0, 60)) {
  const source = read(path)
  if (source.includes(after)) return
  if (!source.includes(before)) throw new Error(`${path}: missing anchor ${label}`)
  write(path, source.replace(before, after))
}

function replaceRegex(path, pattern, replacement, label) {
  const source = read(path)
  if (typeof replacement === 'string' && source.includes(replacement)) return
  if (!pattern.test(source)) throw new Error(`${path}: missing regex anchor ${label}`)
  write(path, source.replace(pattern, replacement))
}

function walk(dir, visit) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, visit)
    else visit(path)
  }
}

const themesCss = `/* Machina application themes. Values are RGB triplets so Tailwind opacity modifiers keep working. */
:root,
html[data-theme='default'][data-mode='dark'] {
  --app-bg: 9 11 16;
  --app-bg-lighter: 13 16 23;
  --surface-panel: 13 17 24;
  --surface-message: 21 26 35;
  --surface-input: 15 19 26;
  --text-strong: 255 255 255;
  --accent-contrast: 255 255 255;
  --theme-background: none;
  --neutral-50: 250 250 250;
  --neutral-100: 245 245 245;
  --neutral-200: 229 229 229;
  --neutral-300: 212 212 212;
  --neutral-400: 163 163 163;
  --neutral-500: 115 115 115;
  --neutral-600: 82 82 82;
  --neutral-700: 64 64 64;
  --neutral-800: 38 38 38;
  --neutral-900: 23 23 23;
  --neutral-950: 10 10 10;
  --violet-50: 245 243 255;
  --violet-100: 237 233 254;
  --violet-200: 221 214 254;
  --violet-300: 196 181 253;
  --violet-400: 167 139 250;
  --violet-500: 139 92 246;
  --violet-600: 124 58 237;
  --violet-700: 109 40 217;
  --violet-800: 91 33 182;
  --violet-900: 76 29 149;
  --violet-950: 46 16 101;
}

html[data-mode='light'] {
  --app-bg: 244 246 250;
  --app-bg-lighter: 255 255 255;
  --surface-panel: 255 255 255;
  --surface-message: 248 250 252;
  --surface-input: 255 255 255;
  --text-strong: 15 23 42;
  --accent-contrast: 255 255 255;
  --theme-background: none;
  --neutral-50: 2 6 23;
  --neutral-100: 15 23 42;
  --neutral-200: 30 41 59;
  --neutral-300: 51 65 85;
  --neutral-400: 71 85 105;
  --neutral-500: 100 116 139;
  --neutral-600: 148 163 184;
  --neutral-700: 203 213 225;
  --neutral-800: 241 245 249;
  --neutral-900: 248 250 252;
  --neutral-950: 255 255 255;
  --violet-50: 46 16 101;
  --violet-100: 76 29 149;
  --violet-200: 91 33 182;
  --violet-300: 109 40 217;
  --violet-400: 124 58 237;
  --violet-500: 139 92 246;
  --violet-600: 124 58 237;
  --violet-700: 221 214 254;
  --violet-800: 237 233 254;
  --violet-900: 245 243 255;
  --violet-950: 250 248 255;
}

html[data-theme='agnoaster'][data-mode='dark'] {
  --app-bg: 15 17 20;
  --app-bg-lighter: 20 23 27;
  --surface-panel: 22 25 29;
  --surface-message: 30 34 39;
  --surface-input: 25 28 33;
  --neutral-700: 69 72 78;
  --neutral-800: 40 43 49;
  --neutral-900: 26 29 34;
  --neutral-950: 13 15 18;
  --violet-50: 255 247 237;
  --violet-100: 255 237 213;
  --violet-200: 254 215 170;
  --violet-300: 253 186 116;
  --violet-400: 251 146 60;
  --violet-500: 249 115 22;
  --violet-600: 234 88 12;
  --violet-700: 194 65 12;
  --violet-800: 154 52 18;
  --violet-900: 124 45 18;
  --violet-950: 67 20 7;
}

html[data-theme='agnoaster'][data-mode='light'] {
  --app-bg: 244 241 235;
  --app-bg-lighter: 255 252 247;
  --surface-panel: 255 250 242;
  --surface-message: 249 244 235;
  --surface-input: 255 253 249;
  --violet-50: 67 20 7;
  --violet-100: 124 45 18;
  --violet-200: 154 52 18;
  --violet-300: 194 65 12;
  --violet-400: 234 88 12;
  --violet-500: 249 115 22;
  --violet-600: 194 65 12;
  --violet-700: 254 215 170;
  --violet-800: 255 237 213;
  --violet-900: 255 247 237;
  --violet-950: 255 251 245;
}

html[data-theme='gruvbox'][data-mode='dark'] {
  --app-bg: 29 32 33;
  --app-bg-lighter: 40 40 40;
  --surface-panel: 40 40 40;
  --surface-message: 60 56 54;
  --surface-input: 50 48 47;
  --text-strong: 251 241 199;
  --accent-contrast: 40 40 40;
  --neutral-50: 251 241 199;
  --neutral-100: 235 219 178;
  --neutral-200: 213 196 161;
  --neutral-300: 189 174 147;
  --neutral-400: 168 153 132;
  --neutral-500: 146 131 116;
  --neutral-600: 102 92 84;
  --neutral-700: 80 73 69;
  --neutral-800: 60 56 54;
  --neutral-900: 40 40 40;
  --neutral-950: 29 32 33;
  --violet-50: 254 246 199;
  --violet-100: 251 241 199;
  --violet-200: 250 189 47;
  --violet-300: 215 153 33;
  --violet-400: 214 93 14;
  --violet-500: 215 153 33;
  --violet-600: 250 189 47;
  --violet-700: 181 118 20;
  --violet-800: 121 76 14;
  --violet-900: 94 60 12;
  --violet-950: 58 35 7;
}

html[data-theme='gruvbox'][data-mode='light'] {
  --app-bg: 251 241 199;
  --app-bg-lighter: 255 248 214;
  --surface-panel: 251 241 199;
  --surface-message: 235 219 178;
  --surface-input: 255 250 225;
  --text-strong: 60 56 54;
  --accent-contrast: 255 248 214;
  --neutral-50: 40 40 40;
  --neutral-100: 60 56 54;
  --neutral-200: 80 73 69;
  --neutral-300: 102 92 84;
  --neutral-400: 124 111 100;
  --neutral-500: 146 131 116;
  --neutral-600: 189 174 147;
  --neutral-700: 213 196 161;
  --neutral-800: 235 219 178;
  --neutral-900: 251 241 199;
  --neutral-950: 255 248 214;
  --violet-50: 58 35 7;
  --violet-100: 94 60 12;
  --violet-200: 121 76 14;
  --violet-300: 181 118 20;
  --violet-400: 215 153 33;
  --violet-500: 181 118 20;
  --violet-600: 181 118 20;
  --violet-700: 250 189 47;
  --violet-800: 254 228 133;
  --violet-900: 255 244 190;
  --violet-950: 255 250 225;
}

html[data-theme='automata'][data-mode='dark'] {
  --app-bg: 28 27 25;
  --app-bg-lighter: 36 34 30;
  --surface-panel: 40 38 32;
  --surface-message: 54 50 41;
  --surface-input: 46 43 36;
  --text-strong: 231 225 207;
  --accent-contrast: 28 27 25;
  --neutral-50: 239 235 220;
  --neutral-100: 231 225 207;
  --neutral-200: 213 205 184;
  --neutral-300: 191 181 157;
  --neutral-400: 164 153 130;
  --neutral-500: 130 121 104;
  --neutral-600: 93 86 74;
  --neutral-700: 75 69 59;
  --neutral-800: 54 50 41;
  --neutral-900: 40 38 32;
  --neutral-950: 28 27 25;
  --violet-50: 244 239 219;
  --violet-100: 235 226 191;
  --violet-200: 218 201 145;
  --violet-300: 198 169 107;
  --violet-400: 177 143 80;
  --violet-500: 151 120 66;
  --violet-600: 198 169 107;
  --violet-700: 118 92 49;
  --violet-800: 88 69 40;
  --violet-900: 65 51 31;
  --violet-950: 39 31 20;
}

html[data-theme='automata'][data-mode='light'] {
  --app-bg: 216 211 197;
  --app-bg-lighter: 239 235 224;
  --surface-panel: 238 233 220;
  --surface-message: 226 221 207;
  --surface-input: 246 242 231;
  --text-strong: 47 43 36;
  --accent-contrast: 247 242 226;
  --neutral-50: 34 32 28;
  --neutral-100: 47 43 36;
  --neutral-200: 68 62 52;
  --neutral-300: 91 83 69;
  --neutral-400: 118 108 89;
  --neutral-500: 145 134 112;
  --neutral-600: 174 164 142;
  --neutral-700: 198 190 169;
  --neutral-800: 226 221 207;
  --neutral-900: 238 233 220;
  --neutral-950: 246 242 231;
  --violet-50: 39 31 20;
  --violet-100: 65 51 31;
  --violet-200: 88 69 40;
  --violet-300: 118 92 49;
  --violet-400: 151 120 66;
  --violet-500: 118 92 49;
  --violet-600: 118 92 49;
  --violet-700: 218 201 145;
  --violet-800: 235 226 191;
  --violet-900: 244 239 219;
  --violet-950: 249 246 236;
}

html[data-theme='overdose'][data-mode='dark'] {
  --app-bg: 10 11 24;
  --app-bg-lighter: 17 18 38;
  --surface-panel: 18 20 42;
  --surface-message: 31 33 64;
  --surface-input: 24 26 52;
  --theme-background: radial-gradient(circle at 10% 0%, rgb(0 225 255 / 0.12), transparent 30%), radial-gradient(circle at 100% 20%, rgb(255 46 151 / 0.14), transparent 34%);
  --violet-50: 255 240 249;
  --violet-100: 255 214 238;
  --violet-200: 255 163 211;
  --violet-300: 255 105 184;
  --violet-400: 255 46 151;
  --violet-500: 255 30 137;
  --violet-600: 231 0 113;
  --violet-700: 190 0 94;
  --violet-800: 145 0 74;
  --violet-900: 105 0 57;
  --violet-950: 64 0 37;
}

html[data-theme='overdose'][data-mode='light'] {
  --app-bg: 242 246 255;
  --app-bg-lighter: 255 255 255;
  --surface-panel: 255 255 255;
  --surface-message: 235 242 255;
  --surface-input: 255 255 255;
  --theme-background: radial-gradient(circle at 0% 0%, rgb(0 197 255 / 0.14), transparent 32%), radial-gradient(circle at 100% 10%, rgb(255 46 151 / 0.12), transparent 34%);
  --violet-50: 96 0 52;
  --violet-100: 130 0 69;
  --violet-200: 170 0 88;
  --violet-300: 209 0 108;
  --violet-400: 239 0 124;
  --violet-500: 255 30 137;
  --violet-600: 209 0 108;
  --violet-700: 255 163 211;
  --violet-800: 255 214 238;
  --violet-900: 255 240 249;
  --violet-950: 255 248 252;
}

html[data-theme='tokyo-night'][data-mode='dark'] {
  --app-bg: 22 22 30;
  --app-bg-lighter: 26 27 38;
  --surface-panel: 26 27 38;
  --surface-message: 36 40 59;
  --surface-input: 30 32 48;
  --neutral-700: 65 72 104;
  --neutral-800: 36 40 59;
  --neutral-900: 26 27 38;
  --neutral-950: 22 22 30;
  --violet-50: 238 244 255;
  --violet-100: 220 232 255;
  --violet-200: 187 207 255;
  --violet-300: 154 181 255;
  --violet-400: 122 162 247;
  --violet-500: 85 128 231;
  --violet-600: 65 102 208;
  --violet-700: 52 84 138;
  --violet-800: 42 65 112;
  --violet-900: 34 49 84;
  --violet-950: 22 30 55;
}

html[data-theme='tokyo-night'][data-mode='light'] {
  --app-bg: 213 214 219;
  --app-bg-lighter: 238 239 244;
  --surface-panel: 232 233 239;
  --surface-message: 222 224 231;
  --surface-input: 244 245 248;
  --text-strong: 52 59 88;
  --violet-50: 36 52 85;
  --violet-100: 42 65 112;
  --violet-200: 52 84 138;
  --violet-300: 65 102 150;
  --violet-400: 71 115 184;
  --violet-500: 52 84 138;
  --violet-600: 52 84 138;
  --violet-700: 154 181 255;
  --violet-800: 205 218 255;
  --violet-900: 232 238 255;
  --violet-950: 244 247 255;
}

html[data-theme='nord'][data-mode='dark'] {
  --app-bg: 46 52 64;
  --app-bg-lighter: 53 59 73;
  --surface-panel: 59 66 82;
  --surface-message: 67 76 94;
  --surface-input: 59 66 82;
  --text-strong: 236 239 244;
  --neutral-50: 236 239 244;
  --neutral-100: 229 233 240;
  --neutral-200: 216 222 233;
  --neutral-300: 196 205 219;
  --neutral-400: 180 191 209;
  --neutral-500: 129 143 166;
  --neutral-600: 94 105 125;
  --neutral-700: 76 86 106;
  --neutral-800: 67 76 94;
  --neutral-900: 59 66 82;
  --neutral-950: 46 52 64;
  --violet-50: 240 250 252;
  --violet-100: 224 244 247;
  --violet-200: 191 226 232;
  --violet-300: 143 188 199;
  --violet-400: 136 192 208;
  --violet-500: 129 161 193;
  --violet-600: 94 129 172;
  --violet-700: 76 96 133;
  --violet-800: 62 78 107;
  --violet-900: 49 61 84;
  --violet-950: 31 39 54;
}

html[data-theme='nord'][data-mode='light'] {
  --app-bg: 236 239 244;
  --app-bg-lighter: 255 255 255;
  --surface-panel: 229 233 240;
  --surface-message: 216 222 233;
  --surface-input: 247 249 252;
  --text-strong: 46 52 64;
  --neutral-50: 46 52 64;
  --neutral-100: 59 66 82;
  --neutral-200: 67 76 94;
  --neutral-300: 76 86 106;
  --neutral-400: 94 105 125;
  --neutral-500: 129 143 166;
  --neutral-600: 180 191 209;
  --neutral-700: 196 205 219;
  --neutral-800: 229 233 240;
  --neutral-900: 236 239 244;
  --neutral-950: 255 255 255;
  --violet-50: 31 39 54;
  --violet-100: 49 61 84;
  --violet-200: 62 78 107;
  --violet-300: 76 96 133;
  --violet-400: 94 129 172;
  --violet-500: 94 129 172;
  --violet-600: 76 96 133;
  --violet-700: 191 226 232;
  --violet-800: 224 244 247;
  --violet-900: 240 250 252;
  --violet-950: 248 253 254;
}
`

write('app/src/themes.css', themesCss)

write(
  'app/tailwind.config.cjs',
  `const path = require('path')

const here = (glob) => path.join(__dirname, glob)
const css = (name) => \`rgb(var(--\${name}) / <alpha-value>)\`
const scale = (name) =>
  Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [step, css(\`\${name}-\${step}\`)]))

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [here('index.html'), here('src/**/*.{svelte,ts}')],
  theme: {
    extend: {
      colors: {
        white: css('text-strong'),
        background: css('app-bg'),
        'background-lighter': css('app-bg-lighter'),
        neutral: scale('neutral'),
        violet: scale('violet'),
      },
    },
  },
  plugins: [],
}
`
)

replaceOnce(
  'common/types/ui.ts',
  `export const UI_MODE = ['light', 'dark'] as const
export const UI_THEME = [`,
  `export const UI_MODE = ['light', 'dark'] as const
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

export const UI_THEME = [`,
  'theme constants'
)

replaceOnce(
  'common/types/ui.ts',
  `export type ThemeMode = (typeof UI_MODE)[number]
export type AvatarSize`,
  `export type ThemeMode = (typeof UI_MODE)[number]
export type AppTheme = (typeof APP_THEMES)[number]
export type ScrollFollowMode = (typeof SCROLL_FOLLOW_MODES)[number]
export type AvatarSize`,
  'theme types'
)

replaceOnce(
  'common/types/ui.ts',
  `export type UISettings = {
  theme: string
  themeBg?: string

  mode: ThemeMode
`,
  `export type UISettings = {
  theme: string
  themeBg?: string

  mode: ThemeMode
  scrollFollow: ScrollFollowMode
  streamingOutput: boolean
`,
  'UI settings fields'
)

replaceOnce(
  'common/types/ui.ts',
  `export const uiGuard = {
  theme: 'string',
  themeBg: 'string?',
  mode: UI_MODE,
`,
  `export const uiGuard = {
  theme: 'string',
  themeBg: 'string?',
  mode: UI_MODE,
  scrollFollow: SCROLL_FOLLOW_MODES,
  streamingOutput: 'boolean',
`,
  'UI guard'
)

replaceOnce(
  'common/types/ui.ts',
  `export const defaultUIsettings: UISettings = {
  theme: 'sky',
  themeBg: 'truegray',

  bgCustomGradient: '',

  mode: 'dark',
`,
  `export const defaultUIsettings: UISettings = {
  theme: 'default',
  themeBg: 'truegray',

  bgCustomGradient: '',

  mode: 'dark',
  scrollFollow: 'always',
  streamingOutput: true,
`,
  'UI defaults'
)

const uiTypes = read('common/types/ui.ts')
if (!uiTypes.includes('export function normalizeAppTheme')) {
  write(
    'common/types/ui.ts',
    uiTypes.replace(
      `export type ScrollFollowMode = (typeof SCROLL_FOLLOW_MODES)[number]\n`,
      `export type ScrollFollowMode = (typeof SCROLL_FOLLOW_MODES)[number]\n\nexport function normalizeAppTheme(value: string | undefined): AppTheme {\n  return APP_THEMES.includes(value as AppTheme) ? (value as AppTheme) : 'default'\n}\n`
    )
  )
}

replaceOnce(
  'app/src/App.svelte',
  `  import { router, routes } from '/app/lib/router.svelte'
  import AppShell`,
  `  import { router, routes } from '/app/lib/router.svelte'
  import { uiSettings } from '/app/lib/ui-settings.svelte'
  import { normalizeAppTheme } from '/common/types/ui'
  import AppShell`,
  'App theme imports'
)

replaceOnce(
  'app/src/App.svelte',
  `  let ready = $state(boot())
  let editorDirty = $state(false)
`,
  `  let ready = $state(boot())
  let editorDirty = $state(false)

  $effect(() => {
    const ui = uiSettings.settings
    const mode = ui.mode === 'light' ? 'light' : 'dark'
    const root = document.documentElement
    root.dataset.theme = normalizeAppTheme(ui.theme)
    root.dataset.mode = mode
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
  })
`,
  'App theme effect'
)

replaceOnce('app/src/app.css', '@tailwind base;', `@import './themes.css';\n\n@tailwind base;`, 'theme import')
replaceOnce(
  'app/src/app.css',
  `  background: theme('colors.background');
  color: #e5e7eb;`,
  `  background: rgb(var(--app-bg));
  background-image: var(--theme-background);
  background-attachment: fixed;
  color: rgb(var(--text-strong));`,
  'body theme colors'
)
replaceOnce(
  'app/src/app.css',
  `  scrollbar-color: #353b48 transparent;`,
  `  scrollbar-color: rgb(var(--neutral-700)) transparent;`,
  'scrollbar theme'
)

let appCss = read('app/src/app.css')
if (!appCss.includes('Machina semantic overrides')) {
  appCss += `

/* Machina semantic overrides for the few legacy arbitrary-color utilities. */
.bg-\\[\\#0d1118\\] {
  background-color: rgb(var(--surface-panel)) !important;
}

.bg-\\[\\#151a23\\] {
  background-color: rgb(var(--surface-message)) !important;
}

.bg-\\[\\#0f131a\\] {
  background-color: rgb(var(--surface-input)) !important;
}

.button-primary,
.bg-violet-600.text-white,
.bg-purple-700 {
  color: rgb(var(--accent-contrast)) !important;
}

html,
body,
.bg-background,
.bg-background-lighter,
.bg-\\[\\#0d1118\\],
.bg-\\[\\#151a23\\],
.bg-\\[\\#0f131a\\] {
  transition: background-color 140ms ease, color 140ms ease, border-color 140ms ease;
}
`
  write('app/src/app.css', appCss)
}

replaceOnce(
  'app/src/routes/Settings.svelte',
  `    AVATAR_CORNERS,
    AVATAR_SIZES,
    CHAT_WIDTHS,
    FONT_FACES,
    UI_FONT,
    type AvatarCornerRadius,
    type AvatarSize,
    type ChatWidth,
    type FontSetting,
`,
  `    APP_THEMES,
    APP_THEME_LABELS,
    AVATAR_CORNERS,
    AVATAR_SIZES,
    CHAT_WIDTHS,
    FONT_FACES,
    SCROLL_FOLLOW_LABELS,
    SCROLL_FOLLOW_MODES,
    UI_FONT,
    normalizeAppTheme,
    type AppTheme,
    type AvatarCornerRadius,
    type AvatarSize,
    type ChatWidth,
    type FontSetting,
    type ScrollFollowMode,
    type ThemeMode,
`,
  'Settings theme imports'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `  type DisplayForm = {
    chatWidth: ChatWidth
`,
  `  type DisplayForm = {
    theme: AppTheme
    mode: ThemeMode
    scrollFollow: ScrollFollowMode
    streamingOutput: boolean
    chatWidth: ChatWidth
`,
  'Display form fields'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `    return {
      chatWidth: ui.chatWidth ?? 'full',
`,
  `    return {
      theme: normalizeAppTheme(ui.theme),
      mode: ui.mode === 'light' ? 'light' : 'dark',
      scrollFollow: ui.scrollFollow ?? 'always',
      streamingOutput: ui.streamingOutput !== false,
      chatWidth: ui.chatWidth ?? 'full',
`,
  'Display form values'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `      const ok = await uiSettings.save({
        chatWidth: displayForm.chatWidth,
`,
  `      const ok = await uiSettings.save({
        theme: displayForm.theme,
        mode: displayForm.mode,
        scrollFollow: displayForm.scrollFollow,
        streamingOutput: displayForm.streamingOutput,
        chatWidth: displayForm.chatWidth,
`,
  'Display save fields'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `          <div
            class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-4"
`,
  `          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="field-group">
              <label class="field-label" for="display-theme">{i18n.t('Color theme')}</label>
              <select id="display-theme" class="field" bind:value={displayForm.theme}>
                {#each APP_THEMES as theme (theme)}
                  <option value={theme}>{APP_THEME_LABELS[theme]}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-mode">{i18n.t('Appearance mode')}</label>
              <select id="display-mode" class="field" bind:value={displayForm.mode}>
                <option value="dark">{i18n.t('Dark')}</option>
                <option value="light">{i18n.t('Light')}</option>
              </select>
            </div>
          </div>

          <div
            class="rounded-lg border border-neutral-800/80 bg-neutral-900/40 p-4"
            data-theme={displayForm.theme}
            data-mode={displayForm.mode}
`,
  'Theme controls'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `            <div class="field-group">
              <label class="field-label" for="display-font">{i18n.t('Font family')}</label>
`,
  `            <div class="field-group">
              <label class="field-label" for="display-scroll-follow">{i18n.t('Scroll following')}</label>
              <select
                id="display-scroll-follow"
                class="field"
                bind:value={displayForm.scrollFollow}
              >
                {#each SCROLL_FOLLOW_MODES as mode (mode)}
                  <option value={mode}>{i18n.t(SCROLL_FOLLOW_LABELS[mode])}</option>
                {/each}
              </select>
            </div>
            <div class="field-group">
              <label class="field-label" for="display-font">{i18n.t('Font family')}</label>
`,
  'Scroll follow control'
)

replaceOnce(
  'app/src/routes/Settings.svelte',
  `          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-neutral-300">
`,
  `          <div class="space-y-2">
            <label class="flex items-center gap-2 text-sm text-neutral-300">
              <input
                type="checkbox"
                class="accent-violet-500"
                bind:checked={displayForm.streamingOutput}
                aria-label={i18n.t('Streaming output')}
              />
              <span>
                {i18n.t('Streaming output')}
                <span class="ml-1 text-xs text-neutral-500">
                  {i18n.t('Show partial output while the model is writing.')}
                </span>
              </span>
            </label>
            <label class="flex items-center gap-2 text-sm text-neutral-300">
`,
  'Streaming output control'
)

write(
  'app/src/lib/scroll-follow.ts',
  `import type { ScrollFollowMode } from '/common/types/ui'

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
`
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `  import { uiSettings } from '/app/lib/ui-settings.svelte'
`,
  `  import { uiSettings } from '/app/lib/ui-settings.svelte'
  import { isScrollAtBottom, shouldFollowScroll } from '/app/lib/scroll-follow'
`,
  'Chat scroll helper import'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `  let messageList: HTMLOListElement
`,
  `  let messageList: HTMLOListElement
  let wasAtBottom = true
`,
  'Chat scroll state'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `  $effect(() => {
    chats.messages.length
    chats.partial
    tick().then(() => messageList?.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' }))
  })`,
  `  const trackScrollPosition = () => {
    if (messageList) wasAtBottom = isScrollAtBottom(messageList)
  }

  $effect(() => {
    detail.chat._id
    wasAtBottom = true
  })

  $effect(() => {
    chats.messages.length
    chats.partial
    const mode = ui.scrollFollow ?? 'always'
    if (!shouldFollowScroll(mode, wasAtBottom)) return

    tick().then(() => {
      if (!messageList) return
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: chats.partial ? 'auto' : 'smooth',
      })
      wasAtBottom = true
    })
  })`,
  'Chat scroll effect'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `    class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
    aria-live="polite"
`,
  `    class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6"
    aria-live="polite"
    data-testid="message-list"
    onscroll={trackScrollPosition}
`,
  'Message list scroll handler'
)

replaceRegex(
  'app/src/routes/Chat.svelte',
  /            \{#each renderBody\(chats\.partial, detail\.character, true\) as part\}[\s\S]*?            <span class="animate-pulse text-violet-300">▌<\/span>/,
  `            {#if ui.streamingOutput !== false}
              {#each renderBody(chats.partial, detail.character, true) as part}
                {#if part.kind === 'asset'}
                  <button
                    class="chat-asset-frame group block w-full max-w-[32rem] overflow-hidden rounded-xl border border-neutral-700/70 bg-black/40"
                    type="button"
                    aria-label={i18n.t('Open image')}
                    onclick={() => (expandedAsset = part)}
                  >
                    <img
                      class="chat-asset block max-h-[70vh] w-full object-contain transition-transform group-hover:scale-[1.01]"
                      src={part.src}
                      alt={part.name}
                      decoding="async"
                    />
                  </button>
                {:else if part.kind === 'literal'}
                  <code
                    class="asset-tag-missing block break-words rounded-lg bg-black/20 px-2.5 py-1.5 font-mono text-sm"
                  >
                    {part.text}
                  </code>
                {:else if part.html}
                  <div class="rendered-markdown">
                    {@html part.html}
                  </div>
                {/if}
              {/each}
              <span class="animate-pulse text-violet-300">▌</span>
            {:else}
              <span class="text-sm text-neutral-500" data-testid="streaming-hidden">
                {i18n.t('Generating response...')}
              </span>
            {/if}`,
  'streaming output block'
)

const i18nPath = 'app/src/lib/i18n.svelte.ts'
let i18n = read(i18nPath)
if (!i18n.includes(`'Color theme': '색상 테마'`)) {
  i18n = i18n.replace(
    `  Settings: '설정',\n`,
    `  Settings: '설정',\n  'Color theme': '색상 테마',\n  'Appearance mode': '화면 모드',\n  'Scroll following': '스크롤 따라가기',\n  'Always follow': '항상 따라가기',\n  'Follow while at bottom': '하단에 붙어 있을 때만 따라가기',\n  'Never follow': '따라가지 않기',\n  'Streaming output': '스트리밍 출력',\n  'Show partial output while the model is writing.': '모델이 작성하는 동안 중간 출력을 표시합니다.',\n  'Generating response...': '응답 생성 중...',\n`
  )
  write(i18nPath, i18n)
}

walk('app/src', (path) => {
  if (!/\.(svelte|ts|html)$/.test(path)) return
  const source = read(path)
  if (source.includes('Agnai')) write(path, source.replaceAll('Agnai', 'Machina'))
})

replaceOnce(
  'app/src/shared/AppShell.svelte',
  `  let sidebarCollapsed = $state(localStorage.getItem('agnai-sidebar-collapsed') === '1')`,
  `  let sidebarCollapsed = $state(
    (localStorage.getItem('machina-sidebar-collapsed') ??
      localStorage.getItem('agnai-sidebar-collapsed')) === '1'
  )`,
  'sidebar storage migration'
)
replaceOnce(
  'app/src/shared/AppShell.svelte',
  `    localStorage.setItem('agnai-sidebar-collapsed', collapsed ? '1' : '0')`,
  `    localStorage.setItem('machina-sidebar-collapsed', collapsed ? '1' : '0')`,
  'sidebar storage key'
)

const indexPath = 'app/index.html'
write(indexPath, read(indexPath).replaceAll('Agnai', 'Machina'))

const pkgPath = 'package.json'
const pkg = JSON.parse(read(pkgPath))
pkg.name = 'machina'
pkg.version = '1.0.34'
pkg.description = 'Machina AI Roleplay Chat'
pkg.bin = { ...pkg.bin, machina: './srv/bin.js' }
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

write(
  'app/tests/unit/scroll-follow.spec.ts',
  `import { describe, expect, it } from 'vitest'
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
`
)

write(
  'app/tests/e2e/appearance.spec.ts',
  `import { expect, test } from './fixtures'

test('uses the Machina brand and applies a saved light theme', async ({ app }) => {
  await app.goto('/settings/display')
  await expect(app.getByText('Machina', { exact: true }).first()).toBeVisible()

  await app.locator('#display-theme').selectOption('tokyo-night')
  await app.locator('#display-mode').selectOption('light')
  await app.getByRole('button', { name: 'Save display' }).click()

  await expect(app.locator('html')).toHaveAttribute('data-theme', 'tokyo-night')
  await expect(app.locator('html')).toHaveAttribute('data-mode', 'light')
})

test('can hide partial streaming text while generation continues', async ({ app, stub }) => {
  stub.state.extraMessages = [
    {
      _id: 'msg-awaiting-reply',
      kind: 'chat-message',
      chatId: 'chat-1',
      userId: 'user-1',
      parent: 'msg-2',
      msg: 'Continue without showing partial text.',
      retries: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]
  stub.state.inferenceDelayMs = 400
  stub.state.inferenceResponse = 'Completed without visible partial output.'

  await app.goto('/settings/display')
  await app.getByLabel('Streaming output').uncheck()
  await app.getByRole('button', { name: 'Save display' }).click()
  await app.goto('/chat/chat-1')
  await app.getByRole('button', { name: 'Resend last message' }).click()

  await expect(app.getByTestId('streaming-hidden')).toBeVisible()
  await expect(app.getByText('Completed without visible partial output.')).toBeVisible()
})
`
)

console.log('Machina themes and chat behavior patch applied')
