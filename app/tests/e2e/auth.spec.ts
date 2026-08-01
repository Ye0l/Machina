import { expect, test, waitForLibrary } from './fixtures'

test.describe('registration', () => {
  test('a signed-out visitor can register and lands signed in', async ({ anon, stub }) => {
    await anon.goto('/')
    await anon.getByRole('tab', { name: 'Register' }).click()
    await anon.waitForSelector('input[autocomplete="nickname"]')

    await anon.fill('input[autocomplete="nickname"]', 'New Person')
    await anon.fill('input[autocomplete="username"]', 'newbie')
    await anon.fill('input[autocomplete="new-password"]', 'hunter2hunter2')
    await anon.locator('input[type=password]').nth(1).fill('hunter2hunter2')
    await anon.click('button[type=submit]')

    await waitForLibrary(anon)
    expect(stub.state.registrations).toEqual([
      { handle: 'New Person', username: 'newbie', password: 'hunter2hunter2' },
    ])
  })

  test('a mismatched confirmation is rejected before any request', async ({ anon, stub }) => {
    await anon.goto('/')
    await anon.getByRole('tab', { name: 'Register' }).click()
    await anon.waitForSelector('input[autocomplete="nickname"]')

    await anon.fill('input[autocomplete="nickname"]', 'New Person')
    await anon.fill('input[autocomplete="username"]', 'newbie')
    await anon.fill('input[autocomplete="new-password"]', 'hunter2hunter2')
    await anon.locator('input[type=password]').nth(1).fill('different')
    await anon.click('button[type=submit]')

    await expect(anon.getByRole('alert')).toBeVisible()
    expect(stub.state.registrations).toEqual([])
  })

  test('a missing display name is rejected before any request', async ({ anon, stub }) => {
    await anon.goto('/')
    await anon.getByRole('tab', { name: 'Register' }).click()
    await anon.waitForSelector('input[autocomplete="nickname"]')

    await anon.fill('input[autocomplete="username"]', 'newbie')
    await anon.fill('input[autocomplete="new-password"]', 'hunter2hunter2')
    await anon.locator('input[type=password]').nth(1).fill('hunter2hunter2')
    await anon.click('button[type=submit]')

    await expect(anon.getByRole('alert')).toBeVisible()
    expect(stub.state.registrations).toEqual([])
  })

  test('Register is hidden when the deployment has no accounts', async ({ anon, stub }) => {
    // canAuth is false when the server has no database, so sign-up cannot work.
    stub.state.canAuth = false

    await anon.goto('/')
    await anon.waitForSelector('input[autocomplete="username"]')
    await expect(anon.getByRole('tab', { name: 'Register' })).toHaveCount(0)
  })
})
