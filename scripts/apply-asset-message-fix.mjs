import { readFileSync, writeFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const write = (path, content) => writeFileSync(path, content)

function replaceOnce(path, before, after, label) {
  const source = read(path)
  if (source.includes(after)) return
  if (!source.includes(before)) throw new Error(`${path}: missing ${label}`)
  write(path, source.replace(before, after))
}

function replaceAll(path, before, after, expected, label) {
  const source = read(path)
  const count = source.split(before).length - 1
  if (count === 0 && source.includes(after)) return
  if (count !== expected) throw new Error(`${path}: expected ${expected} ${label}, found ${count}`)
  write(path, source.split(before).join(after))
}

replaceOnce(
  'app/src/lib/generate.ts',
  "import { withAssetInstruction } from '/common/assets'",
  "import { withAssetInstruction, withAssetInstructionMessages } from '/common/assets'",
  'asset import'
)

replaceAll(
  'app/src/lib/generate.ts',
  '    prompt: withAssetInstruction(request.prompt, char.assets),\n    messages: request.messages,',
  '    prompt: withAssetInstruction(request.prompt, char.assets, char.name),\n    messages: withAssetInstructionMessages(request.messages, char.assets, char.name),',
  2,
  'inference request asset blocks'
)

replaceOnce(
  'app/tests/e2e/assets.spec.ts',
  "    expect(prompt).toContain('{{asset::name}}')\n    expect(prompt).toContain('- smiling')\n  })",
  "    expect(prompt).toContain('{{asset::name}}')\n    expect(prompt).toContain('- smiling')\n\n    const request = stub.state.inferenceRequests.at(-1)\n    const structured = request?.messages.map((message) => message.content).join('\\n') ?? ''\n    expect(structured).toContain('{{asset::name}}')\n    expect(structured).toContain('- smiling')\n    expect(structured).toContain('Aria can show an image')\n  })",
  'E2E structured request assertion'
)

const pkgPath = 'package.json'
const pkg = JSON.parse(read(pkgPath))
pkg.version = '1.0.36'
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log('Asset instructions now reach both flat prompts and structured messages.')
