import { readFileSync, writeFileSync } from 'node:fs'

const path = 'app/tests/unit/prompt-preview.spec.ts'
let source = readFileSync(path, 'utf8')

const ordinaryBroken = `  it('renders the sample conversation into the history placeholder', async () => {
    const { text } = await render('{{history}}')
    expect(text).toContain('Robot: Hi, nice to meet you!')`
const ordinaryFixed = `  it('renders the sample conversation into the history placeholder', async () => {
    const { text } = await render('{{history}}')
    expect(text).toContain('Rory: Hi, nice to meet you!')`
if (source.includes(ordinaryBroken)) source = source.replace(ordinaryBroken, ordinaryFixed)

const risuBroken = `    expect(text).toContain('RISU-ENABLED')
    expect(text).not.toContain('RISU-DISABLED')
    expect(text).toContain('Rory: Hi, nice to meet you!')`
const risuFixed = `    expect(text).toContain('RISU-ENABLED')
    expect(text).not.toContain('RISU-DISABLED')
    expect(text).toContain('Robot: Hi, nice to meet you!')`
if (source.includes(risuBroken)) source = source.replace(risuBroken, risuFixed)

if (!source.includes(ordinaryFixed) || !source.includes(risuFixed)) {
  throw new Error('prompt preview speaker assertions were not fixed precisely')
}

writeFileSync(path, source)
