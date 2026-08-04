export function mergeProviderSettings<T extends Record<string, any>>(
  payload: T,
  settings: Record<string, any> | undefined
): T {
  if (!settings || Array.isArray(settings) || typeof settings !== 'object') return payload
  return Object.assign(payload, settings)
}
