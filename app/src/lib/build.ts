declare const __APP_VERSION__: string
declare const __BUILD_SHA__: string
declare const __BUILD_TIME__: string

export const APP_VERSION = __APP_VERSION__ || '0.0.0'
export const BUILD_SHA = __BUILD_SHA__ || 'unknown'
export const BUILD_TIME = __BUILD_TIME__ || 'unknown'
export const BUILD_LABEL = `v${APP_VERSION} · ${BUILD_SHA}`
export const BUILD_DETAILS = `${BUILD_LABEL} · ${BUILD_TIME.replace('T', ' ').replace(
  /\.\d{3}Z$/,
  ' UTC'
)}`
