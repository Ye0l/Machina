const path = require('path')

const here = (glob) => path.join(__dirname, glob)
const css = (name) => `rgb(var(--${name}) / <alpha-value>)`
const scale = (name) =>
  Object.fromEntries(
    [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((step) => [
      step,
      css(`${name}-${step}`),
    ])
  )

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
