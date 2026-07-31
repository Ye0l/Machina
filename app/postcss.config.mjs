import { fileURLToPath } from 'node:url'

// Resolved against this file, not the CWD: `pnpm run build` runs from the repo root.
const config = fileURLToPath(new URL('./tailwind.config.cjs', import.meta.url))

export default {
  plugins: {
    tailwindcss: { config },
  },
}
