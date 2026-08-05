from pathlib import Path

root = Path('.')

# Collapsed sidebar: keep primary navigation clickable as icons.
path = root / 'app/src/shared/AppShell.svelte'
s = path.read_text(encoding='utf-8')
s = s.replace(
"  import { Menu, PanelLeftOpen, Settings2, SlidersHorizontal } from '@lucide/svelte'",
"  import {\n    BookOpen,\n    LogOut,\n    Menu,\n    PanelLeftOpen,\n    Plus,\n    Settings as SettingsIcon,\n    Settings2,\n    SlidersHorizontal,\n    UserRound,\n    Users,\n  } from '@lucide/svelte'"
)
s = s.replace(
"  const route = $derived(router.route)\n",
"  const route = $derived(router.route)\n  const inCharacters = $derived(\n    route.name === 'characters' || route.name === 'character' || route.name === 'character-new'\n  )\n  const inBooks = $derived(route.name === 'books' || route.name === 'book')\n  const inPersonas = $derived(route.name === 'personas' || route.name === 'persona')\n"
)
old = '''        <div class="mt-auto border-t border-neutral-800/80 p-2">
          <span
            class="block rounded-md bg-violet-500/15 px-1 py-1.5 text-center font-mono text-[9px] font-semibold text-violet-200"
            data-testid="build-version"
            title={BUILD_DETAILS}>v{APP_VERSION}</span
          >
        </div>'''
new = '''        <nav class="flex flex-1 flex-col items-center gap-1 py-3" aria-label="Primary navigation">
          <a
            class={inCharacters
              ? 'icon-button bg-violet-500/15 text-violet-300'
              : 'icon-button'}
            href={routes.newCharacter()}
            aria-label={i18n.t('New character')}
            title={i18n.t('New character')}
            onclick={(event) => {
              event.preventDefault()
              navigate(routes.newCharacter())
            }}
          >
            <Plus size={19} />
          </a>
          <a
            class={inCharacters
              ? 'icon-button bg-violet-500/15 text-violet-300'
              : 'icon-button'}
            href={routes.characters()}
            aria-current={inCharacters ? 'page' : undefined}
            aria-label={i18n.t('Characters')}
            title={i18n.t('Characters')}
            onclick={(event) => {
              event.preventDefault()
              navigate(routes.characters())
            }}
          >
            <Users size={19} />
          </a>
          <a
            class={inBooks ? 'icon-button bg-violet-500/15 text-violet-300' : 'icon-button'}
            href={routes.books()}
            aria-current={inBooks ? 'page' : undefined}
            aria-label={i18n.t('Memory books')}
            title={i18n.t('Memory books')}
            onclick={(event) => {
              event.preventDefault()
              navigate(routes.books())
            }}
          >
            <BookOpen size={19} />
          </a>
          <a
            class={inPersonas
              ? 'icon-button bg-violet-500/15 text-violet-300'
              : 'icon-button'}
            href={routes.personas()}
            aria-current={inPersonas ? 'page' : undefined}
            aria-label={i18n.t('Personas')}
            title={i18n.t('Personas')}
            onclick={(event) => {
              event.preventDefault()
              navigate(routes.personas())
            }}
          >
            <UserRound size={19} />
          </a>
          <a
            class={route.name === 'settings'
              ? 'icon-button bg-violet-500/15 text-violet-300'
              : 'icon-button'}
            href={routes.settings()}
            aria-current={route.name === 'settings' ? 'page' : undefined}
            aria-label={i18n.t('Settings')}
            title={i18n.t('Settings')}
            onclick={(event) => {
              event.preventDefault()
              navigate(routes.settings())
            }}
          >
            <SettingsIcon size={19} />
          </a>
        </nav>
        <div class="border-t border-neutral-800/80 p-2">
          <button
            class="icon-button mx-auto mb-2"
            type="button"
            aria-label={i18n.t('Sign out')}
            title={i18n.t('Sign out')}
            onclick={onLogout}
          >
            <LogOut size={18} />
          </button>
          <span
            class="block rounded-md bg-violet-500/15 px-1 py-1.5 text-center font-mono text-[9px] font-semibold text-violet-200"
            data-testid="build-version"
            title={BUILD_DETAILS}>v{APP_VERSION}</span
          >
        </div>'''
if old not in s:
    raise SystemExit('collapsed sidebar anchor not found')
s = s.replace(old, new)
path.write_text(s, encoding='utf-8')

# Preset duplication: ask the server to clone its owned internal record.
path = root / 'app/src/lib/settings.svelte.ts'
s = path.read_text(encoding='utf-8')
old = '''      const body: Record<string, any> = structuredClone(preset)
      delete body._id
      delete body.userId
      delete body.kind
      delete body.updatedAt
      delete body.thirdPartyKey
      delete body.thirdPartyKeySet
      body.name = name.trim()

      const created = await api.post<AppSchema.UserGenPreset>('/user/presets', body)'''
new = '''      const created = await api.post<AppSchema.UserGenPreset>(
        `/user/presets/${preset._id}/duplicate`,
        { name: name.trim() }
      )'''
if old not in s:
    raise SystemExit('duplicate preset client anchor not found')
s = s.replace(old, new)
path.write_text(s, encoding='utf-8')

# Server-side duplicate uses the internal record, validates ownership, and strips identity/secrets.
path = root / 'srv/api/user/presets.ts'
s = path.read_text(encoding='utf-8')
anchor = '''export const updateUserPreset = handle(async ({ params, body, userId }) => {'''
handler = '''export const duplicateUserPreset = handle(async ({ params, body, userId }) => {
  assertValid({ name: 'string' }, body)
  const source = await store.presets.getUserPresetInternal(params.id)
  if (!source || source.userId !== userId) {
    throw new StatusError('Preset not found', 404)
  }

  const copy: Record<string, any> = deepClone(source)
  delete copy._id
  delete copy.userId
  delete copy.kind
  delete copy.createdAt
  delete copy.updatedAt
  delete copy.thirdPartyKey
  delete copy.thirdPartyKeySet
  copy.name = body.name.trim()

  return store.presets.createUserPreset(userId!, copy as AppSchema.UserGenPreset)
})

'''
if anchor not in s:
    raise SystemExit('preset server anchor not found')
s = s.replace(anchor, handler + anchor)
path.write_text(s, encoding='utf-8')

path = root / 'srv/api/user/index.ts'
s = path.read_text(encoding='utf-8')
s = s.replace('  createUserPreset,\n', '  createUserPreset,\n  duplicateUserPreset,\n')
s = s.replace(
"router.post('/presets', loggedIn, createUserPreset)\n",
"router.post('/presets', loggedIn, createUserPreset)\nrouter.post('/presets/:id/duplicate', loggedIn, duplicateUserPreset)\n"
)
path.write_text(s, encoding='utf-8')

# Memory book duplication now preserves book-level V2 options supported by the create endpoint.
path = root / 'app/src/lib/books.svelte.ts'
s = path.read_text(encoding='utf-8')
s = s.replace(
'''export type BookDraft = {
  name: string
  description: string
  folder: string
  entries: AppSchema.MemoryEntry[]
}''',
'''export type BookDraft = {
  name: string
  description: string
  folder: string
  entries: AppSchema.MemoryEntry[]
  scanDepth?: number
  tokenBudget?: number
  recursiveScanning?: boolean
  caseSensitive?: boolean
  matchWholeWords?: boolean
}'''
)
s = s.replace(
'''      entries: structuredClone(book.entries ?? []),
    })''',
'''      entries: structuredClone(book.entries ?? []),
      scanDepth: book.scanDepth,
      tokenBudget: book.tokenBudget,
      recursiveScanning: book.recursiveScanning,
      caseSensitive: book.caseSensitive,
      matchWholeWords: book.matchWholeWords,
    })'''
)
path.write_text(s, encoding='utf-8')
