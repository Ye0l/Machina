import { readFileSync, writeFileSync } from 'node:fs'

function replaceOnce(source, before, after, label) {
  const index = source.indexOf(before)
  if (index < 0) throw new Error(`Could not find ${label}`)
  return source.slice(0, index) + after + source.slice(index + before.length)
}

function replaceBetween(source, start, end, replacement, label) {
  const from = source.indexOf(start)
  if (from < 0) throw new Error(`Could not find start of ${label}`)
  const to = source.indexOf(end, from)
  if (to < 0) throw new Error(`Could not find end of ${label}`)
  return source.slice(0, from) + replacement + source.slice(to)
}

// Persist generation metadata atomically with response swipe text.
{
  const path = 'srv/api/chat/edit.ts'
  let source = readFileSync(path, 'utf8')
  const replacement = `export const swapMessage = handle(async ({ body, params, userId }) => {
  assertValid(
    {
      imagePrompt: 'string?',
      msg: 'string?',
      extras: ['string?'],
      retries: ['string?'],
      meta: 'any?',
    },
    body
  )

  const prev = await store.chats.getMessageAndChat(params.id)
  if (!prev || !prev.chat) throw errors.NotFound
  if (prev.chat?.userId !== userId) throw errors.Forbidden

  const update: Partial<AppSchema.ChatMessage> = {
    imagePrompt: body.imagePrompt || prev.msg.imagePrompt,
    msg: body.msg ?? prev.msg.msg,
    retries: body.retries,
    extras: body.extras || prev.msg.extras,
    meta: body.meta ?? prev.msg.meta,
  }

  const message = await store.msgs.editMessage(params.id, {
    ...update,
    state: body.msg === undefined ? prev.msg.state : 'swapped',
  })

  sendMany(prev.chat?.memberIds.concat(prev.chat.userId), {
    type: 'message-swapped',
    ...update,
    chatId: prev.chat._id,
    messageId: params.id,
    imagePrompt: body.imagePrompt || prev.msg.imagePrompt,
    message: body.msg || prev.msg.msg,
    extras: body.extras || prev.msg.extras,
    meta: body.meta ?? prev.msg.meta,
  })

  return message
})

`
  source = replaceBetween(
    source,
    'export const swapMessage = handle(async ({ body, params, userId }) => {',
    'export const updateMessageProps = handle(async ({ body, params, userId }) => {',
    replacement,
    'swapMessage'
  )
  writeFileSync(path, source)
}

// Chat presentation and debug modal.
{
  const path = 'app/src/routes/Chat.svelte'
  let source = readFileSync(path, 'utf8')

  source = replaceOnce(source, '    ArrowLeft,\n', '    ArrowLeft,\n    Bug,\n', 'Bug import')
  source = replaceOnce(
    source,
    "  import { renderMarkdown } from '/app/lib/markdown'\n",
    "  import { renderMarkdown } from '/app/lib/markdown'\n  import {\n    readGenerationSummary,\n    type GenerationRequestDebug,\n    type GenerationSummary,\n  } from '/app/lib/generation-debug'\n",
    'generation debug import'
  )
  source = replaceOnce(
    source,
    `  let expandedAsset = $state<{ name: string; src: string } | null>(null)\n`,
    `  let expandedAsset = $state<{ name: string; src: string } | null>(null)\n  let generationDebug = $state<{\n    summary: GenerationSummary\n    request?: GenerationRequestDebug\n  } | null>(null)\n`,
    'generation debug state'
  )
  source = replaceOnce(
    source,
    `    if (expandedAsset) expandedAsset = null\n    else if (mobileHeaderOpen) mobileHeaderOpen = false`,
    `    if (generationDebug) generationDebug = null\n    else if (expandedAsset) expandedAsset = null\n    else if (mobileHeaderOpen) mobileHeaderOpen = false`,
    'modal escape handling'
  )
  source = replaceOnce(
    source,
    `      {@const character = isUser ? undefined : characterOf(message.characterId)}\n      {@const isLast = message._id === chats.messages.at(-1)?._id}`,
    `      {@const character = isUser ? undefined : characterOf(message.characterId)}\n      {@const generation = isUser ? undefined : readGenerationSummary(message)}\n      {@const isLast = message._id === chats.messages.at(-1)?._id}`,
    'message generation metadata'
  )
  source = replaceOnce(
    source,
    `      <li\n        class:flex-row-reverse={isUser}\n        class="mx-auto flex w-full {widthClass} items-start gap-3"`,
    `      <li\n        class:flex-row-reverse={isUser}\n        class:hidden={chats.rerollingMessageId === message._id}\n        class="mx-auto flex w-full {widthClass} items-start gap-3"`,
    'reroll message hiding'
  )
  source = replaceOnce(
    source,
    `          <div class="mt-1 flex min-h-7 items-center gap-1" class:justify-end={isUser}>`,
    `          {#if generation}\n            <button\n              class="mt-1 flex max-w-full items-center gap-1.5 truncate text-[10px] text-neutral-600 transition hover:text-neutral-400"\n              type="button"\n              data-testid={\`generation-debug-\${message._id}\`}\n              aria-label={i18n.t('View generation request')}\n              title={i18n.t('View generation request')}\n              onclick={() =>\n                (generationDebug = {\n                  summary: generation,\n                  request: chats.generationRequest(message._id),\n                })}\n            >\n              <Bug size={11} />\n              <span class="truncate">\n                {generation.model} · {i18n.t('{count} tokens', { count: generation.outputTokens })}\n              </span>\n            </button>\n          {/if}\n          <div class="mt-1 flex min-h-7 items-center gap-1" class:justify-end={isUser}>`,
    'generation badge'
  )

  const modal = `  {#if generationDebug}
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generation-request-title"
    >
      <button
        class="absolute inset-0 bg-black/80 backdrop-blur-sm"
        type="button"
        aria-label={i18n.t('Close')}
        onclick={() => (generationDebug = null)}
      >
        <span class="sr-only">{i18n.t('Close')}</span>
      </button>
      <section
        class="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-neutral-700 bg-[#0d1118] shadow-2xl"
      >
        <header class="flex shrink-0 items-center gap-3 border-b border-neutral-800 px-4 py-3">
          <Bug size={17} class="text-violet-300" />
          <div class="min-w-0 flex-1">
            <h2 id="generation-request-title" class="text-sm font-semibold text-neutral-100">
              {i18n.t('Generation request')}
            </h2>
            <p class="truncate text-xs text-neutral-500">
              {generationDebug.summary.model} · {i18n.t('{count} tokens', {
                count: generationDebug.summary.outputTokens,
              })}
            </p>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label={i18n.t('Close')}
            onclick={() => (generationDebug = null)}
          >
            <X size={18} />
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-auto p-4">
          {#if generationDebug.request}
            <p class="mb-3 text-xs text-neutral-500">
              {i18n.t('The actual inference payload is shown without account or authentication data.')}
            </p>
            <pre
              class="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-black/30 p-3 font-mono text-xs leading-5 text-neutral-300"
              data-testid="generation-request-body"
            >{JSON.stringify(generationDebug.request, null, 2)}</pre>
          {:else}
            <p class="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-500">
              {i18n.t('Request details are only kept for generations made in this browser session.')}
            </p>
          {/if}
        </div>
      </section>
    </div>
  {/if}

`
  source = replaceOnce(source, '  {#if expandedAsset}\n', modal + '  {#if expandedAsset}\n', 'debug modal')
  writeFileSync(path, source)
}

// Korean labels for the debug affordance.
{
  const path = 'app/src/lib/i18n.svelte.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `  '{count} tokens': '{count} 토큰',\n`,
    `  '{count} tokens': '{count} 토큰',\n  'View generation request': '생성 요청 보기',\n  'Generation request': '생성 요청',\n  'The actual inference payload is shown without account or authentication data.':\n    '계정 및 인증 정보를 제외한 실제 추론 요청 본문입니다.',\n  'Request details are only kept for generations made in this browser session.':\n    '요청 전문은 현재 브라우저 세션에서 생성한 답변에만 보관됩니다.',\n`,
    'debug translations'
  )
  writeFileSync(path, source)
}

// Stub observability and controllable inference latency.
{
  const path = 'app/tests/e2e/stub-server.ts'
  let source = readFileSync(path, 'utf8')
  source = replaceOnce(
    source,
    `  /** Prompts the client assembled and posted to /chat/inference-stream. */\n  prompts: string[]\n  apiCalls: string[]`,
    `  /** Prompts the client assembled and posted to /chat/inference-stream. */\n  prompts: string[]\n  inferenceRequests: any[]\n  swaps: Array<{ id: string; body: any }>\n  inferenceDelayMs: number\n  inferenceResponse: string\n  apiCalls: string[]`,
    'stub fields'
  )
  source = replaceOnce(
    source,
    `    prompts: [],\n    apiCalls: [],`,
    `    prompts: [],\n    inferenceRequests: [],\n    swaps: [],\n    inferenceDelayMs: 30,\n    inferenceResponse: 'Stub reply.',\n    apiCalls: [],`,
    'stub defaults'
  )
  source = replaceOnce(
    source,
    `      this.prompts = []\n      this.apiCalls = []`,
    `      this.prompts = []\n      this.inferenceRequests = []\n      this.swaps = []\n      this.inferenceDelayMs = 30\n      this.inferenceResponse = 'Stub reply.'\n      this.apiCalls = []`,
    'stub reset'
  )
  source = replaceOnce(
    source,
    `          updatedAt: now,\n          ...(body.bot ? { characterId: 'char-1' } : { userId: 'user-1' }),`,
    `          updatedAt: now,\n          parent: body.parent,\n          meta: body.meta,\n          ...(body.bot ? { characterId: 'char-1' } : { userId: 'user-1' }),`,
    'stub sent metadata'
  )
  source = replaceOnce(
    source,
    `      const editMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/message$/)`,
    `      const swapMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/message-swap$/)\n      if (swapMatch && req.method === 'PUT') {\n        const body = await readBody(req)\n        state.swaps.push({ id: swapMatch[1], body })\n        const target = state.extraMessages.find((message) => message._id === swapMatch[1])\n        if (target) Object.assign(target, body)\n        return json(target ?? { _id: swapMatch[1], ...body })\n      }\n\n      const editMatch = path.match(/^\\/api\\/chat\\/([^/]+)\\/message$/)`,
    'stub swap route'
  )
  source = replaceOnce(
    source,
    `      if (path === '/api/chat/inference-stream' && req.method === 'POST') {\n        const body = await readBody(req)\n        state.prompts.push(body.prompt ?? '')\n        // The client resolves on the socket event, not this response.\n        setTimeout(() => {\n          liveSocket?.send(\n            JSON.stringify({\n              type: 'inference',\n              requestId: body.requestId,\n              response: 'Stub reply.',\n            })\n          )\n        }, 30)\n        return json({ success: true })\n      }`,
    `      if (path === '/api/chat/inference-stream' && req.method === 'POST') {\n        const body = await readBody(req)\n        state.prompts.push(body.prompt ?? '')\n        state.inferenceRequests.push(body)\n        // The client resolves on the socket event, not this response.\n        setTimeout(() => {\n          liveSocket?.send(\n            JSON.stringify({\n              type: 'inference',\n              requestId: body.requestId,\n              response: state.inferenceResponse,\n            })\n          )\n        }, state.inferenceDelayMs)\n        return json({ success: true })\n      }`,
    'stub inference control'
  )
  writeFileSync(path, source)
}

// Correct the modal assertion: the request contains the prompt, not the generated response.
{
  const path = 'app/tests/e2e/reroll-debug.spec.ts'
  let source = readFileSync(path, 'utf8')
  source = source.replace(
    `  await expect(app.getByTestId('generation-request-body')).toContainText('Fresh reroll reply.', {\n    useInnerText: false,\n  })`,
    `  await expect(app.getByTestId('generation-request-body')).toContainText('Some **bold**')`
  )
  writeFileSync(path, source)
}

{
  const path = 'package.json'
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  pkg.version = '1.0.33'
  writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n')
}
