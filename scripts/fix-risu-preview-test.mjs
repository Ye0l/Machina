import { readFileSync, writeFileSync } from 'node:fs'

const path = 'app/tests/unit/prompt-preview.spec.ts'
const source = readFileSync(path, 'utf8')
const before = "expect(text).toContain('Rory: Hi, nice to meet you!')"
const after = "expect(text).toContain('Robot: Hi, nice to meet you!')"
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('preview speaker assertion not found')
  writeFileSync(path, source.replace(before, after))
}
