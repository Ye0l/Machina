import { readFileSync, writeFileSync } from 'node:fs'

const path = 'app/src/lib/i18n.svelte.ts'
let source = readFileSync(path, 'utf8')
const line = "  Enabled: '활성화',\n"
if (!source.includes(line)) throw new Error('Display regex Enabled translation not found')
source = source.replace(line, '')
writeFileSync(path, source)
