import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before)
  if (index < 0) throw new Error(`Could not find ${label}`)
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Expected one ${label}`)
  }
  return source.slice(0, index) + after + source.slice(index + before.length)
}

function replaceCount(source, before, after, expected, label) {
  const found = source.split(before).length - 1
  if (found !== expected) throw new Error(`Expected ${expected} ${label}, found ${found}`)
  return source.split(before).join(after)
}

function replaceBetween(source, start, end, replacement, label) {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`Could not find start of ${label}`)
  const to = source.indexOf(end, from)
  if (to < 0) throw new Error(`Could not find end of ${label}`)
  return source.slice(0, from) + replacement + source.slice(to)
}

// ---------------------------------------------------------------- generate.ts
{
  const path = 'app/src/lib/generate.ts'
  let source = readFileSync(path, 'utf8')

  source = replaceOnce(
    source,
    "import { getEncoder, prepareTokenizer } from '/common/tokenize'\n",
    "import { getEncoder, prepareTokenizer } from '/common/tokenize'\nimport {\n  generationSummary,\n  resolveGenerationModel,\n  type GenerationDebug,\n  type GenerationRequestDebug,\n} from './generation-debug'\n",
    'generation debug import'
  )

  source = replaceOnce(
    source,
    "const newId = () => crypto.randomUUID()\n",
    `const newId = () => crypto.randomUUID()\n\nasync function buildGenerationDebug(\n  text: string,\n  request: Omit<GenerationRequestDebug, 'settings'>,\n  settings: Partial<AppSchema.GenSettings> | undefined,\n  countTokens: (text: string) => Promise<number>\n): Promise<GenerationDebug> {\n  return {\n    model: resolveGenerationModel(settings),\n    outputTokens: await countTokens(text),\n    request: {\n      ...request,\n      // This is the actual inference payload minus the user object, which contains credentials.\n      settings: settings ? structuredClone(settings) : undefined,\n    },\n  }\n}\n`,
    'generation debug builder'
  )

  const streamBefore = `  const request = inferencePrompt(prompt, messages)\n  const reply = await stream(\n    control.requestId,\n    // Appended after assembly rather than through a placeholder: an asset the model was never\n    // told about can never be shown, so this must not depend on the user editing a template.\n    withAssetInstruction(request.prompt, char.assets),\n    request.messages,\n    settings,\n    user,\n    chat._id,\n    handlers\n  )`
  const streamAfter = `  const request = inferencePrompt(prompt, messages)\n  const inferenceRequest = {\n    requestId: control.requestId,\n    chatId: chat._id,\n    // Appended after assembly rather than through a placeholder: an asset the model was never\n    // told about can never be shown, so this must not depend on the user editing a template.\n    prompt: withAssetInstruction(request.prompt, char.assets),\n    messages: request.messages,\n  }\n  const reply = await stream(\n    inferenceRequest.requestId,\n    inferenceRequest.prompt,\n    inferenceRequest.messages,\n    settings,\n    user,\n    chat._id,\n    handlers\n  )`
  source = replaceCount(source, streamBefore, streamAfter, 2, 'inference request blocks')

  source = replaceOnce(
    source,
    `  if (!reply || control.stopped) return { userMessage: userMessage.message, botMessage: undefined }\n\n  const botMessage = await api.post<SendMessageResponse>(`,
    `  if (!reply || control.stopped) return { userMessage: userMessage.message, botMessage: undefined }\n\n  const debug = await buildGenerationDebug(reply, inferenceRequest, settings, encoder)\n  const botMessage = await api.post<SendMessageResponse>(`,
    'send generation debug'
  )

  source = replaceOnce(
    source,
    `    impersonate: char,\n  } satisfies SendMessageBody)`,
    `    impersonate: char,\n    meta: { generation: generationSummary(debug) },\n  } satisfies SendMessageBody)`,
    'bot message generation metadata'
  )

  source = replaceOnce(
    source,
    `  return { userMessage: userMessage.message, botMessage: botMessage.message }`,
    `  return { userMessage: userMessage.message, botMessage: botMessage.message, debug }`,
    'send result debug'
  )

  source = replaceOnce(
    source,
    `  if (!reply || control.stopped) return undefined\n\n  void summariseChat({ detail, user, profile, settings, messages, assembled: prompt, impersonate })\n\n  return reply`,
    `  if (!reply || control.stopped) return undefined\n\n  const debug = await buildGenerationDebug(reply, inferenceRequest, settings, encoder)\n  void summariseChat({ detail, user, profile, settings, messages, assembled: prompt, impersonate })\n\n  return { text: reply, debug }`,
    'reroll generation result'
  )

  writeFileSync(path, source)
}

// ---------------------------------------------------------------- contracts.ts
{
  const path = 'app/src/lib/contracts.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `  impersonate?: AppSchema.Character\n}`,
    `  impersonate?: AppSchema.Character\n  meta?: unknown\n}`,
    'send message meta contract'
  )
  writeFileSync(path, source)
}

// ---------------------------------------------------------------- chats.svelte.ts
{
  const path = 'app/src/lib/chats.svelte.ts'
  let source = readFileSync(path, 'utf8')

  source = replaceOnce(
    source,
    `import { cancelGeneration, generateLastReply, sendMessage, type SendControl } from './generate'\n`,
    `import { cancelGeneration, generateLastReply, sendMessage, type SendControl } from './generate'\nimport {\n  archiveVisibleVariant,\n  generationSummary,\n  readGenerationSummary,\n  readRetryGenerationSummaries,\n  rotateVariantState,\n  writeGenerationMeta,\n  type GenerationRequestStack,\n} from './generation-debug'\n`,
    'chat generation debug imports'
  )

  source = replaceOnce(
    source,
    `  /** Current visible position for messages with alternate responses. */\n  variantPositions = $state<Record<string, number>>({})\n  private control: SendControl | undefined`,
    `  /** Current visible position for messages with alternate responses. */\n  variantPositions = $state<Record<string, number>>({})\n  /** Existing reply hidden while its replacement streams. */\n  rerollingMessageId = $state<string | undefined>()\n  /** Full inference requests are session-only to avoid duplicating the whole context in MongoDB. */\n  generationRequests = $state<Record<string, GenerationRequestStack>>({})\n  private control: SendControl | undefined`,
    'reroll state'
  )

  source = replaceOnce(
    source,
    `  private setMessages(messages: AppSchema.ChatMessage[]) {\n    this.messages = messages\n    if (this.detail) this.detail = { ...this.detail, messages }\n  }\n`,
    `  private setMessages(messages: AppSchema.ChatMessage[]) {\n    this.messages = messages\n    if (this.detail) this.detail = { ...this.detail, messages }\n  }\n\n  generationRequest(messageId: string) {\n    return this.generationRequests[messageId]?.current\n  }\n`,
    'generation request getter'
  )

  source = replaceOnce(
    source,
    `      // Re-read rather than splice locally: the server assigns ids, parents and timestamps.\n      await this.openChat(detail.chat._id)\n      return result`,
    `      // Re-read rather than splice locally: the server assigns ids, parents and timestamps.\n      await this.openChat(detail.chat._id)\n      if (result.botMessage && result.debug) {\n        this.generationRequests = {\n          ...this.generationRequests,\n          [result.botMessage._id]: { current: result.debug.request, retries: [] },\n        }\n      }\n      return result`,
    'remember sent request'
  )

  const retryStart = `  async retry() {`
  const retryEnd = `  /**\n   * Attaches (or detaches, with an empty id) a memory book to the open chat.`
  const retryReplacement = `  async retry() {\n    const detail = this.detail\n    const user = session.user\n    const profile = session.profile\n    if (!detail || !user || !profile || this.generating) return\n\n    const last = this.messages.at(-1)\n    if (!last) return\n    // \`userId\`, not \`characterId\`: an impersonated user message carries both.\n    const rerolling = !last.userId\n    const promptMessages = rerolling ? this.messages.slice(0, -1) : this.messages\n    if (!promptMessages.length || !promptMessages.at(-1)?.userId) return\n\n    const control: SendControl = { requestId: '', stopped: false }\n    this.control = control\n    this.generating = true\n    this.stopping = false\n    this.partial = ''\n    this.error = ''\n    if (rerolling) this.rerollingMessageId = last._id\n\n    // Resolve at click time from the live session preset. No request or settings from the old\n    // response are reused.\n    const preset = this.resolvePreset(this.detail?.chat.genPreset ?? detail.chat.genPreset)\n\n    try {\n      const result = await generateLastReply(\n        { ...detail, messages: promptMessages },\n        user,\n        profile,\n        preset,\n        {\n          onPartial: (value) => (this.partial = value),\n          // Keep the completed text visible as the streaming bubble until persistence finishes.\n          onDone: (value) => (this.partial = value),\n          onError: (value) => (this.error = value),\n        },\n        control,\n        this.memoryBook(),\n        this.impersonate()\n      )\n      if (!result || control.stopped) return\n\n      if (rerolling) {\n        const priorRetries = last.retries ?? []\n        const priorTotal = priorRetries.length + 1\n        const currentPosition = this.variantPositions[last._id] ?? 0\n        const retries = Array<string>(priorTotal)\n        retries[currentPosition] = last.msg\n        priorRetries.forEach((text, index) => {\n          retries[(currentPosition + index + 1) % priorTotal] = text\n        })\n\n        const priorSummaries = readRetryGenerationSummaries(last)\n        const summarySlots = Array.from(\n          { length: priorRetries.length },\n          (_, index) => priorSummaries[index]\n        )\n        const retryGenerations = archiveVisibleVariant(\n          readGenerationSummary(last),\n          summarySlots,\n          currentPosition\n        )\n        const meta = writeGenerationMeta(\n          last.meta,\n          generationSummary(result.debug),\n          retryGenerations\n        )\n\n        const priorRequests = this.generationRequests[last._id] ?? {}\n        const requestSlots = Array.from(\n          { length: priorRetries.length },\n          (_, index) => priorRequests.retries?.[index]\n        )\n        const retryRequests = archiveVisibleVariant(\n          priorRequests.current,\n          requestSlots,\n          currentPosition\n        )\n\n        await api.put(\`/chat/\${last._id}/message-swap\`, {\n          msg: result.text,\n          retries,\n          meta,\n        })\n        this.setMessages(\n          this.messages.map((message) =>\n            message._id === last._id\n              ? { ...message, msg: result.text, retries, meta }\n              : message\n          )\n        )\n        this.variantPositions = {\n          ...this.variantPositions,\n          [last._id]: retries.length,\n        }\n        this.generationRequests = {\n          ...this.generationRequests,\n          [last._id]: { current: result.debug.request, retries: retryRequests },\n        }\n      } else {\n        const char =\n          detail.character ??\n          detail.characters.find((character) => character._id === detail.chat.characterId)\n        if (!char) throw new Error('Chat has no character')\n        const created = await api.post<SendMessageResponse>(\`/chat/\${detail.chat._id}/send\`, {\n          text: result.text,\n          messageId: crypto.randomUUID(),\n          parent: last._id,\n          bot: true,\n          impersonate: char,\n          meta: { generation: generationSummary(result.debug) },\n        })\n        await this.openChat(detail.chat._id)\n        this.generationRequests = {\n          ...this.generationRequests,\n          [created.message._id]: { current: result.debug.request, retries: [] },\n        }\n      }\n    } catch (ex) {\n      this.error = ex instanceof Error ? ex.message : 'Retry failed'\n    } finally {\n      this.generating = false\n      this.stopping = false\n      this.partial = ''\n      this.control = undefined\n      if (this.rerollingMessageId === last._id) this.rerollingMessageId = undefined\n    }\n  }\n\n`
  source = replaceBetween(source, retryStart, retryEnd, retryReplacement, 'retry function')

  const cycleStart = `  async cycleVariant(messageId: string, direction: -1 | 1) {`
  const cycleEnd = `  /**\n   * Edits a message's text`
  const cycleReplacement = `  async cycleVariant(messageId: string, direction: -1 | 1) {\n    const message = this.messages.find((item) => item._id === messageId)\n    const retries = message?.retries ?? []\n    if (!message || !retries.length) return\n\n    const total = retries.length + 1\n    const currentPosition = this.variantPositions[messageId] ?? 0\n    const nextPosition = (currentPosition + direction + total) % total\n    const rotatedText = rotateVariantState(message.msg, retries, direction)\n\n    const persistedRetries = readRetryGenerationSummaries(message)\n    const summarySlots = Array.from(\n      { length: retries.length },\n      (_, index) => persistedRetries[index]\n    )\n    const rotatedSummary = rotateVariantState(\n      readGenerationSummary(message),\n      summarySlots,\n      direction\n    )\n    const meta = writeGenerationMeta(message.meta, rotatedSummary.current, rotatedSummary.retries)\n\n    const previousRequests = this.generationRequests[messageId]\n    const requestSlots = Array.from(\n      { length: retries.length },\n      (_, index) => previousRequests?.retries?.[index]\n    )\n    const rotatedRequests = rotateVariantState(\n      previousRequests?.current,\n      requestSlots,\n      direction\n    )\n    const updated = {\n      ...message,\n      msg: rotatedText.current ?? '',\n      retries: rotatedText.retries as string[],\n      meta,\n    }\n\n    this.setMessages(this.messages.map((item) => (item._id === messageId ? updated : item)))\n    this.variantPositions = { ...this.variantPositions, [messageId]: nextPosition }\n    this.generationRequests = {\n      ...this.generationRequests,\n      [messageId]: rotatedRequests,\n    }\n    try {\n      await api.put(\`/chat/\${messageId}/message-swap\`, {\n        msg: updated.msg,\n        retries: updated.retries,\n        meta,\n      })\n    } catch (ex) {\n      this.setMessages(this.messages.map((item) => (item._id === messageId ? message : item)))\n      this.variantPositions = {\n        ...this.variantPositions,\n        [messageId]: currentPosition,\n      }\n      const requests = { ...this.generationRequests }\n      if (previousRequests) requests[messageId] = previousRequests\n      else delete requests[messageId]\n      this.generationRequests = requests\n      this.error = ex instanceof Error ? ex.message : 'Failed to switch swipe'\n    }\n  }\n\n`
  source = replaceBetween(source, cycleStart, cycleEnd, cycleReplacement, 'cycle variant function')

  writeFileSync(path, source)
}

// ---------------------------------------------------------------- server message swap metadata
{
  const path = 'srv/api/chat/edit.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `{ imagePrompt: 'string?', msg: 'string?', extras: ['string?'], retries: ['string?'] },`,
    `{\n      imagePrompt: 'string?',\n      msg: 'string?',\n      extras: ['string?'],\n      retries: ['string?'],\n      meta: 'any?',\n    },`,
    'swap validator meta'
  )
  source = replaceOnce(
    source,
    `    extras: body.extras || prev.msg.extras,\n  }`,
    `    extras: body.extras || prev.msg.extras,\n    meta: body.meta ?? prev.msg.meta,\n  }`,
    'swap update meta'
  )
  source = replaceOnce(
    source,
    `    extras: body.extras || prev.msg.extras,\n  })`,
    `    extras: body.extras || prev.msg.extras,\n    meta: body.meta ?? prev.msg.meta,\n  })`,
    'swap event meta'
  )
  writeFileSync(path, source)
}

// ---------------------------------------------------------------- Chat.svelte
{
  const path = 'app/src/routes/Chat.svelte'
  let source = readFileSync(path, 'utf8')

  source = replaceOnce(source, `    ArrowLeft,\n`, `    ArrowLeft,\n    Bug,\n`, 'debug icon import')
  source = replaceOnce(
    source,
    `  import { renderMarkdown } from '/app/lib/markdown'\n`,
    `  import { renderMarkdown } from '/app/lib/markdown'\n  import {\n    readGenerationSummary,\n    type GenerationRequestDebug,\n    type GenerationSummary,\n  } from '/app/lib/generation-debug'\n`,
    'chat debug import'
  )
  source = replaceOnce(
    source,
    `  let expandedAsset = $state<{ name: string; src: string } | null>(null)\n`,
    `  let expandedAsset = $state<{ name: string; src: string } | null>(null)\n  let generationDebug = $state<{\n    summary: GenerationSummary\n    request?: GenerationRequestDebug\n  } | null>(null)\n`,
    'debug modal state'
  )
  source = replaceOnce(
    source,
    `    if (expandedAsset) expandedAsset = null\n    else if (mobileHeaderOpen) mobileHeaderOpen = false`,
    `    if (generationDebug) generationDebug = null\n    else if (expandedAsset) expandedAsset = null\n    else if (mobileHeaderOpen) mobileHeaderOpen = false`,
    'debug modal escape'
  )
  source = replaceOnce(
    source,
    `      {@const character = isUser ? undefined : characterOf(message.characterId)}\n      {@const isLast = message._id === chats.messages.at(-1)?._id}`,
    `      {@const character = isUser ? undefined : characterOf(message.characterId)}\n      {@const generation = isUser ? undefined : readGenerationSummary(message)}\n      {@const isLast = message._id === chats.messages.at(-1)?._id}`,
    'message generation summary'
  )
  source = replaceOnce(
    source,
    `      <li\n        class:flex-row-reverse={isUser}\n        class="mx-auto flex w-full {widthClass} items-start gap-3"`,
    `      <li\n        class:flex-row-reverse={isUser}\n        class:hidden={chats.rerollingMessageId === message._id}\n        class="mx-auto flex w-full {widthClass} items-start gap-3"`,
    'hide rerolled message'
  )

  source = replaceOnce(
    source,
    `          <div class="mt-1 flex min-h-7 items-center gap-1" class:justify-end={isUser}>`,
    `          {#if generation}\n            <button\n              class="mt-1 flex max-w-full items-center gap-1.5 truncate text-[10px] text-neutral-600 transition hover:text-neutral-400"\n              type="button"\n              data-testid={\`generation-debug-\${message._id}\`}\n              aria-label={i18n.t('View generation request')}\n              title={i18n.t('View generation request')}\n              onclick={() =>\n                (generationDebug = {\n                  summary: generation,\n                  request: chats.generationRequest(message._id),\n                })}\n            >\n              <Bug size={11} />\n              <span class="truncate">\n                {generation.model} · {i18n.t('{count} tokens', { count: generation.outputTokens })}\n              </span>\n            </button>\n          {/if}\n          <div class="mt-1 flex min-h-7 items-center gap-1" class:justify-end={isUser}>`,
    'message debug badge'
  )

  source = replaceOnce(
    source,
    `  {#if expandedAsset}\n`,
    `  {#if generationDebug}\n    <div\n      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"\n      role="dialog"\n      aria-modal="true"\n      aria-labelledby="generation-request-title"\n    >\n      <button\n        class="absolute inset-0 bg-black/80 backdrop-blur-sm"\n        type="button"\n        aria-label={i18n.t('Close')}\n        onclick={() => (generationDebug = null)}\n      >\n        <span class="sr-only">{i18n.t('Close')}</span>\n      </button>\n      <section\n        class="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#0d1118] shadow-2xl"\n      >\n        <header class="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">\n          <Bug size={17} class="text-violet-300" />\n          <div class="min-w-0 flex-1">\n            <h2 id="generation-request-title" class="text-sm font-semibold text-neutral-100">\n              {i18n.t('Generation request')}\n            </h2>\n            <p class="truncate text-xs text-neutral-500">\n              {generationDebug.summary.model} · {i18n.t('{count} tokens', {\n                count: generationDebug.summary.outputTokens,\n              })}\n            </p>\n          </div>\n          <button\n            class="icon-button"\n            type="button"\n            aria-label={i18n.t('Close')}\n            onclick={() => (generationDebug = null)}\n          >\n            <X size={18} />\n          </button>\n        </header>\n        <div class="min-h-0 flex-1 overflow-auto p-4">\n          {#if generationDebug.request}\n            <p class="mb-3 text-xs text-neutral-500">\n              {i18n.t('The actual inference payload is shown without account or authentication data.')}\n            </p>\n            <pre\n              class="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-black/30 p-3 font-mono text-xs leading-5 text-neutral-300"\n              data-testid="generation-request-body">{JSON.stringify(\n                generationDebug.request,\n                null,\n                2\n              )}</pre\n            >\n          {:else}\n            <p class="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-500">\n              {i18n.t('Request details are only kept for generations made in this browser session.')}\n            </p>\n          {/if}\n        </div>\n      </section>\n    </div>\n  {/if}\n\n  {#if expandedAsset}\n`,
    'generation debug modal'
  )

  writeFileSync(path, source)
}

// ---------------------------------------------------------------- i18n
{
  const path = 'app/src/lib/i18n.svelte.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `  '{count} tokens': '{count} 토큰',\n`,
    `  '{count} tokens': '{count} 토큰',\n  'View generation request': '생성 요청 보기',\n  'Generation request': '생성 요청',\n  'The actual inference payload is shown without account or authentication data.':\n    '계정 및 인증 정보를 제외한 실제 추론 요청 본문입니다.',\n  'Request details are only kept for generations made in this browser session.':\n    '요청 전문은 현재 브라우저 세션에서 생성한 답변에만 보관됩니다.',\n`,
    'generation debug translations'
  )
  writeFileSync(path, source)
}

// ---------------------------------------------------------------- e2e stub
{
  const path = 'app/tests/e2e/stub-server.ts'
  let source = readFileSync(path, 'utf8')

  source = replaceOnce(
    source,
    `  /** Prompts the client assembled and posted to /chat/inference-stream. */\n  prompts: string[]\n  apiCalls: string[]`,
    `  /** Prompts the client assembled and posted to /chat/inference-stream. */\n  prompts: string[]\n  inferenceRequests: any[]\n  swaps: Array<{ id: string; body: any }>\n  inferenceDelayMs: number\n  inferenceResponse: string\n  apiCalls: string[]`,
    'stub inference fields'
  )
  source = replaceOnce(
    source,
    `    prompts: [],\n    apiCalls: [],`,
    `    prompts: [],\n    inferenceRequests: [],\n    swaps: [],\n    inferenceDelayMs: 30,\n    inferenceResponse: 'Stub reply.',\n    apiCalls: [],`,
    'stub inference defaults'
  )
  source = replaceOnce(
    source,
    `      this.prompts = []\n      this.apiCalls = []`,
    `      this.prompts = []\n      this.inferenceRequests = []\n      this.swaps = []\n      this.inferenceDelayMs = 30\n      this.inferenceResponse = 'Stub reply.'\n      this.apiCalls = []`,
    'stub inference reset'
  )
  source = replaceOnce(
    source,
    `          updatedAt: now,\n          ...(body.bot ? { characterId: 'char-1' } : { userId: 'user-1' }),`,
    `          updatedAt: now,\n          parent: body.parent,\n          meta: body.meta,\n          ...(body.bot ? { characterId: 'char-1' } : { userId: 'user-1' }),`,
    'stub message metadata'
  )
  source = replaceOnce(
    source,
    `      const editMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/message$/)`,
    `      const swapMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/message-swap$/)\n      if (swapMatch && req.method === 'PUT') {\n        const body = await readBody(req)\n        state.swaps.push({ id: swapMatch[1], body })\n        const target = state.extraMessages.find((message) => message._id === swapMatch[1])\n        if (target) Object.assign(target, body)\n        return json(target ?? { _id: swapMatch[1], ...body })\n      }\n\n      const editMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/message$/)`,
    'stub message swap'
  )
  source = replaceOnce(
    source,
    `      if (path === '/api/chat/inference-stream' && req.method === 'POST') {\n        const body = await readBody(req)\n        state.prompts.push(body.prompt ?? '')\n        // The client resolves on the socket event, not this response.\n        setTimeout(() => {\n          liveSocket?.send(\n            JSON.stringify({\n              type: 'inference',\n              requestId: body.requestId,\n              response: 'Stub reply.',\n            })\n          )\n        }, 30)\n        return json({ success: true })\n      }`,
    `      if (path === '/api/chat/inference-stream' && req.method === 'POST') {\n        const body = await readBody(req)\n        state.prompts.push(body.prompt ?? '')\n        state.inferenceRequests.push(body)\n        // The client resolves on the socket event, not this response.\n        setTimeout(() => {\n          liveSocket?.send(\n            JSON.stringify({\n              type: 'inference',\n              requestId: body.requestId,\n              response: state.inferenceResponse,\n            })\n          )\n        }, state.inferenceDelayMs)\n        return json({ success: true })\n      }`,
    'stub inference response control'
  )

  writeFileSync(path, source)
}

// ---------------------------------------------------------------- e2e assertion correction
{
  const path = 'app/tests/e2e/reroll-debug.spec.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `  await expect(app.getByTestId('generation-request-body')).toContainText('Fresh reroll reply.', {\n    useInnerText: false,\n  })`,
    `  await expect(app.getByTestId('generation-request-body')).toContainText('current/model-v2')\n  await expect(app.getByTestId('generation-request-body')).toContainText('Some **bold**')`,
    'debug request assertions'
  )
  // Avoid asserting the model twice after the replacement above.
  source = source.replace(
    `  await expect(app.getByTestId('generation-request-body')).toContainText('current/model-v2')\n  await expect(app.getByTestId('generation-request-body')).toContainText('current/model-v2')\n`,
    `  await expect(app.getByTestId('generation-request-body')).toContainText('current/model-v2')\n`
  )
  writeFileSync(path, source)
}

// ---------------------------------------------------------------- version
{
  const path = 'package.json'
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.version = '1.0.33'
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
}
