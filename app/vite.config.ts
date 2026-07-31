import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'

const repo = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const commonDir = repo('../common')

/**
 * `tsc -p srv.tsconfig.json` emits .js beside the .ts sources in `common/` (gitignored,
 * but present whenever the server has been built). Vite resolves `.js` before `.ts`, so
 * importing a shared module would silently bundle stale build output.
 *
 * Scoped to `common/` on purpose: flipping `resolve.extensions` globally would also make
 * dual-published node_modules packages resolve to their TypeScript sources.
 *
 * Both entry shapes must be handled -- `/common/x` from the app, and the relative imports
 * (`./types`) that shared modules use between themselves.
 */
function preferCommonSources(): Plugin {
  const toSource = (base: string) => {
    if (/\.[a-z]+$/i.test(base)) return null
    for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
      if (existsSync(candidate)) return candidate
    }
    return null
  }

  return {
    name: 'prefer-common-ts-sources',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('/common/')) {
        return toSource(resolvePath(commonDir, source.slice('/common/'.length)))
      }

      if (source.startsWith('.') && importer?.startsWith(`${commonDir}/`)) {
        return toSource(resolvePath(dirname(importer), source))
      }

      return source.startsWith(commonDir) ? toSource(source) : null
    },
  }
}

export default defineConfig({
  // Vite's `root` defaults to the CWD, not the config location, so `npm run build` from
  // the repo root would otherwise look for `<repo>/index.html`.
  root: repo('.'),
  plugins: [preferCommonSources(), svelte()],
  resolve: {
    alias: [
      // The shared layer is imported with absolute-looking specifiers (`/common/...`),
      // matching the convention already used by `srv/` and the legacy `web/` frontend.
      //
      // There is deliberately no `/srv` alias: server type imports erase at compile time,
      // so a genuine runtime import from `srv/` must fail the build.
      { find: /^\/common\//, replacement: `${commonDir}/` },
      { find: /^\/app\//, replacement: `${repo('./src')}/` },
    ],
  },
  server: {
    port: 1234,
    strictPort: true,
  },
  build: {
    // `srv/app.ts` statically serves `<repo>/dist`.
    outDir: repo('../dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
})
