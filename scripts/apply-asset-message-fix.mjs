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
  `import { withAssetInstruction } from '/common/assets'`,
  `import { withAssetInstruction, withAssetInstructionMessages } from '/common/assets'`,
  'asset import'
)

replaceAll(
  'app/src/lib/generate.ts',
  `    prompt: withAssetInstruction(request.prompt, char.assets),\n    messages: request.messages,`,
  `    prompt: withAssetInstruction(request.prompt, char.assets, char.name),\n    messages: withAssetInstructionMessages(request.messages, char.assets, char.name),`,
  2,
  'inference request asset blocks'
)

replaceOnce(
  'common/assets.ts',
  `export function assetInstruction(assets: AppSchema.CharacterAsset[] | undefined): string {\n  const names = (assets ?? []).map((asset) => asset.name.trim()).filter(Boolean)`,
  `export function assetInstruction(\n  assets: AppSchema.CharacterAsset[] | undefined,\n  characterName = '{{char}}'\n): string {\n  const names = (assets ?? []).map((asset) => asset.name.trim()).filter(Boolean)`,
  'assetInstruction signature'
)

replaceOnce(
  'common/assets.ts',
  '    `{{char}} can show an image by writing {{asset::name}} on its own line, using one of these names exactly:`,',
  '    `${characterName} can show an image by writing {{asset::name}} on its own line, using one of these names exactly:`,',
  'character name instruction'
)

replaceOnce(
  'common/assets.ts',
  `export function withAssetInstruction(\n  prompt: string,\n  assets: AppSchema.CharacterAsset[] | undefined\n) {\n  const instruction = assetInstruction(assets)\n  return instruction ? \`${'${prompt}'}\\n\\n${'${instruction}'}\` : prompt\n}\n`,
  `export function withAssetInstruction(\n  prompt: string,\n  assets: AppSchema.CharacterAsset[] | undefined,\n  characterName?: string\n) {\n  const instruction = assetInstruction(assets, characterName)\n  return instruction ? \`${'${prompt}'}\\n\\n${'${instruction}'}\` : prompt\n}\n\nexport type AssetInstructionMessage = { role: string; content: string }\n\n/**\n * Adds the same mandatory asset instruction to structured chat messages. Chat adapters consume\n * these messages instead of the flat prompt, so updating only `prompt` silently drops the list.\n * Merge into the first system message when possible; otherwise create one before the conversation.\n */\nexport function withAssetInstructionMessages<T extends AssetInstructionMessage>(\n  messages: T[],\n  assets: AppSchema.CharacterAsset[] | undefined,\n  characterName?: string\n): T[] {\n  const instruction = assetInstruction(assets, characterName)\n  if (!instruction) return messages\n\n  const systemIndex = messages.findIndex((message) => message.role === 'system')\n  if (systemIndex === -1) {\n    return [{ role: 'system', content: instruction } as T, ...messages]\n  }\n\n  return messages.map((message, index) =>\n    index === systemIndex\n      ? ({ ...message, content: \`${'${message.content}'}\\n\\n${'${instruction}'}\` } as T)\n      : message\n  )\n}\n`,
  'structured asset instruction helper'
)

replaceOnce(
  'app/tests/unit/assets.spec.ts',
  `  withAssetInstruction,\n} from '/common/assets'`,
  `  withAssetInstruction,\n  withAssetInstructionMessages,\n} from '/common/assets'`,
  'unit import'
)

replaceOnce(
  'app/tests/unit/assets.spec.ts',
  `  it('leaves the prompt byte-identical when the character has no assets', () => {\n    expect(withAssetInstruction('PROMPT-BODY', [])).toBe('PROMPT-BODY')\n    expect(withAssetInstruction('PROMPT-BODY', undefined)).toBe('PROMPT-BODY')\n  })\n})`,
  `  it('leaves the prompt byte-identical when the character has no assets', () => {\n    expect(withAssetInstruction('PROMPT-BODY', [])).toBe('PROMPT-BODY')\n    expect(withAssetInstruction('PROMPT-BODY', undefined)).toBe('PROMPT-BODY')\n  })\n\n  it('adds the instruction to structured messages consumed by chat adapters', () => {\n    const messages = [\n      { role: 'system', content: 'SYSTEM-BODY' },\n      { role: 'user', content: 'Hello' },\n    ]\n    const result = withAssetInstructionMessages(messages, assets, 'Aria')\n\n    expect(result[0].content).toContain('SYSTEM-BODY')\n    expect(result[0].content).toContain('Aria can show an image')\n    expect(result[0].content).toContain('- smiling')\n    expect(result[1]).toEqual(messages[1])\n    expect(messages[0].content).toBe('SYSTEM-BODY')\n  })\n\n  it('creates a system message when the structured request has none', () => {\n    const result = withAssetInstructionMessages([{ role: 'user', content: 'Hello' }], assets)\n    expect(result[0].role).toBe('system')\n    expect(result[0].content).toContain('{{asset::name}}')\n    expect(result[1]).toEqual({ role: 'user', content: 'Hello' })\n  })\n\n  it('leaves structured messages untouched when there are no assets', () => {\n    const messages = [{ role: 'user', content: 'Hello' }]\n    expect(withAssetInstructionMessages(messages, [])).toBe(messages)\n  })\n})`,
  'unit message tests'
)

replaceOnce(
  'app/tests/e2e/assets.spec.ts',
  `    expect(prompt).toContain('{{asset::name}}')\n    expect(prompt).toContain('- smiling')\n  })`,
  `    expect(prompt).toContain('{{asset::name}}')\n    expect(prompt).toContain('- smiling')\n\n    const request = stub.state.inferenceRequests.at(-1)\n    const structured = request?.messages.map((message) => message.content).join('\\n') ?? ''\n    expect(structured).toContain('{{asset::name}}')\n    expect(structured).toContain('- smiling')\n    expect(structured).toContain('Aria can show an image')\n  })`,
  'E2E structured request assertion'
)

const pkgPath = 'package.json'
const pkg = JSON.parse(read(pkgPath))
pkg.version = '1.0.36'
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log('Asset instructions now reach both flat prompts and structured messages.')
