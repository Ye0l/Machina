import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, resolve as resolvePath } from 'node:path'

const repo = (path: string) => fileURLToPath(new URL(path, import.meta.url))

const commonDir = repo('../common')
const packageVersion = String(JSON.parse(readFileSync(repo('../package.json'), 'utf8')).version)

const localGitSha = () => {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: repo('..'),
      encoding: 'utf8',
    }).trim()
  } catch {
    return 'unknown'
  }
}

const rawBuildSha = (process.env.BUILD_SHA || process.env.GITHUB_SHA || localGitSha()).trim()
const buildSha = /^[0-9a-f]{7,}$/i.test(rawBuildSha) ? rawBuildSha.slice(0, 7) : rawBuildSha
const buildTime = process.env.BUILD_TIME || new Date().toISOString()

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
export function preferCommonSources(): Plugin {
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
  // Vite's `root` defaults to the CWD, not the config location, so `pnpm run build` from
  // the repo root would otherwise look for `<repo>/index.html`.
  root: repo('.'),
  plugins: [preferCommonSources(), svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
    /**
     * These aliases are absolute-looking prefixes, and Vite applies aliases to real
     * filesystem paths as well as to import specifiers. The project must therefore not live
     * at a path beginning with one of them: checked out under `/app`, the entry's own path
     * `/app/app/index.html` is rewritten to `/app/app/src/app/index.html` and the build
     * fails. The Dockerfile's working directory is chosen with this in mind.
     */
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
