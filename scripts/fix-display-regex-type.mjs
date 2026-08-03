import { readFileSync, writeFileSync } from 'node:fs'

const path = 'app/src/lib/settings.svelte.ts'
let source = readFileSync(path, 'utf8')
const before =
  '        temporary: withDisplayRegexRules(existing ?? {}, input.displayRegexRules).temporary,\n'
const after = `        temporary: withDisplayRegexRules(
          { temporary: existing?.temporary },
          input.displayRegexRules
        ).temporary,
`
if (!source.includes(before)) throw new Error('Could not locate display regex temporary assignment')
source = source.replace(before, after)
writeFileSync(path, source)
