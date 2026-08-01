import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { preferCommonSources } from './vite.config'

const repo = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Unit tests for the client's pure logic.
 *
 * The Svelte plugin is needed for `.svelte.ts` modules (the router uses runes), and
 * `preferCommonSources` for the same reason the app build needs it: `tsc -p
 * srv.tsconfig.json` emits `.js` beside the `.ts` sources in `common/`, and Vite would
 * resolve the stale build output first.
 *
 * Browser flows are covered by `app/playwright.config.ts` instead; anything needing a real
 * canvas, downloads or navigation belongs there, not here.
 */
export default defineConfig({
  // The app directory, not the repo root. With the repo as root, test module ids start with
  // `/app/` and are captured by the alias below, which rewrites them into `app/src/`.
  root: repo('.'),
  plugins: [preferCommonSources(), svelte()],
  resolve: {
    alias: [
      { find: /^\/common\//, replacement: `${repo('../common')}/` },
      { find: /^\/app\//, replacement: `${repo('./src')}/` },
    ],
  },
  test: {
    // jsdom, not node: DOMPurify needs a window, and the router reads location/history.
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'],
    restoreMocks: true,
  },
})
