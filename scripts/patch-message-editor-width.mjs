import { readFileSync, writeFileSync } from 'node:fs'

const chatPath = 'app/src/routes/Chat.svelte'
let chat = readFileSync(chatPath, 'utf8')
const wrapper = `        <div
          class="min-w-0 max-w-[88%] sm:max-w-[75%]"
          style:max-width={alternating > 0 ? \`\${Math.max(40, 88 - alternating)}%\` : undefined}
        >`
const widened = `        <div
          class:w-full={editingId === message._id}
          class="min-w-0 max-w-[88%] sm:max-w-[75%]"
          style:max-width={alternating > 0 ? \`\${Math.max(40, 88 - alternating)}%\` : undefined}
        >`
if (!chat.includes(wrapper)) throw new Error('Could not locate message content wrapper')
chat = chat.replace(wrapper, widened)
writeFileSync(chatPath, chat)

const testPath = 'app/tests/e2e/messages.spec.ts'
let tests = readFileSync(testPath, 'utf8')
const anchor = `  test('Escape cancels and persists nothing', async ({ app, stub }) => {`
if (!tests.includes(anchor)) throw new Error('Could not locate message editor test anchor')
const widthTest = `  test('keeps the editor at the normal message width', async ({ app }) => {
    const editor = app.locator('textarea[aria-label="Edit message"]')
    const row = editor.locator('xpath=ancestor::li[1]')
    const editorBox = await editor.boundingBox()
    const rowBox = await row.boundingBox()

    expect(editorBox?.width).toBeGreaterThan((rowBox?.width ?? 0) * 0.65)
  })

`
tests = tests.replace(anchor, widthTest + anchor)
writeFileSync(testPath, tests)

const packagePath = 'package.json'
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'))
pkg.version = '1.0.31'
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n')
