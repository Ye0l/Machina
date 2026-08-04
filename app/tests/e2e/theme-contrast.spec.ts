import { expect, test } from './fixtures'

const themes = [
  'default',
  'agnoaster',
  'gruvbox',
  'automata',
  'overdose',
  'tokyo-night',
  'nord',
] as const

const modes = ['dark', 'light'] as const

test('all theme palettes keep text and controls readable', async ({ app }) => {
  await app.goto('/settings/display')

  for (const theme of themes) {
    for (const mode of modes) {
      const ratios = await app.evaluate(
        ({ theme, mode }) => {
          const root = document.documentElement
          root.dataset.theme = theme
          root.dataset.mode = mode
          const style = getComputedStyle(root)

          const rgb = (name: string) =>
            style
              .getPropertyValue(name)
              .trim()
              .split(/\s+/)
              .map(Number)

          const luminance = (value: number[]) => {
            const [red, green, blue] = value.map((channel) => {
              const normalized = channel / 255
              return normalized <= 0.04045
                ? normalized / 12.92
                : ((normalized + 0.055) / 1.055) ** 2.4
            })
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue
          }

          const contrast = (left: number[], right: number[]) => {
            const values = [luminance(left), luminance(right)].sort((a, b) => b - a)
            return (values[0] + 0.05) / (values[1] + 0.05)
          }

          return {
            page: contrast(rgb('--text-strong'), rgb('--app-bg')),
            message: contrast(rgb('--neutral-100'), rgb('--surface-message')),
            muted: contrast(rgb('--neutral-300'), rgb('--surface-panel')),
            accentText: contrast(rgb('--violet-200'), rgb('--surface-panel')),
            primary: contrast(rgb('--accent-contrast'), rgb('--violet-600')),
          }
        },
        { theme, mode }
      )

      expect(ratios.page, `${theme}/${mode} page text`).toBeGreaterThanOrEqual(7)
      expect(ratios.message, `${theme}/${mode} message text`).toBeGreaterThanOrEqual(4.5)
      expect(ratios.muted, `${theme}/${mode} muted text`).toBeGreaterThanOrEqual(4.5)
      expect(ratios.accentText, `${theme}/${mode} accent text`).toBeGreaterThanOrEqual(4.5)
      expect(ratios.primary, `${theme}/${mode} primary button`).toBeGreaterThanOrEqual(4.5)
    }
  }
})
