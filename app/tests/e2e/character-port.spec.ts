import { readFile } from 'node:fs/promises'
import { expect, test, waitForLibrary } from './fixtures'
import { BASE_PNG } from './stub-server'

// These packages are CommonJS and have no ESM default export; Playwright runs this file as
// CJS, so `require` is both available and the correct interop here.
const extractPng = require('png-chunks-extract')
const encodePng = require('png-chunks-encode')
const pngText = require('png-chunk-text')

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

/** Builds a Tavern-style card: base64 JSON in a `chara` tEXt chunk. */
function makeCardPng(card: unknown) {
  const chunks = extractPng(new Uint8Array(BASE_PNG)).filter((c: any) => c.name !== 'tEXt')
  const encoded = Buffer.from(JSON.stringify(card), 'utf8').toString('base64')
  const last = chunks.length - 1
  return Buffer.from(
    encodePng([...chunks.slice(0, last), pngText.encode('chara', encoded), chunks[last]])
  )
}

function readCardPng(buffer: Buffer) {
  const chunks = extractPng(new Uint8Array(buffer))
  const entry = chunks
    .filter((c: any) => c.name === 'tEXt')
    .map((c: any) => pngText.decode(c.data))[0]
  if (!entry) throw new Error('no tEXt chunk')
  return JSON.parse(Buffer.from(entry.text, 'base64').toString('utf8'))
}

const V2_CARD = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  name: 'Imported Hero',
  data: {
    name: 'Imported Hero',
    description: 'A brave sort.',
    personality: 'Bold and loud.',
    scenario: 'Standing at a crossroads.',
    first_mes: 'Well met, {{user}}!',
    mes_example: 'You: hi\nImported Hero: Hail!',
    creator_notes: 'From a test fixture.',
    system_prompt: 'Stay in character.',
    post_history_instructions: 'Keep replies short.',
    alternate_greetings: ['Another greeting.', 'A third one.'],
    tags: ['test', 'hero'],
    creator: 'fixture-author',
    character_version: '1.2',
    character_book: { entries: [{ keys: ['x'], content: 'y' }] },
  },
}

test.describe('import', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('/')
    await waitForLibrary(app)
  })

  test('a PNG card fills the editor and reports what it could not carry', async ({ app }) => {
    await app.setInputFiles('input[type=file]', {
      name: 'hero.png',
      mimeType: 'image/png',
      buffer: makeCardPng(V2_CARD),
    })

    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Imported Hero')
    await expect(app).toHaveURL(/\/character\/new$/)
    // Tag chips render the bare tag; each carries a labelled remove button.
    await expect(app.locator('button[aria-label="Remove test"]')).toBeVisible()
    await expect(app.locator('button[aria-label="Remove hero"]')).toBeVisible()
    await expect(app.locator('button[aria-label="Remove greeting"]')).toHaveCount(2)
    await expect(app.getByRole('status')).toContainText('character book')
  })

  test('an unsaved import is protected by the navigation guard', async ({ app }) => {
    await app.setInputFiles('input[type=file]', {
      name: 'hero.png',
      mimeType: 'image/png',
      buffer: makeCardPng(V2_CARD),
    })
    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Imported Hero')

    app.once('dialog', (dialog) => dialog.dismiss())
    await app.click('a:has-text("Characters")')
    await expect(app).toHaveURL(/\/character\/new$/)
  })

  test('the same card as JSON fills the editor identically', async ({ app }) => {
    await app.setInputFiles('input[type=file]', {
      name: 'hero.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(V2_CARD), 'utf8'),
    })

    await expect(app.locator('input[placeholder="Character name"]')).toHaveValue('Imported Hero')
  })

  test('an unrecognised file reports an error and does not navigate', async ({ app }) => {
    await app.setInputFiles('input[type=file]', {
      name: 'junk.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"totally":"unrelated"}', 'utf8'),
    })

    await expect(app.getByRole('alert')).toBeVisible()
    await expect(app).toHaveURL(/\/$/)
  })
})

test.describe('export', () => {
  test.beforeEach(async ({ app }) => {
    await app.goto('/character/char-1')
    await app.waitForSelector('select[aria-label="Export character"]')
  })

  test('a PNG card round-trips back into a readable card', async ({ app }) => {
    const [download] = await Promise.all([
      app.waitForEvent('download'),
      app.selectOption('select[aria-label="Export character"]', 'card'),
    ])

    expect(download.suggestedFilename()).toBe('Aria.card.png')

    const bytes = await readFile((await download.path())!)
    expect(bytes.subarray(0, 8)).toEqual(PNG_SIGNATURE)

    const card = readCardPng(bytes)
    expect(card.spec).toBe('chara_card_v2')
    expect(card.data.name).toBe('Aria')
  })

  test('native JSON omits the server id', async ({ app }) => {
    const [download] = await Promise.all([
      app.waitForEvent('download'),
      app.selectOption('select[aria-label="Export character"]', 'native'),
    ])

    expect(download.suggestedFilename()).toBe('Aria.json')

    const json = JSON.parse(await readFile((await download.path())!, 'utf8'))
    expect(json.name).toBe('Aria')
    expect(json._id).toBeUndefined()
  })
})
