import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'

/**
 * A stand-in for `srv/`, so the browser tests can drive the real production bundle without
 * MongoDB or a model provider.
 *
 * It mirrors the two things about `srv/app.ts` the client depends on: `/api` is served, and
 * every other path falls back to `dist/index.html` so deep links resolve. It also accepts a
 * WebSocket, because generation results reach the client over the socket rather than the
 * HTTP response (`srv/api/chat/inference.ts`).
 *
 * Requests and bodies are recorded on `state` so tests can assert on what the client sent,
 * including the assembled prompt -- which is the only way to check that memory books reach
 * the model.
 */

// `__dirname`, not `import.meta`: the repository is CommonJS, so Playwright transpiles this
// module to CJS before running it.
const DIST = resolve(__dirname, '../../../dist')

/** Smallest valid PNG: 1x1, opaque. Used as an avatar asset and as a card base. */
export const BASE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const now = new Date().toISOString()

const user = {
  _id: 'user-1',
  kind: 'user',
  username: 'tester',
  hash: '',
  admin: false,
  novelApiKey: '',
  novelModel: '',
  novelVerified: false,
  useLocalPipeline: false,
  oobaUrl: '',
  hordeModel: 'any',
  hordeKey: '',
  hordeName: '',
  defaultAdapter: 'agnaistic',
  koboldUrl: '',
  thirdPartyFormat: 'kobold',
  thirdPartyPassword: '',
  oaiKey: '',
  scaleApiKey: '',
  claudeApiKey: '',
  createdAt: now,
  updatedAt: now,
  providers: [],
  defaultPreset: '',
  ui: {},
}

const profile = { _id: 'profile-1', userId: 'user-1', kind: 'profile', handle: 'Tester' }

/** Generic in `extra` so the caller's added fields stay on the returned type. */
const character = <T extends object>(id: string, name: string, avatar: string, extra: T) => ({
  _id: id,
  kind: 'character',
  userId: 'user-1',
  name,
  avatar,
  favorite: false,
  folder: '',
  scenario: '',
  sampleChat: '',
  systemPrompt: '',
  postHistoryInstructions: '',
  alternateGreetings: [],
  createdAt: now,
  updatedAt: now,
  assets: [] as Array<{ name: string; uri: string; folder?: string }>,
  ...extra,
})

/**
 * One message exercising markdown rendering and the sanitiser: emphasis, bold, inline code,
 * a quoted span with emphasis inside, a list -- plus two XSS attempts that must neither
 * execute nor survive into the DOM.
 */
export const MARKDOWN_SAMPLE = [
  'Some **bold** and *italic* and `inline code`.',
  '',
  '"A quoted line with *emphasis* inside." he said.',
  '',
  '- first item',
  '- second item',
  '',
  '<img src=x onerror="window.__xss = 1">',
  '<script>window.__xss = 1</script>',
  '[link](https://example.com)',
].join('\n')

export type StubState = {
  canAuth: boolean
  memoryBooks: any[]
  registrations: any[]
  edits: Array<{ id: string; message: string }>
  chatUpdates: Array<{ id: string; body: any }>
  /** Prompts the client assembled and posted to /chat/inference-stream. */
  prompts: string[]
  inferenceRequests: any[]
  swaps: Array<{ id: string; body: any }>
  inferenceDelayMs: number
  inferenceResponse: string
  apiCalls: string[]
  /** Non-2xx responses served, so tests can assert none were unexpected. */
  failedResponses: string[]
  chatMemory: Record<string, string | undefined>
  /** Generation preset selected by the fixture chat. */
  chatPreset: string
  extraMessages: any[]
  /** Chats invented per-test, e.g. to exercise the list's incremental rendering. */
  extraChats: any[]
  /** Bodies sent to POST /character/:id/update. */
  characterUpdates: Array<{ id: string; body: any }>
  /** Bodies sent to POST /chat/:id/send. */
  sends: any[]
  /** Serves only the chat's own character, i.e. a library with nobody to speak as. */
  soloCharacter: boolean
  /** User personas, served by GET /persona. */
  personas: any[]
  /**
   * Providers and presets served by /user/init. Empty by default: a preset would be passed
   * into prompt assembly, changing the prompts other specs assert on.
   */
  providers: any[]
  presets: any[]
  /** Bodies sent to POST /user/presets/:id. */
  presetUpdates: Array<{ id: string; body: any }>
  /** Saved prompt templates, served by GET /user/templates. */
  promptTemplates: any[]
  /** Writes to /user/templates, in order. */
  templateCalls: Array<{ method: string; path: string; body: any }>
  reset(): void
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.map': 'application/json',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}

export async function createStubServer(port: number) {
  const state: StubState = {
    canAuth: true,
    memoryBooks: [],
    registrations: [],
    edits: [],
    chatUpdates: [],
    prompts: [],
    inferenceRequests: [],
    swaps: [],
    inferenceDelayMs: 30,
    inferenceResponse: 'Stub reply.',
    apiCalls: [],
    failedResponses: [],
    chatMemory: {},
    chatPreset: '',
    extraMessages: [],
    extraChats: [],
    characterUpdates: [],
    sends: [],
    soloCharacter: false,
    personas: [],
    providers: [],
    presets: [],
    presetUpdates: [],
    promptTemplates: [],
    templateCalls: [],
    reset() {
      this.canAuth = true
      this.memoryBooks = []
      this.registrations = []
      this.edits = []
      this.chatUpdates = []
      this.prompts = []
      this.inferenceRequests = []
      this.swaps = []
      this.inferenceDelayMs = 30
      this.inferenceResponse = 'Stub reply.'
      this.apiCalls = []
      this.failedResponses = []
      this.chatMemory = {}
      this.chatPreset = ''
      this.extraMessages = []
      this.extraChats = []
      this.characterUpdates = []
      this.sends = []
      this.soloCharacter = false
      this.personas = []
      this.providers = []
      this.presets = []
      this.presetUpdates = []
      this.promptTemplates = []
      this.templateCalls = []
      // Rebuilt rather than trimmed: the update route `Object.assign`s onto a character, so
      // a test that renames one would otherwise leave it renamed for every test after it.
      characters.length = 0
      characters.push(...baseCharacters())
    },
  }

  /** Fresh copies, so `reset` can undo whatever a test did to them. */
  const baseCharacters = () => [
    character('char-1', 'Aria', '/assets/aria.png', {
      description: 'A test character',
      tags: ['test'],
      persona: { kind: 'text', attributes: { text: ['calm'] } },
      greeting: 'Hello there.',
    }),
    character('char-2', 'Borin', '', {
      description: 'Second character',
      tags: [],
      persona: { kind: 'text', attributes: { text: ['gruff'] } },
      greeting: 'Hm.',
    }),
  ]

  const characters = baseCharacters()

  const chatList = [
    {
      _id: 'chat-1',
      name: 'Aria conversation',
      characterId: 'char-1',
      updatedAt: now,
      genPreset: '',
    },
    { _id: 'chat-2', name: 'Borin talk', characterId: 'char-2', updatedAt: now, genPreset: '' },
  ]

  const chatDetail = (id: string) => {
    const summary = chatList.find((c) => c._id === id)
    if (!summary) return null
    const char = characters.find((c) => c._id === summary.characterId)!

    return {
      chat: {
        _id: id,
        kind: 'chat',
        userId: 'user-1',
        memoryId: state.chatMemory[id],
        characterId: summary.characterId,
        name: summary.name,
        greeting: char.greeting,
        scenario: '',
        sampleChat: '',
        overrides: char.persona,
        createdAt: now,
        updatedAt: now,
        memberIds: [],
        messageCount: 1,
        treeLeafId: 'msg-1',
        genPreset: state.chatPreset,
      },
      messages: [
        {
          _id: 'msg-1',
          kind: 'chat-message',
          chatId: id,
          characterId: summary.characterId,
          msg: `Greetings from ${char.name}.`,
          retries: [],
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'msg-2',
          kind: 'chat-message',
          chatId: id,
          userId: 'user-1',
          msg: MARKDOWN_SAMPLE,
          retries: [],
          createdAt: now,
          updatedAt: now,
        },
        ...state.extraMessages.filter((m) => m.chatId === id),
      ],
      character: char,
      characters: [char],
      members: [profile],
    }
  }

  let liveSocket: WebSocket | null = null

  const readBody = (req: http.IncomingMessage) =>
    new Promise<any>((done) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => done(JSON.parse(raw || '{}')))
    })

  const server = http.createServer(async (req, res) => {
    const path = new URL(req.url!, `http://127.0.0.1:${port}`).pathname

    const json = (body: unknown, status = 200) => {
      if (status >= 400) state.failedResponses.push(`${status} ${path}`)
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (path.startsWith('/api')) {
      state.apiCalls.push(`${req.method} ${path}`)

      if (path === '/api/settings')
        return json({ canAuth: state.canAuth, adapters: [], version: '' })

      if (path === '/api/user/register' && req.method === 'POST') {
        state.registrations.push(await readBody(req))
        return json({ token: 'stub-token', user, profile })
      }

      if (path === '/api/user/init') {
        if (!req.headers.authorization) return json({ message: 'Unauthorized' }, 401)
        return json({
          user: { ...user, providers: state.providers },
          profile,
          presets: state.presets,
        })
      }

      if (path === '/api/persona' && req.method === 'GET') {
        return json({ personas: state.personas })
      }

      if (path === '/api/persona' && req.method === 'POST') {
        const body = await readBody(req)
        const created = {
          kind: 'persona',
          _id: `persona-${state.personas.length + 1}`,
          userId: 'user-1',
          createdAt: now,
          updatedAt: now,
          ...body,
        }
        state.personas.push(created)
        return json(created)
      }

      const personaWrite = path.match(/^\/api\/persona\/([^/]+)$/)
      if (personaWrite && req.method === 'POST') {
        const body = await readBody(req)
        const target = state.personas.find((p) => p._id === personaWrite[1])
        if (!target) return json({ message: 'Not found' }, 404)
        Object.assign(target, body)
        return json(target)
      }
      if (personaWrite && req.method === 'DELETE') {
        state.personas = state.personas.filter((p) => p._id !== personaWrite[1])
        return json({ success: true })
      }

      if (path === '/api/user/templates' && req.method === 'GET') {
        return json({ templates: state.promptTemplates })
      }

      if (path === '/api/user/templates' && req.method === 'POST') {
        const body = await readBody(req)
        state.templateCalls.push({ method: 'POST', path, body })
        const created = {
          kind: 'prompt-template',
          _id: `tpl-${state.promptTemplates.length + 1}`,
          userId: 'user-1',
          createdAt: now,
          updatedAt: now,
          ...body,
        }
        state.promptTemplates.push(created)
        return json(created)
      }

      const templateWrite = path.match(/^\/api\/user\/templates\/([^/]+)$/)
      if (templateWrite && req.method === 'POST') {
        const body = await readBody(req)
        state.templateCalls.push({ method: 'POST', path, body })
        const target = state.promptTemplates.find((t) => t._id === templateWrite[1])
        if (!target) return json({ message: 'Not found' }, 404)
        Object.assign(target, body)
        return json(target)
      }
      if (templateWrite && req.method === 'DELETE') {
        state.templateCalls.push({ method: 'DELETE', path, body: undefined })
        state.promptTemplates = state.promptTemplates.filter((t) => t._id !== templateWrite[1])
        return json({ success: true })
      }

      const presetUpdate = path.match(/^\/api\/user\/presets\/([^/]+)$/)
      if (presetUpdate && req.method === 'POST') {
        const body = await readBody(req)
        state.presetUpdates.push({ id: presetUpdate[1], body })
        const target = state.presets.find((p) => p._id === presetUpdate[1])
        if (!target) return json({ message: 'Not found' }, 404)
        Object.assign(target, body)
        return json(target)
      }

      if (path === '/api/character' && req.method === 'POST') {
        const body = await readBody(req)
        const created = character(`char-${characters.length + 1}`, body.name, '', {
          ...body,
          // The create endpoint takes the persona as a JSON string; the record holds an object.
          persona: typeof body.persona === 'string' ? JSON.parse(body.persona) : body.persona,
        })
        characters.push(created)
        return json(created)
      }

      if (path === '/api/character') {
        return json({ characters: state.soloCharacter ? characters.slice(0, 1) : characters })
      }

      // Per-character chat list, which the character workspace renders incrementally.
      const charChats = path.match(/^\/api\/chat\/([^/]+)\/chats$/)
      if (charChats && req.method === 'GET') {
        const owner = characters.find((c) => c._id === charChats[1])
        if (!owner) return json({ message: 'Not found' }, 404)
        return json({
          character: owner,
          chats: [
            ...chatList.filter((c) => c.characterId === owner._id),
            ...state.extraChats.filter((c) => c.characterId === owner._id),
          ],
        })
      }
      if (path === '/api/chat' && req.method === 'GET') return json({ chats: chatList })

      const assetAdd = path.match(/^\/api\/character\/([^/]+)\/assets$/)
      if (assetAdd && req.method === 'POST') {
        const body = await readBody(req)
        const target = characters.find((c) => c._id === assetAdd[1])
        if (!target) return json({ message: 'Not found' }, 404)
        const name = String(body.name).trim()
        const folder = String(body.folder ?? '')
        target.assets = target.assets
          .filter((asset) => asset.name.toLowerCase() !== name.toLowerCase())
          .concat({ name, uri: `${name}.png`, ...(folder ? { folder } : {}) })
        return json(target)
      }

      const assetWrite = path.match(/^\/api\/character\/([^/]+)\/assets\/([^/]+)$/)
      if (assetWrite && req.method === 'PUT') {
        const body = await readBody(req)
        const target = characters.find((character) => character._id === assetWrite[1])
        if (!target) return json({ message: 'Not found' }, 404)
        const name = decodeURIComponent(assetWrite[2]).toLowerCase()
        const folder = String(body.folder ?? '')
        target.assets = target.assets.map((asset) =>
          asset.name.toLowerCase() === name ? { ...asset, folder: folder || undefined } : asset
        )
        return json(target)
      }
      if (assetWrite && req.method === 'DELETE') {
        const target = characters.find((character) => character._id === assetWrite[1])
        if (!target) return json({ message: 'Not found' }, 404)
        const name = decodeURIComponent(assetWrite[2]).toLowerCase()
        target.assets = target.assets.filter((asset) => asset.name.toLowerCase() !== name)
        return json(target)
      }

      const charUpdate = path.match(/^\/api\/character\/([^/]+)\/update$/)
      if (charUpdate && req.method === 'POST') {
        const body = await readBody(req)
        state.characterUpdates.push({ id: charUpdate[1], body })
        const target = characters.find((c) => c._id === charUpdate[1])
        if (!target) return json({ message: 'Not found' }, 404)
        Object.assign(target, body)
        return json(target)
      }

      const charMatch = path.match(/^\/api\/character\/([^/]+)$/)
      if (charMatch) {
        const found = characters.find((c) => c._id === charMatch[1])
        if (!found) return json({ message: 'Not found' }, 404)
        return json(found)
      }

      const chatMatch = path.match(/^\/api\/chat\/([^/]+)$/)
      if (chatMatch && req.method === 'GET') {
        const detail = chatDetail(chatMatch[1])
        return detail ? json(detail) : json({ message: 'Chat not found' }, 404)
      }
      if (chatMatch && req.method === 'PUT') {
        const body = await readBody(req)
        state.chatUpdates.push({ id: chatMatch[1], body })
        state.chatMemory[chatMatch[1]] = body.memoryId || undefined
        return json({ success: true })
      }

      const swapMatch = path.match(/^\/api\/chat\/([^/]+)\/message-swap$/)
      if (swapMatch && req.method === 'PUT') {
        const body = await readBody(req)
        state.swaps.push({ id: swapMatch[1], body })
        const target = state.extraMessages.find((message) => message._id === swapMatch[1])
        if (target) Object.assign(target, body)
        return json(target ?? { _id: swapMatch[1], ...body })
      }

      const editMatch = path.match(/^\/api\/chat\/([^/]+)\/message$/)
      if (editMatch && req.method === 'PUT') {
        const body = await readBody(req)
        state.edits.push({ id: editMatch[1], message: body.message })
        return json({ _id: editMatch[1], msg: body.message })
      }

      if (path === '/api/memory' && req.method === 'GET') return json({ books: state.memoryBooks })
      if (path === '/api/memory' && req.method === 'POST') {
        const body = await readBody(req)
        const book = {
          _id: `book-${state.memoryBooks.length + 1}`,
          kind: 'memory',
          userId: 'user-1',
          ...body,
        }
        state.memoryBooks = [book, ...state.memoryBooks]
        return json(book)
      }

      const bookMatch = path.match(/^\/api\/memory\/([^/]+)$/)
      if (bookMatch && req.method === 'PUT') {
        const body = await readBody(req)
        state.memoryBooks = state.memoryBooks.map((b) =>
          b._id === bookMatch[1] ? { ...b, ...body } : b
        )
        return json({ success: true })
      }
      if (bookMatch && req.method === 'DELETE') {
        state.memoryBooks = state.memoryBooks.filter((b) => b._id !== bookMatch[1])
        return json({ success: true })
      }

      const sendMatch = path.match(/^\/api\/chat\/([^/]+)\/send$/)
      if (sendMatch && req.method === 'POST') {
        const body = await readBody(req)
        const message: any = {
          _id: body.messageId ?? `msg-${Date.now()}`,
          kind: 'chat-message',
          chatId: sendMatch[1],
          msg: body.text,
          retries: [],
          createdAt: now,
          updatedAt: now,
          parent: body.parent,
          meta: body.meta,
          ...(body.bot ? { characterId: 'char-1' } : { userId: 'user-1' }),
        }
        // The server stamps an impersonated user message with the persona's id and name
        // (srv/api/chat/message.ts:135,140), which is what the client must render as its own.
        if (body.impersonate && !body.bot) {
          message.characterId = body.impersonate._id
          message.name = body.impersonate.name
        }
        state.sends.push(body)
        state.extraMessages.push(message)
        return json({ success: true, message })
      }

      if (path === '/api/chat/inference-stream' && req.method === 'POST') {
        const body = await readBody(req)
        state.prompts.push(body.prompt ?? '')
        state.inferenceRequests.push(body)
        // The client resolves on the socket event, not this response.
        setTimeout(() => {
          liveSocket?.send(
            JSON.stringify({
              type: 'inference',
              requestId: body.requestId,
              response: state.inferenceResponse,
            })
          )
        }, state.inferenceDelayMs)
        return json({ success: true })
      }

      return json({ message: 'stub' })
    }

    // An avatar asset, so the PNG card export has a real image to embed into.
    if (path === '/assets/aria.png') {
      res.writeHead(200, { 'Content-Type': 'image/png' })
      return res.end(BASE_PNG)
    }

    const filePath = join(DIST, path)
    if (path !== '/' && existsSync(filePath) && statSync(filePath).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
      return res.end(await readFile(filePath))
    }

    // SPA fallback, the same shape as srv/app.ts.
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(await readFile(join(DIST, 'index.html')))
  })

  const wss = new WebSocketServer({ server })
  wss.on('connection', (socket) => {
    liveSocket = socket
    socket.send(JSON.stringify({ type: 'connected', uid: 'sock-1' }))
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.type === 'login') socket.send(JSON.stringify({ type: 'login', success: true }))
      } catch {
        // Not a frame we care about.
      }
    })
  })

  await new Promise<void>((done) => server.listen(port, done))

  return {
    origin: `http://127.0.0.1:${port}`,
    state,
    close: () =>
      new Promise<void>((done) => {
        wss.close()
        server.close(() => done())
      }),
  }
}
