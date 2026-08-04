import { expect, test } from './fixtures'

const message = (
  id: string,
  msg: string,
  parent: string,
  user = false,
  index = Number(id.replace(/\D/g, ''))
) => ({
  _id: id,
  kind: 'chat-message',
  chatId: 'chat-1',
  ...(user ? { userId: 'user-1' } : { characterId: 'char-1' }),
  msg,
  parent,
  retries: [],
  createdAt: new Date(Date.now() + index).toISOString(),
  updatedAt: new Date(Date.now() + index).toISOString(),
})

test('middle deletion offers single, tail, and branch actions', async ({ app, stub }) => {
  stub.state.extraMessages = [
    message('msg-3', 'Branch point', 'msg-2'),
    message('msg-4', 'Later user turn', 'msg-3', true),
    message('msg-5', 'Later bot turn', 'msg-4'),
  ]

  await app.goto('/chat/chat-1')
  await app.getByTestId('delete-message-msg-3').click()

  const dialog = app.getByRole('dialog', { name: 'Change conversation from this message?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Delete this message only' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Delete from here' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Branch from here' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Delete from here' }).click()
  await expect.poll(() => stub.state.deletions.at(-1)?.body.ids).toEqual([
    'msg-3',
    'msg-4',
    'msg-5',
  ])
  await expect(app.getByText('Branch point')).toHaveCount(0)
  await expect(app.getByText('Later user turn')).toHaveCount(0)
})

test('message toolbar creates a new chat branch at that point', async ({ app, stub }) => {
  stub.state.extraMessages = [
    message('msg-3', 'Branch point', 'msg-2'),
    message('msg-4', 'Later user turn', 'msg-3', true),
  ]

  await app.goto('/chat/chat-1')
  await app.getByTestId('branch-message-msg-3').click()

  await expect(app).toHaveURL(/\/chat\/chat-branch-1$/)
  await expect.poll(() => stub.state.branches.at(-1)?.body.messageId).toBe('msg-3')
})

test('renders recent history by character budget and expands older text on demand', async ({
  app,
  stub,
}) => {
  const messages = []
  let parent = 'msg-2'
  for (let index = 3; index <= 16; index++) {
    const marker = index === 3 ? 'oldest-window-marker ' : `window-message-${index} `
    const next = message(`msg-${index}`, marker + 'x'.repeat(3_000), parent, index % 2 === 0)
    messages.push(next)
    parent = next._id
  }
  stub.state.extraMessages = messages

  await app.goto('/chat/chat-1')
  await expect(app.getByText(/oldest-window-marker/)).toHaveCount(0)

  const loadEarlier = app.getByTestId('load-earlier-messages')
  await expect(loadEarlier).toBeVisible()
  await loadEarlier.click()

  await expect(app.getByText(/oldest-window-marker/)).toBeVisible()
})
