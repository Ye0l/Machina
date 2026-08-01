# Client URL Routing

The Svelte client previously kept the visible screen in component state (`view` and
`editorId` on `App.svelte`), so the address bar never changed. Reloading always returned to
the character library, the browser back button left the app, and no screen could be linked
to. This replaces that with real history-based routing.

No server contract changed, and no routing library was added.

## Routes

| Path                | View                                    |
| ------------------- | --------------------------------------- |
| `/`                 | Character library                       |
| `/character/new`    | Character editor, empty                 |
| `/character/:id`    | Character editor for `:id`              |
| `/chat/:id`         | Chat `:id`                              |
| `/settings`         | Settings, General tab                   |
| `/settings/:tab`    | Settings — `providers`, `presets`, `display` |

Unknown paths, and paths with an unknown settings tab, resolve to the nearest real route and
the address bar is rewritten to match, so the URL never disagrees with what is rendered.

## Why real paths rather than a hash

Both hosts already fall back to the app shell for unmatched paths: `srv/app.ts` serves
`dist/index.html` for anything that is not `/api`, `/v1` or a static file, and Vite's dev
server does the same under its default `spa` app type. Deep links therefore work in
development and production without any new configuration.

## What was added

### `app/src/lib/router.svelte.ts`

- `Route` — a discriminated union, one variant per screen. The character variant carries
  `characterId: string | null`, matching the editor's existing prop, so `null` is the create
  form.
- `parse(pathname)` / `toPath(route)` — a pure pair. `parse` never fails; anything
  unrecognised becomes the library route.
- `routes` — path builders used by every link and navigation, so no path string is written
  by hand at a call site.
- `router.go(path)` pushes a history entry, `router.replace(path)` replaces it.
- `router.guard` — consulted before leaving the current view. Used for the unsaved-character
  prompt.
- `isRouterClick(event)` — lets modified clicks and middle-clicks fall through to the
  browser so "open in new tab" keeps working.

### Navigation is anchors, not buttons

Sidebar entries, the character library's edit and create actions, and the chat back button
are now `<a href>` elements whose plain left-clicks are intercepted. The URL is visible on
hover, and the active entry carries `aria-current="page"`.

The "open chat" action on a character card stays a button: the chat id is only known after
the server resolves or creates the chat.

### The route owns the open chat

`App.svelte` runs one effect on route change. On a chat route it loads the chat when the
open one does not match, and on any other route it closes the open chat. Consequences:

- `/chat/:id` works on a cold load and as a shared link, not only after an in-app click.
- A chat that cannot be loaded (deleted, or not owned) redirects to the library rather than
  leaving a dead URL in the address bar.
- A load superseded by a newer navigation is discarded rather than applied late.
- `chats.detail` is read untracked, so loading a chat does not re-trigger the effect.

`chats.resolveChatFor` (was `openCharacter`) and `chats.startNewChat` now return a chat id
instead of opening the chat themselves, and `deleteChat` returns whether the caller should
leave the route. Navigation is what opens a chat, so the URL stays the single source of
truth.

### Settings tabs are part of the URL

`Settings.svelte` takes `tab` as a prop from the route and reports changes back through
`onTabChange`, which uses `replace` so tab switching does not stack history entries.
Transient feedback is cleared by an effect on `tab`, so it also clears on back/forward.

## Fixed while implementing

The character and chat list load moved from `Characters.svelte` to `AppShell.svelte`. Any
route can now be the entry point, and the list load only ran when the library mounted, so a
deep link to a chat left the sidebar's recent chats empty.

That move alone was not enough: `loadCharacters` bailed out on the shared `loading` flag,
which `openChat` sets first on a chat deep link. The list load now has its own `listing`
in-flight guard so the two operations no longer suppress each other.

## Verification

- `pnpm run check` (prettier, tsc, svelte-check, mocha) passes; 72 tests. `pnpm run build`
  passes. `git diff --check` is clean.
- Driven in Chromium against the production build with a stub API, at 1440x900 and 390x844 —
  20 checks, all passing:
  - `/`, `/chat/:id`, `/settings/display`, `/character/:id`, `/character/new` all render the
    right screen on a cold load, with the deep-linked character's data and settings tab.
  - An unknown path canonicalises to `/`; an unloadable chat redirects to `/`.
  - Browser back returns to the previous chat and re-renders it; forward re-enters settings.
  - A deep link populates the sidebar's recent chats (the regression above).
  - Sidebar entries are real anchors with `href`.
  - Unsaved-changes guard: dismissing keeps both the URL and the mounted editor with its
    typed value, on an in-app click and on the browser back button; accepting navigates.
  - Mobile drawer routes and closes; no horizontal page scroll.
  - No page errors and no unexpected failed requests.

## Residual risk and follow-ups

- **No automated regression coverage for the router.** `parse` and `toPath` are pure and
  worth unit testing, but the mocha suite compiles through `srv.tsconfig.json`, which covers
  only `srv/`, `common/` and `tests/`. Adding `app/` to it would emit `.js` beside the `.ts`
  sources, which is exactly the stale-output hazard `app/vite.config.ts`'s
  `preferCommonSources` plugin exists to prevent for `common/`. Giving the client a real
  test runner (Vitest for the pure helpers, Playwright for the flows above) is a separate
  decision with lockfile and CI consequences, so it was not made here. The browser run above
  was performed with a throwaway harness that is not in the repository.
- A guard that refuses a browser back leaves the popped entry on the history stack, because
  the refusal is undone with a `pushState`. The alternative, `history.go(1)`, races with
  further user input. The URL and the rendered view stay correct either way.
- Login is still rendered by the auth gate rather than by a route, so there is no `/login`
  path and no post-login return-to-URL. Logout replaces the URL with `/`.
- Route changes are not reported to any analytics or title handler; the document title is
  static.
