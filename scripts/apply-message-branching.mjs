import { readFileSync, writeFileSync } from 'node:fs'

const read = (path) => readFileSync(path, 'utf8')
const write = (path, content) => writeFileSync(path, content)

function replaceOnce(path, before, after, label) {
  const source = read(path)
  if (source.includes(after)) return
  if (!source.includes(before)) throw new Error(`${path}: missing ${label}`)
  write(path, source.replace(before, after))
}

function insertBefore(path, marker, content, label) {
  const source = read(path)
  if (source.includes(content.trim())) return
  if (!source.includes(marker)) throw new Error(`${path}: missing ${label}`)
  write(path, source.replace(marker, `${content}${marker}`))
}

// -------------------------------------------------------------------------- server cloning
insertBefore(
  'srv/db/messages.ts',
  '/**\n *\n * @param chatId',
  `/** Clones one resolved conversation path into a new chat with fresh ids and parents. */
export async function cloneMessagesToChat(messages: AppSchema.ChatMessage[], chatId: string) {
  const idMap = new Map(messages.map((message) => [message._id, v4()]))
  const startedAt = Date.now()
  const cloned: AppSchema.ChatMessage[] = messages.map((message, index) => {
    const timestamp = new Date(startedAt + index).toISOString()
    const copy: AppSchema.ChatMessage = {
      ...message,
      _id: idMap.get(message._id)!,
      chatId,
      parent: message.parent ? idMap.get(message.parent) : undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    delete copy.first
    delete copy.reasoning
    delete copy.deleted
    return copy
  })

  if (cloned.length) await db('chat-message').insertMany(cloned)
  return { messages: cloned, idMap }
}

`,
  'recent messages comment'
)

replaceOnce(
  'srv/api/chat/create.ts',
  "import { handle, StatusError } from '../wrap'",
  "import { errors, handle, StatusError } from '../wrap'",
  'create errors import'
)

insertBefore(
  'srv/api/chat/create.ts',
  'export const importChat = handle',
  `export const branchChat = handle(async ({ body, params, userId }) => {
  assertValid({ messageId: 'string', name: 'string?' }, body)

  const source = await store.chats.getChatOnly(params.id)
  if (!source) throw errors.NotFound
  if (source.userId !== userId) throw errors.Forbidden

  const allMessages = await store.msgs.getChatMessages(source)
  const byId = new Map(allMessages.map((message) => [message._id, message]))
  let current = byId.get(body.messageId)
  if (!current) throw new StatusError('Branch point was not found in this chat', 404)

  const path = [] as typeof allMessages
  const seen = new Set<string>()
  while (current && !seen.has(current._id)) {
    seen.add(current._id)
    path.unshift(current)
    current = current.parent ? byId.get(current.parent) : undefined
  }

  const profile = await store.users.getProfile(userId)
  if (!profile) throw errors.NotFound

  const created = await store.chats.create(
    source.characterId,
    {
      name: body.name?.trim() || source.name + ' · branch',
      greeting: undefined,
      scenario: source.scenario,
      scenarioIds: source.scenarioIds || [],
      sampleChat: source.sampleChat,
      userId,
      overrides: source.overrides,
      genPreset: source.genPreset,
      mode: source.mode,
      imageSource: source.imageSource,
      treeLeafId: undefined,
    },
    profile
  )

  const cloned = await store.msgs.cloneMessagesToChat(path, created._id)
  const summaryUpTo = source.summaryUpTo ? cloned.idMap.get(source.summaryUpTo) : undefined
  const copied: Record<string, unknown> = {
    treeLeafId: cloned.messages.at(-1)?._id || '',
    messageCount: cloned.messages.length,
    greeting: source.greeting,
    memoryId: source.memoryId,
    userEmbedId: source.userEmbedId,
    characters: source.characters,
    tempCharacters: source.tempCharacters,
    systemPrompt: source.systemPrompt,
    postHistoryInstructions: source.postHistoryInstructions,
    genSettings: source.genSettings,
    imageSettings: source.imageSettings,
    imageProviderId: source.imageProviderId,
    background: source.background,
    localSettings: source.localSettings,
  }

  if (summaryUpTo) {
    copied.summaries = source.summaries
    copied.summary = source.summary
    copied.summaryUpTo = summaryUpTo
    copied.summaryCount = Math.min(source.summaryCount || 0, cloned.messages.length)
    copied.summaryUpdatedAt = source.summaryUpdatedAt
  }

  const update = Object.fromEntries(Object.entries(copied).filter(([, value]) => value !== undefined))
  const chat = await store.chats.update(created._id, update)
  return { chat, messages: cloned.messages }
})

`,
  'importChat declaration'
)

replaceOnce(
  'srv/api/chat/index.ts',
  "import { createChat, importChat } from './create'",
  "import { branchChat, createChat, importChat } from './create'",
  'branch route import'
)
replaceOnce(
  'srv/api/chat/index.ts',
  "router.post('/:id/restart', restartChat)",
  "router.post('/:id/restart', restartChat)\nrouter.post('/:id/branch', branchChat)",
  'branch route registration'
)

// -------------------------------------------------------------------------- client contracts/state
insertBefore(
  'app/src/lib/contracts.ts',
  'export type DeleteChatResponse',
  `export type BranchChatResponse = {
  chat: AppSchema.Chat
  messages: AppSchema.ChatMessage[]
}

`,
  'delete chat response'
)
replaceOnce(
  'app/src/lib/chats.svelte.ts',
  '  ChatDetailResponse,\n  ChatSummary,',
  '  BranchChatResponse,\n  ChatDetailResponse,\n  ChatSummary,',
  'branch response import'
)

insertBefore(
  'app/src/lib/chats.svelte.ts',
  '  /**\n   * Deletes a message and relinks survivors',
  `  /** Creates a separate chat containing the path from the root through ` + '`messageId`' + `. */
  async branchFrom(messageId: string) {
    const detail = this.detail
    if (!detail || this.generating) return
    this.error = ''
    try {
      const result = await api.post<BranchChatResponse>(` + "`/chat/${detail.chat._id}/branch`" + `, {
        messageId,
      })
      this.chats = [result.chat, ...this.chats.filter((chat) => chat._id !== result.chat._id)]
      return result.chat._id
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to branch chat'
    }
  }

`,
  'delete message comment'
)

const oldDelete = `  /**
   * Deletes a message and relinks survivors (` + '`DELETE /chat/:chatId/messages-v2`' + `). ` + '`:id`' + ` =
   * CHAT id. The server returns the re-parented survivors + new leaf; applied locally
   * rather than re-fetching the whole chat.
   */
  async deleteMessage(messageId: string) {
    const detail = this.detail
    if (!detail) return
    const leafId = detail.chat.treeLeafId ?? this.messages.at(-1)?._id ?? ''
    this.error = ''
    try {
      const res = await api.del<DeleteMessagesResponse>(` + "`/chat/${detail.chat._id}/messages-v2`" + `, {
        ids: [messageId],
        leafId,
      })
      const links = new Map(res.messages.map((m) => [m._id, m.parent]))
      this.messages = this.messages
        .filter((m) => m._id !== messageId)
        .map((m) => (links.has(m._id) ? { ...m, parent: links.get(m._id) } : m))
      if (res.chat.treeLeafId !== undefined) {
        this.detail = { ...detail, chat: { ...detail.chat, treeLeafId: res.chat.treeLeafId } }
      }
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete message'
    }
  }
`

const newDelete = `  /** Deletes one message or the selected message and every later visible turn. */
  async deleteMessage(messageId: string, scope: 'single' | 'tail' = 'single') {
    const detail = this.detail
    if (!detail) return false
    const index = this.messages.findIndex((message) => message._id === messageId)
    if (index === -1) return false

    const ids =
      scope === 'tail' ? this.messages.slice(index).map((message) => message._id) : [messageId]
    const deleted = new Set(ids)
    const leafId = detail.chat.treeLeafId ?? this.messages.at(-1)?._id ?? ''
    this.error = ''
    try {
      const res = await api.del<DeleteMessagesResponse>(` + "`/chat/${detail.chat._id}/messages-v2`" + `, {
        ids,
        leafId,
      })
      const links = new Map(res.messages.map((message) => [message._id, message.parent]))
      const remaining = this.messages
        .filter((message) => !deleted.has(message._id))
        .map((message) =>
          links.has(message._id) ? { ...message, parent: links.get(message._id) } : message
        )
      this.setMessages(remaining)

      const positions = { ...this.variantPositions }
      const requests = { ...this.generationRequests }
      for (const id of ids) {
        delete positions[id]
        delete requests[id]
      }
      this.variantPositions = positions
      this.generationRequests = requests

      if (this.detail) {
        this.detail = {
          ...this.detail,
          chat: {
            ...this.detail.chat,
            treeLeafId: res.chat.treeLeafId ?? remaining.at(-1)?._id ?? '',
          },
        }
      }
      return true
    } catch (ex) {
      this.error = ex instanceof Error ? ex.message : 'Failed to delete message'
      return false
    }
  }
`
replaceOnce('app/src/lib/chats.svelte.ts', oldDelete, newDelete, 'delete message method')

// -------------------------------------------------------------------------- chat view
replaceOnce(
  'app/src/routes/Chat.svelte',
  '    ChevronRight,\n    Pencil,',
  '    ChevronRight,\n    GitBranch,\n    Pencil,',
  'branch icon import'
)
replaceOnce(
  'app/src/routes/Chat.svelte',
  "  import { FONT_FACES } from '/common/types/ui'",
  "  import { FONT_FACES } from '/common/types/ui'\n  import { expandMessageWindow, findMessageWindowStart } from '/common/message-window'",
  'message window import'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `  let generationDebug = $state<{
    summary: GenerationSummary
    request?: GenerationRequestDebug
  } | null>(null)
`,
  `  let generationDebug = $state<{
    summary: GenerationSummary
    request?: GenerationRequestDebug
  } | null>(null)
  let messageAction = $state<{ messageId: string; author: string } | null>(null)
  let messageActionBusy = $state(false)
  let visibleStart = $state(0)
  let historyChatId = $state('')
  let loadingEarlier = $state(false)
  const visibleMessages = $derived(chats.messages.slice(visibleStart))
`,
  'chat state additions'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `  const trackScrollPosition = () => {
    if (messageList) wasAtBottom = isScrollAtBottom(messageList)
  }
`,
  `  const loadEarlierMessages = async () => {
    if (!messageList || loadingEarlier || visibleStart <= 0) return
    const nextStart = expandMessageWindow(chats.messages, visibleStart)
    if (nextStart === visibleStart) return

    const previousHeight = messageList.scrollHeight
    loadingEarlier = true
    visibleStart = nextStart
    await tick()
    messageList.scrollTop += messageList.scrollHeight - previousHeight
    loadingEarlier = false
  }

  const trackScrollPosition = () => {
    if (!messageList) return
    wasAtBottom = isScrollAtBottom(messageList)
    if (messageList.scrollTop < 280) void loadEarlierMessages()
  }

  $effect(() => {
    const chatId = detail.chat._id
    const count = chats.messages.length
    if (historyChatId !== chatId) {
      historyChatId = chatId
      visibleStart = findMessageWindowStart(chats.messages)
      return
    }
    if (visibleStart > count) visibleStart = findMessageWindowStart(chats.messages)
  })
`,
  'dynamic history functions'
)

insertBefore(
  'app/src/routes/Chat.svelte',
  '  const deleteOpenChat = async () => {',
  `  const branchFromMessage = async (messageId: string) => {
    if (messageActionBusy || chats.generating) return
    messageActionBusy = true
    try {
      const chatId = await chats.branchFrom(messageId)
      if (chatId) {
        messageAction = null
        router.go(routes.chat(chatId))
      }
    } finally {
      messageActionBusy = false
    }
  }

  const requestMessageDelete = (message: AppSchema.ChatMessage) => {
    const index = chats.messages.findIndex((item) => item._id === message._id)
    if (index === -1) return
    if (index === chats.messages.length - 1) {
      void chats.deleteMessage(message._id)
      return
    }
    messageAction = { messageId: message._id, author: authorOf(message) }
  }

  const deleteSelectedMessage = async (scope: 'single' | 'tail') => {
    if (!messageAction || messageActionBusy) return
    messageActionBusy = true
    try {
      if (await chats.deleteMessage(messageAction.messageId, scope)) messageAction = null
    } finally {
      messageActionBusy = false
    }
  }

`,
  'delete open chat function'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `    if (event.key !== 'Escape') return
    if (generationDebug) generationDebug = null
    else if (expandedAsset) expandedAsset = null`,
  `    if (event.key !== 'Escape') return
    if (messageAction) messageAction = null
    else if (generationDebug) generationDebug = null
    else if (expandedAsset) expandedAsset = null`,
  'escape modal order'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `  >
    {#each chats.messages as message (message._id)}`,
  `  >
    {#if visibleStart > 0}
      <li class="mx-auto flex w-full justify-center py-1 {widthClass}">
        <button
          class="button-secondary h-8 px-3 text-xs"
          type="button"
          data-testid="load-earlier-messages"
          disabled={loadingEarlier}
          onclick={loadEarlierMessages}
        >
          {loadingEarlier
            ? i18n.t('Loading earlier messages...')
            : i18n.t('Load earlier messages ({count} hidden)', { count: visibleStart })}
        </button>
      </li>
    {/if}
    {#each visibleMessages as message (message._id)}`,
  'visible message loop'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `      <li
        class:flex-row-reverse={isUser}`,
  `      <li
        data-message-id={message._id}
        class:flex-row-reverse={isUser}`,
  'message id attribute'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `            <button
              class="icon-button h-7 w-7"
              type="button"
              aria-label={i18n.t('Edit message')}`,
  `            <button
              class="icon-button h-7 w-7"
              type="button"
              data-testid={\`branch-message-\${message._id}\`}
              aria-label={i18n.t('Branch from here')}
              title={i18n.t('Branch from here')}
              disabled={chats.generating || messageActionBusy}
              onclick={() => branchFromMessage(message._id)}
            >
              <GitBranch size={14} />
            </button>
            <button
              class="icon-button h-7 w-7"
              type="button"
              aria-label={i18n.t('Edit message')}`,
  'branch toolbar button'
)

replaceOnce(
  'app/src/routes/Chat.svelte',
  `              aria-label={i18n.t('Delete message')}
              title={i18n.t('Delete message')}
              disabled={chats.generating}
              onclick={() => chats.deleteMessage(message._id)}`,
  `              data-testid={\`delete-message-\${message._id}\`}
              aria-label={i18n.t('Delete message')}
              title={i18n.t('Delete message')}
              disabled={chats.generating || messageActionBusy}
              onclick={() => requestMessageDelete(message)}`,
  'delete toolbar action'
)

insertBefore(
  'app/src/routes/Chat.svelte',
  '  {#if generationDebug}',
  `  {#if messageAction}
    <div
      class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={i18n.t('Change conversation from this message?')}
    >
      <button
        class="absolute inset-0 bg-black/75 backdrop-blur-sm"
        type="button"
        aria-label={i18n.t('Cancel')}
        disabled={messageActionBusy}
        onclick={() => (messageAction = null)}
      ></button>
      <section
        class="relative z-10 w-full max-w-lg rounded-xl border border-neutral-700 bg-[#0d1118] p-5 shadow-2xl"
      >
        <div class="mb-4 flex items-start gap-3">
          <GitBranch size={20} class="mt-0.5 shrink-0 text-violet-300" />
          <div>
            <h2 class="text-base font-semibold text-neutral-100">
              {i18n.t('Change conversation from this message?')}
            </h2>
            <p class="mt-1 text-sm leading-6 text-neutral-400">
              {i18n.t(
                'This is a middle message by {author}. Delete only it, remove everything after it, or keep the current chat and create a branch.',
                { author: messageAction.author }
              )}
            </p>
          </div>
        </div>
        <div class="grid gap-2 sm:grid-cols-2">
          <button
            class="button-secondary justify-center"
            type="button"
            disabled={messageActionBusy}
            onclick={() => deleteSelectedMessage('single')}
          >
            {i18n.t('Delete this message only')}
          </button>
          <button
            class="button-secondary justify-center border-red-800/70 text-red-300 hover:border-red-700"
            type="button"
            disabled={messageActionBusy}
            onclick={() => deleteSelectedMessage('tail')}
          >
            {i18n.t('Delete from here')}
          </button>
          <button
            class="button-primary justify-center sm:col-span-2"
            type="button"
            disabled={messageActionBusy}
            onclick={() => branchFromMessage(messageAction!.messageId)}
          >
            <GitBranch size={15} />
            {i18n.t('Branch from here')}
          </button>
          <button
            class="button-secondary justify-center sm:col-span-2"
            type="button"
            disabled={messageActionBusy}
            onclick={() => (messageAction = null)}
          >
            {i18n.t('Cancel')}
          </button>
        </div>
      </section>
    </div>
  {/if}

`,
  'generation debug modal'
)

// -------------------------------------------------------------------------- translations and shared styles
replaceOnce(
  'app/src/lib/i18n.svelte.ts',
  "  'Delete message': '메시지 삭제',",
  `  'Delete message': '메시지 삭제',
  'Branch from here': '여기서 브랜치 분기',
  'Change conversation from this message?': '이 메시지부터 대화를 변경할까요?',
  'Delete this message only': '이 메시지만 삭제',
  'Delete from here': '여기부터 끝까지 삭제',
  'This is a middle message by {author}. Delete only it, remove everything after it, or keep the current chat and create a branch.':
    '{author}의 중간 메시지입니다. 이 메시지만 삭제하거나, 이후 내용을 모두 삭제하거나, 현재 채팅을 유지한 채 새 브랜치를 만들 수 있습니다.',
  'Load earlier messages ({count} hidden)': '이전 메시지 불러오기 ({count}개 숨김)',
  'Loading earlier messages...': '이전 메시지를 불러오는 중...',`,
  'message action translations'
)

replaceOnce(
  'app/src/app.css',
  `:root {
  color-scheme: dark;
}`,
  `html[data-mode='dark'] {
  color-scheme: dark;
}

html[data-mode='light'] {
  color-scheme: light;
}`,
  'color scheme mode'
)
replaceOnce(
  'app/src/app.css',
  'hover:bg-neutral-800 hover:text-white',
  'hover:bg-neutral-800 hover:text-neutral-100',
  'icon hover contrast'
)

// -------------------------------------------------------------------------- E2E server support
replaceOnce(
  'app/tests/e2e/stub-server.ts',
  `  swaps: Array<{ id: string; body: any }>
  inferenceDelayMs: number`,
  `  swaps: Array<{ id: string; body: any }>
  deletions: Array<{ chatId: string; body: any }>
  branches: Array<{ chatId: string; body: any }>
  inferenceDelayMs: number`,
  'stub state branch fields'
)
replaceOnce(
  'app/tests/e2e/stub-server.ts',
  `    swaps: [],
    inferenceDelayMs: 30,`,
  `    swaps: [],
    deletions: [],
    branches: [],
    inferenceDelayMs: 30,`,
  'stub initial branch fields'
)
replaceOnce(
  'app/tests/e2e/stub-server.ts',
  `      this.swaps = []
      this.inferenceDelayMs = 30`,
  `      this.swaps = []
      this.deletions = []
      this.branches = []
      this.inferenceDelayMs = 30`,
  'stub reset branch fields'
)
replaceOnce(
  'app/tests/e2e/stub-server.ts',
  `    const summary = chatList.find((c) => c._id === id)`,
  `    const summary = [...chatList, ...state.extraChats].find((c) => c._id === id)`,
  'stub branched chat detail'
)

insertBefore(
  'app/tests/e2e/stub-server.ts',
  `      const chatMatch = path.match(/^\\/api\\/chat\\/([^/]+)$/)`,
  `      const branchMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/branch$/)
      if (branchMatch && req.method === 'POST') {
        const body = await readBody(req)
        state.branches.push({ chatId: branchMatch[1], body })
        const source = [...chatList, ...state.extraChats].find((chat) => chat._id === branchMatch[1])
        if (!source) return json({ message: 'Chat not found' }, 404)
        const created = {
          _id: ` + '`chat-branch-${state.branches.length}`' + `,
          kind: 'chat',
          userId: 'user-1',
          memberIds: [],
          characterId: source.characterId,
          name: source.name + ' · branch',
          createdAt: now,
          updatedAt: now,
          messageCount: 0,
          genPreset: state.chatPreset,
        }
        state.extraChats.push(created)
        return json({ chat: created, messages: [] })
      }

      const deleteMessages = path.match(/^\\/api\\/chat\\/([^/]+)\\/messages-v2$/)
      if (deleteMessages && req.method === 'DELETE') {
        const body = await readBody(req)
        state.deletions.push({ chatId: deleteMessages[1], body })
        const removed = new Set(body.ids)
        state.extraMessages = state.extraMessages.filter((message) => !removed.has(message._id))
        return json({ chat: {}, messages: [] })
      }

`,
  'stub chat route'
)

const pkgPath = 'package.json'
const pkg = JSON.parse(read(pkgPath))
pkg.version = '1.0.37'
write(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)

console.log('Message branching, tail deletion, dynamic history, and theme audit patch applied.')
