import { test as base, expect, type Page } from '@playwright/test'
import { createStubServer, type StubState } from './stub-server'

/**
 * Each worker gets its own stub server on its own port, so specs can run in parallel while
 * still asserting directly on what the client sent.
 */
type WorkerFixtures = {
  stub: { origin: string; state: StubState }
}

type TestFixtures = {
  /** A signed-in page: the auth token is seeded before any script runs. */
  app: Page
  /** A signed-out page, for the auth screen. */
  anon: Page
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  stub: [
    async ({}, use, workerInfo) => {
      const server = await createStubServer(4180 + workerInfo.parallelIndex)
      await use(server)
      await server.close()
    },
    { scope: 'worker' },
  ],

  app: async ({ browser, stub }, use) => {
    stub.state.reset()
    const context = await browser.newContext({ baseURL: stub.origin })
    await context.addInitScript(() => localStorage.setItem('agnai-auth', 'stub-token'))
    const page = await context.newPage()
    attachErrorGuards(page)
    await use(page)
    await context.close()
  },

  anon: async ({ browser, stub }, use) => {
    stub.state.reset()
    const context = await browser.newContext({ baseURL: stub.origin })
    const page = await context.newPage()
    attachErrorGuards(page)
    await use(page)
    await context.close()
  },
})

export { expect }

/** Page errors collected per page, asserted by `expectNoPageErrors`. */
const pageErrors = new WeakMap<Page, string[]>()

function attachErrorGuards(page: Page) {
  const errors: string[] = []
  pageErrors.set(page, errors)

  page.on('pageerror', (error) => errors.push(`pageerror: ${error}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    // The stub does not proxy websockets on every reconnect, and "Failed to load resource"
    // is the generic echo of a 4xx that the stub records precisely on `state.failedResponses`.
    if (/websocket/i.test(text) || /Failed to load resource/i.test(text)) return
    errors.push(`console: ${text}`)
  })
}

export function expectNoPageErrors(page: Page) {
  expect(pageErrors.get(page) ?? []).toEqual([])
}

/** Waits for the character library to be interactive. */
export async function waitForLibrary(page: Page) {
  await page.waitForSelector('h2:text-is("Aria")')
}
