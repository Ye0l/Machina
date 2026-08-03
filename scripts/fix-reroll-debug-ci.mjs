import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before)
  if (index < 0) throw new Error(`Could not find ${label}`)
  if (source.indexOf(before, index + before.length) >= 0) throw new Error(`Duplicate ${label}`)
  return source.slice(0, index) + after + source.slice(index + before.length)
}

{
  const path = 'app/src/lib/generate.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `  generationSummary,\n  resolveGenerationModel,`,
    `  generationSummary,\n  redactGenerationSettings,\n  resolveGenerationModel,`,
    'redaction import'
  )
  source = replaceOnce(
    source,
    `      // This is the actual inference payload minus the user object, which contains credentials.\n      settings: settings ? structuredClone(settings) : undefined,`,
    `      // Convert the Svelte proxy to plain data and recursively remove credentials.\n      settings: redactGenerationSettings(settings),`,
    'debug settings clone'
  )
  writeFileSync(path, source)
}

{
  const path = 'app/tests/e2e/mobile.spec.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `    expect(messagesBox?.y).toBe(chatBox?.y)`,
    `    expect(Math.abs((messagesBox?.y ?? 0) - (chatBox?.y ?? 0))).toBeLessThanOrEqual(1)`,
    'mobile subpixel assertion'
  )
  writeFileSync(path, source)
}
