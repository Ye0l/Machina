/**
 * Single source of truth for where the API lives.
 *
 * Dev: Vite serves the app on :1234 while `srv/` listens on :3001.
 * Prod: `srv/app.ts` statically serves the built bundle, so the API shares the origin.
 *
 * No dev proxy is used because auth never relies on cookies -- HTTP sends
 * `Authorization: Bearer` and the socket authenticates with an explicit `login`
 * message -- and the server enables CORS for any origin (`srv/app.ts`).
 */
const devApiPort = '3001'

export const apiOrigin =
  location.port === '1234'
    ? `${location.protocol}//${location.hostname}:${devApiPort}`
    : location.origin

export const wsOrigin = apiOrigin.replace(/^http/, 'ws')

/**
 * Resolves a stored asset path (avatars) to a fetchable URL. Already-absolute values --
 * remote URLs, data URLs and the blob URLs used for un-saved local previews -- pass through
 * untouched.
 */
export function assetUrl(path: string): string {
  if (/^(https?:|data:|blob:)/.test(path)) return path
  return `${apiOrigin}${path.startsWith('/') ? '' : '/'}${path}`
}
