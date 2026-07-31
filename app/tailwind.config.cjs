const path = require('path')

// Absolute so the globs match regardless of CWD: `npm run build` runs from the repo root.
const here = (glob) => path.join(__dirname, glob)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [here('index.html'), here('src/**/*.{svelte,ts}')],
  theme: {
    extend: {
      colors: {
        background: '#090b10',
        'background-lighter': '#0d1017',
      },
    },
  },
  plugins: [],
}
