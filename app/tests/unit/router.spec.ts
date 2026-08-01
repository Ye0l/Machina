import { describe, expect, it } from 'vitest'
import { parse, routes, toPath, isRouterClick, type Route } from '/app/lib/router.svelte'

describe('parse', () => {
  it('maps the library paths', () => {
    expect(parse('/')).toEqual({ name: 'characters' })
    expect(parse('/characters')).toEqual({ name: 'characters' })
  })

  it('distinguishes the create form from an edit', () => {
    expect(parse('/character/new')).toEqual({ name: 'character', characterId: null })
    expect(parse('/character/abc')).toEqual({ name: 'character', characterId: 'abc' })
    expect(parse('/memory/new')).toEqual({ name: 'book', bookId: null })
    expect(parse('/memory/abc')).toEqual({ name: 'book', bookId: 'abc' })
  })

  it('reads chat and book ids', () => {
    expect(parse('/chat/xyz')).toEqual({ name: 'chat', chatId: 'xyz' })
    expect(parse('/memory')).toEqual({ name: 'books' })
  })

  it('decodes percent-encoded ids', () => {
    expect(parse('/chat/a%2Fb')).toEqual({ name: 'chat', chatId: 'a/b' })
  })

  it('defaults settings to the general tab and rejects unknown tabs', () => {
    expect(parse('/settings')).toEqual({ name: 'settings', tab: 'general' })
    expect(parse('/settings/display')).toEqual({ name: 'settings', tab: 'display' })
    expect(parse('/settings/nope')).toEqual({ name: 'settings', tab: 'general' })
  })

  it('falls back to the library rather than yielding a dead route', () => {
    expect(parse('/does-not-exist')).toEqual({ name: 'characters' })
    // A section path with no id is not a real view.
    expect(parse('/chat')).toEqual({ name: 'characters' })
    expect(parse('/character')).toEqual({ name: 'characters' })
  })
})

describe('toPath', () => {
  const cases: Route[] = [
    { name: 'characters' },
    { name: 'character', characterId: null },
    { name: 'character', characterId: 'abc' },
    { name: 'chat', chatId: 'xyz' },
    { name: 'books' },
    { name: 'book', bookId: null },
    { name: 'book', bookId: 'abc' },
    { name: 'settings', tab: 'general' },
    { name: 'settings', tab: 'presets' },
  ]

  it.each(cases)('round-trips %j', (route) => {
    expect(parse(toPath(route))).toEqual(route)
  })

  it('canonicalises the aliases that parse accepts', () => {
    expect(toPath(parse('/characters'))).toBe('/')
    expect(toPath(parse('/settings/nope'))).toBe('/settings')
  })

  it('escapes ids that would otherwise change the path shape', () => {
    expect(toPath({ name: 'chat', chatId: 'a/b' })).toBe('/chat/a%2Fb')
    expect(routes.character('a b')).toBe('/character/a%20b')
  })
})

describe('isRouterClick', () => {
  const click = (overrides: Partial<MouseEvent> = {}) =>
    ({
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      defaultPrevented: false,
      ...overrides,
    } as MouseEvent)

  it('handles a plain left click', () => {
    expect(isRouterClick(click())).toBe(true)
  })

  it('leaves modified and middle clicks to the browser', () => {
    expect(isRouterClick(click({ button: 1 }))).toBe(false)
    expect(isRouterClick(click({ metaKey: true }))).toBe(false)
    expect(isRouterClick(click({ ctrlKey: true }))).toBe(false)
    expect(isRouterClick(click({ shiftKey: true }))).toBe(false)
    expect(isRouterClick(click({ altKey: true }))).toBe(false)
  })

  it('does not re-handle a click something else already claimed', () => {
    expect(isRouterClick(click({ defaultPrevented: true }))).toBe(false)
  })
})
