/**
 * PNG chunk helpers, declared against `Uint8Array` rather than `Buffer`.
 *
 * `common/module.d.ts` already declares these, but types them with `Buffer` and is not in
 * this project's `include`. Vite does not polyfill `Buffer` the way the legacy Parcel build
 * did, so the client works in raw bytes and needs its own declarations.
 */

declare module 'png-chunks-extract' {
  function extract(data: Uint8Array): Array<{ name: string; data: Uint8Array }>
  export default extract
}

declare module 'png-chunks-encode' {
  function encode(chunks: Array<{ name: string; data: Uint8Array }>): Uint8Array
  export default encode
}

declare module 'png-chunk-text' {
  export function decode(data: Uint8Array): { keyword: string; text: string }
  export function encode(keyword: string, text: string): { name: string; data: Uint8Array }
}
