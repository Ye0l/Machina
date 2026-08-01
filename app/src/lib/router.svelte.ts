/**
 * Minimal history-based router.
 *
 * Real paths are used rather than a hash fragment because both hosts already fall back to
 * the app shell: `srv/app.ts` serves `dist/index.html` for every path that is not `/api`,
 * `/v1` or a static file, and Vite's dev server does the same under its default `spa` app
 * type. No extra server configuration is required for deep links.
 */

export const SETTINGS_TABS = ['general', 'providers', 'presets', 'display'] as const
export type SettingsTab = (typeof SETTINGS_TABS)[number]

/**
 * Sections of a character's workspace. A saved character owns its chats and its own memory
 * book, so they are tabs of the character rather than top-level destinations.
 */
export const CHARACTER_TABS = ['chats', 'edit', 'book', 'assets'] as const
export type CharacterTab = (typeof CHARACTER_TABS)[number]

export type Route =
  | { name: 'characters' }
  /** The create form, which has no chats or book to show yet. */
  | { name: 'character-new' }
  | { name: 'character'; characterId: string; tab: CharacterTab }
  | { name: 'chat'; chatId: string }
  | { name: 'books' }
  /** `bookId` is null for the create form. */
  | { name: 'book'; bookId: string | null }
  | { name: 'personas' }
  /** `personaId` is null for the create form. */
  | { name: 'persona'; personaId: string | null }
  | { name: 'settings'; tab: SettingsTab }

export type RouteName = Route['name']

const isSettingsTab = (value: string): value is SettingsTab =>
  (SETTINGS_TABS as readonly string[]).includes(value)

const isCharacterTab = (value: string): value is CharacterTab =>
  (CHARACTER_TABS as readonly string[]).includes(value)

export const routes = {
  characters: () => '/',
  newCharacter: () => '/character/new',
  character: (characterId: string, tab: CharacterTab = 'chats') => {
    const base = `/character/${encodeURIComponent(characterId)}`
    return tab === 'chats' ? base : `${base}/${tab}`
  },
  chat: (chatId: string) => `/chat/${encodeURIComponent(chatId)}`,
  books: () => '/memory',
  newBook: () => '/memory/new',
  book: (bookId: string) => `/memory/${encodeURIComponent(bookId)}`,
  personas: () => '/persona',
  newPersona: () => '/persona/new',
  persona: (personaId: string) => `/persona/${encodeURIComponent(personaId)}`,
  settings: (tab: SettingsTab = 'general') =>
    tab === 'general' ? '/settings' : `/settings/${tab}`,
}

/** Unknown paths resolve to the character library rather than rendering a dead view. */
export function parse(pathname: string): Route {
  const [, head = '', tail = '', rest = ''] = pathname.split('/')

  switch (head) {
    case '':
    case 'characters':
      return { name: 'characters' }

    case 'character': {
      if (!tail) return { name: 'characters' }
      if (tail === 'new') return { name: 'character-new' }
      return {
        name: 'character',
        characterId: decodeURIComponent(tail),
        tab: isCharacterTab(rest) ? rest : 'chats',
      }
    }

    case 'chat':
      return tail ? { name: 'chat', chatId: decodeURIComponent(tail) } : { name: 'characters' }

    case 'memory':
      if (!tail) return { name: 'books' }
      return { name: 'book', bookId: tail === 'new' ? null : decodeURIComponent(tail) }

    case 'persona':
      if (!tail) return { name: 'personas' }
      return { name: 'persona', personaId: tail === 'new' ? null : decodeURIComponent(tail) }

    case 'settings':
      return { name: 'settings', tab: isSettingsTab(tail) ? tail : 'general' }

    default:
      return { name: 'characters' }
  }
}

export function toPath(route: Route): string {
  switch (route.name) {
    case 'characters':
      return routes.characters()
    case 'character-new':
      return routes.newCharacter()
    case 'character':
      return routes.character(route.characterId, route.tab)
    case 'chat':
      return routes.chat(route.chatId)
    case 'books':
      return routes.books()
    case 'book':
      return route.bookId === null ? routes.newBook() : routes.book(route.bookId)
    case 'personas':
      return routes.personas()
    case 'persona':
      return route.personaId === null ? routes.newPersona() : routes.persona(route.personaId)
    case 'settings':
      return routes.settings(route.tab)
  }
}

/**
 * True when the router should handle an anchor click itself. Modified clicks and
 * middle-clicks are left to the browser so "open in new tab" keeps working.
 */
export function isRouterClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    !event.defaultPrevented
  )
}

class Router {
  route = $state<Route>(parse(location.pathname))

  /**
   * Consulted before any navigation that would leave the current view. Returning false
   * keeps the user where they are. Used for the unsaved-character prompt.
   */
  guard: (() => boolean) | null = null

  constructor() {
    // An unknown or non-canonical entry path (`/characters`, `/settings/nope`) resolves to
    // a real route, so rewrite the address bar to match what is actually rendered.
    const canonical = toPath(this.route)
    if (canonical !== location.pathname) history.replaceState(null, '', canonical)

    window.addEventListener('popstate', () => {
      const next = parse(location.pathname)

      // A pop has already changed the URL by the time it is observable, so a refused
      // navigation is undone by pushing the current route back on. This leaves the popped
      // entry in the history stack; the alternative (history.go(1)) races with the user.
      if (!this.canLeave()) {
        history.pushState(null, '', toPath(this.route))
        return
      }

      this.route = next
    })
  }

  canLeave() {
    return !this.guard || this.guard()
  }

  /** Pushes a history entry. Returns false when the guard refused. */
  go(path: string) {
    if (!this.canLeave()) return false
    this.commit(path, false)
    return true
  }

  /** Replaces the current history entry, bypassing the guard. */
  replace(path: string) {
    this.commit(path, true)
  }

  private commit(path: string, replace: boolean) {
    const route = parse(path)
    const canonical = toPath(route)

    if (canonical !== location.pathname) {
      if (replace) history.replaceState(null, '', canonical)
      else history.pushState(null, '', canonical)
    }

    this.route = route
  }
}

export const router = new Router()
