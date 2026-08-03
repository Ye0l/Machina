from __future__ import annotations

import json
from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))


# The story-summary change introduced a second `Characters` property. TypeScript rejects duplicate
# object keys; the existing translation already covers both the library and summary label.
replace_once(
    'app/src/lib/i18n.svelte.ts',
    "  Story: '플롯',\n  Characters: '등장인물',\n",
    "  Story: '플롯',\n",
)

# Inject immutable build metadata into the client bundle. GitHub/Docker supplies BUILD_SHA; local
# Vite builds fall back to the checked-out commit. BUILD_TIME makes rebuilt deployments visible too.
replace_once(
    'app/vite.config.ts',
    "import { existsSync } from 'node:fs'\n",
    "import { existsSync, readFileSync } from 'node:fs'\nimport { execFileSync } from 'node:child_process'\n",
)
replace_once(
    'app/vite.config.ts',
    "const commonDir = repo('../common')\n",
    """const commonDir = repo('../common')
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
""",
)
replace_once(
    'app/vite.config.ts',
    "  plugins: [preferCommonSources(), svelte()],\n  resolve: {\n",
    """  plugins: [preferCommonSources(), svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(packageVersion),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  resolve: {
""",
)

Path('app/src/lib/build.ts').write_text(
    """declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

export const APP_VERSION = __APP_VERSION__ || '0.0.0'
export const BUILD_SHA = __BUILD_SHA__ || 'unknown'
export const BUILD_TIME = __BUILD_TIME__ || 'unknown'
export const BUILD_LABEL = `v${APP_VERSION} · ${BUILD_SHA}`
export const BUILD_DETAILS = `${BUILD_LABEL} · ${BUILD_TIME.replace('T', ' ').replace(/\\.\\d{3}Z$/, ' UTC')}`
"""
)

# Make the local compose build pass its actual checkout SHA instead of the static `selfhost` label.
package_path = Path('package.json')
package = json.loads(package_path.read_text())
package['scripts']['docker:build'] = (
    "SHA=$(git rev-parse --short=7 HEAD 2>/dev/null || echo selfhost); export SHA; "
    "if command -v docker >/dev/null 2>&1; then docker compose -f docker-compose.selfhost.yml "
    "up -d --build; else podman compose -f docker-compose.selfhost.yml up -d --build; fi"
)
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + '\n')

# SHA must be present while Vite runs, not only written to version.txt after the build.
replace_once(
    'Dockerfile',
    "# `build` emits the client into dist/, `build:server` compiles srv/ and common/ in place.\nRUN pnpm run build:all\n\nARG SHA=unknown\nRUN echo \"${SHA}\" > /usr/src/agnai/version.txt\n",
    """# `build` emits the client into dist/, `build:server` compiles srv/ and common/ in place.
# Expose the image's source revision while Vite bundles the client, so the running UI can prove
# exactly which checkout it came from.
ARG SHA=unknown
ENV BUILD_SHA=${SHA}
RUN pnpm run build:all
RUN echo "${SHA}" > /usr/src/agnai/version.txt
""",
)

# Expanded sidebar: a clearly visible build card directly above the signed-in account.
replace_once(
    'app/src/shared/Sidebar.svelte',
    "  import { isRouterClick, router, routes } from '/app/lib/router.svelte'\n",
    "  import { isRouterClick, router, routes } from '/app/lib/router.svelte'\n  import { BUILD_DETAILS, BUILD_LABEL } from '/app/lib/build'\n",
)
replace_once(
    'app/src/shared/Sidebar.svelte',
    """  <div class="flex shrink-0 items-center gap-3 border-t border-neutral-800/80 p-3">
""",
    """  <div
    class="mx-3 mb-3 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 shadow-sm"
    data-testid="build-version"
    title={BUILD_DETAILS}
  >
    <p class="text-[10px] font-semibold uppercase tracking-[0.16em] text-violet-300">Build</p>
    <p class="mt-0.5 truncate font-mono text-xs font-semibold text-violet-100">{BUILD_LABEL}</p>
    <p class="mt-0.5 truncate font-mono text-[10px] text-neutral-500">{BUILD_TIME}</p>
  </div>

  <div class="flex shrink-0 items-center gap-3 border-t border-neutral-800/80 p-3">
""",
)
replace_once(
    'app/src/shared/Sidebar.svelte',
    "  import { BUILD_DETAILS, BUILD_LABEL } from '/app/lib/build'\n",
    "  import { BUILD_DETAILS, BUILD_LABEL, BUILD_TIME } from '/app/lib/build'\n",
)

# Collapsed desktop and mobile layouts also keep a build badge visible at all times.
replace_once(
    'app/src/shared/AppShell.svelte',
    "  import { router, routes } from '/app/lib/router.svelte'\n",
    "  import { router, routes } from '/app/lib/router.svelte'\n  import { APP_VERSION, BUILD_DETAILS, BUILD_LABEL } from '/app/lib/build'\n",
)
replace_once(
    'app/src/shared/AppShell.svelte',
    """    {#if sidebarCollapsed}
      <div class="flex h-16 items-center justify-center border-b border-neutral-800/80">
        <button
          class="icon-button"
          type="button"
          aria-label={i18n.t('Expand sidebar')}
          title={i18n.t('Expand sidebar')}
          onclick={() => setSidebarCollapsed(false)}
        >
          <PanelLeftOpen size={19} />
        </button>
      </div>
""",
    """    {#if sidebarCollapsed}
      <div class="flex h-full flex-col">
        <div class="flex h-16 items-center justify-center border-b border-neutral-800/80">
          <button
            class="icon-button"
            type="button"
            aria-label={i18n.t('Expand sidebar')}
            title={i18n.t('Expand sidebar')}
            onclick={() => setSidebarCollapsed(false)}
          >
            <PanelLeftOpen size={19} />
          </button>
        </div>
        <div class="mt-auto border-t border-neutral-800/80 p-2">
          <span
            class="block rounded-md bg-violet-500/15 px-1 py-1.5 text-center font-mono text-[9px] font-semibold text-violet-200"
            data-testid="build-version"
            title={BUILD_DETAILS}
          >v{APP_VERSION}</span>
        </div>
      </div>
""",
)
replace_once(
    'app/src/shared/AppShell.svelte',
    "      <span class=\"text-sm font-semibold tracking-wide text-white\">Agnai</span>\n",
    """      <span class="text-sm font-semibold tracking-wide text-white">Agnai</span>
      <span
        class="ml-auto rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-1 font-mono text-[10px] font-semibold text-violet-200"
        data-testid="build-version"
        title={BUILD_DETAILS}
      >{BUILD_LABEL}</span>
""",
)

# Browser coverage: the visible app shell must expose a semantic version and revision marker.
routing = Path('app/tests/e2e/routing.spec.ts')
text = routing.read_text()
anchor = """  test('/chat/:id loads the chat on a cold load', async ({ app }) => {
"""
addition = """  test('shows the deployed build version and revision', async ({ app }) => {
    await app.goto('/')
    await waitForLibrary(app)

    const version = app.locator('[data-testid="build-version"]:visible').first()
    await expect(version).toBeVisible()
    await expect(version).toContainText(/v1\\.0\\.27/)
    await expect(version).toContainText('·')
  })

"""
if anchor not in text:
    raise SystemExit('routing test anchor not found')
routing.write_text(text.replace(anchor, addition + anchor, 1))
