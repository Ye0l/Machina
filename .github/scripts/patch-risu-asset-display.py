from pathlib import Path

path = Path('app/src/routes/Chat.svelte')
text = path.read_text()
text = text.replace(
    "import { replaceAssetTags } from '/common/assets'",
    "import { ASSET_TAG_PATTERN, findAsset } from '/common/assets'",
)

old = '''  const escapeAttribute = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/\"/g, '&quot;').replace(/</g, '&lt;')

  /**
   * `{{asset:name}}` becomes the image it names. An unknown name is left as written rather
   * than silently deleted: the model naming an asset that does not exist is worth seeing.
   *
   * The markup goes in before the markdown pass, so it lands in the same sanitiser as
   * everything else -- nothing here is trusted on its own.
   */
  const renderAssets = (text: string, speaker?: AppSchema.Character) =>
    replaceAssetTags(text, speaker?.assets, (asset, name) =>
      asset
        ? `<img class=\"chat-asset\" src=\"${escapeAttribute(
            assetUrl(asset.uri)
          )}\" alt=\"${escapeAttribute(name)}\" />`
        : `{{asset:${name}}}`
    )

  /** Placeholders are substituted before rendering, so what is shown matches the prompt. */
  const renderBody = (text: string, speaker?: AppSchema.Character) =>
    renderMarkdown(renderAssets(displayMessage(text, speaker), speaker))
'''
new = '''  type RenderedBodyPart =
    | { kind: 'text'; html: string }
    | { kind: 'asset'; name: string; src: string }

  /**
   * Asset tags are split out before Markdown rendering and become native Svelte image nodes.
   * RisuAI treats additional assets as media blocks rather than raw HTML inside Markdown;
   * doing the same also prevents Showdown/DOMPurify from swallowing or rewriting the image.
   */
  const renderBody = (text: string, speaker?: AppSchema.Character): RenderedBodyPart[] => {
    const displayed = displayMessage(text, speaker)
    const pattern = new RegExp(ASSET_TAG_PATTERN.source, ASSET_TAG_PATTERN.flags)
    const parts: RenderedBodyPart[] = []
    let cursor = 0

    const pushText = (value: string) => {
      if (value) parts.push({ kind: 'text', html: renderMarkdown(value) })
    }

    for (const match of displayed.matchAll(pattern)) {
      const index = match.index ?? 0
      pushText(displayed.slice(cursor, index))

      const name = (match[1] ?? '').trim()
      const asset = findAsset(speaker?.assets, name)
      if (asset) parts.push({ kind: 'asset', name, src: assetUrl(asset.uri) })
      else pushText(match[0])

      cursor = index + match[0].length
    }

    pushText(displayed.slice(cursor))
    return parts.length ? parts : [{ kind: 'text', html: renderMarkdown(displayed) }]
  }
'''
if old not in text:
    raise SystemExit('asset renderer block not found')
text = text.replace(old, new, 1)

text = text.replace(
    "  let messageList: HTMLOListElement\n",
    "  let messageList: HTMLOListElement\n  let expandedAsset = $state<{ name: string; src: string } | null>(null)\n",
    1,
)

text = text.replace(
    'class="field max-h-72 min-h-24 w-full resize-y py-2 leading-6"',
    'class="field h-[min(32rem,60vh)] min-h-72 w-full resize-y py-3 leading-6"',
    1,
)

old = '''          {:else}
            <div
              class:bg-violet-600={isUser}
              class:text-white={isUser}
              class="rendered-markdown rounded-2xl bg-[#151a23] px-4 py-3 leading-6 text-neutral-200 {isUser
                ? 'rounded-tr-md'
                : 'rounded-tl-md'}"
              style:opacity={msgOpacity}
            >
              <!-- Sanitised in renderMarkdown via DOMPurify. -->
              {@html renderBody(message.msg, character)}
            </div>
          {/if}
'''
new = '''          {:else}
            <div class="space-y-2">
              {#each renderBody(message.msg, character) as part}
                {#if part.kind === 'asset'}
                  <button
                    class="chat-asset-frame group block w-[min(100%,32rem)] overflow-hidden rounded-xl border border-neutral-700/70 bg-black/40 shadow-lg"
                    class:ml-auto={isUser}
                    type="button"
                    aria-label={i18n.t('Open image')}
                    onclick={() => (expandedAsset = part)}
                    style:opacity={msgOpacity}
                  >
                    <img
                      class="chat-asset block max-h-[70vh] w-full object-contain transition-transform group-hover:scale-[1.01]"
                      src={part.src}
                      alt={part.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </button>
                {:else if part.html}
                  <div
                    class:bg-violet-600={isUser}
                    class:text-white={isUser}
                    class:ml-auto={isUser}
                    class="rendered-markdown rounded-2xl bg-[#151a23] px-4 py-3 leading-6 text-neutral-200 {isUser
                      ? 'rounded-tr-md'
                      : 'rounded-tl-md'}"
                    style:opacity={msgOpacity}
                  >
                    <!-- Sanitised in renderMarkdown via DOMPurify. -->
                    {@html part.html}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
'''
if old not in text:
    raise SystemExit('stored message display block not found')
text = text.replace(old, new, 1)

old = '''          <div
            class="rendered-markdown rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200"
            style:opacity={msgOpacity}
          >
            <!-- Sanitised in renderMarkdown; partial markup is closed off by the sanitiser. -->
            {@html renderBody(chats.partial, detail.character)}<span
              class="animate-pulse text-violet-300">▌</span
            >
          </div>
'''
new = '''          <div class="space-y-2">
            {#each renderBody(chats.partial, detail.character) as part}
              {#if part.kind === 'asset'}
                <button
                  class="chat-asset-frame group block w-[min(100%,32rem)] overflow-hidden rounded-xl border border-neutral-700/70 bg-black/40 shadow-lg"
                  type="button"
                  aria-label={i18n.t('Open image')}
                  onclick={() => (expandedAsset = part)}
                  style:opacity={msgOpacity}
                >
                  <img
                    class="chat-asset block max-h-[70vh] w-full object-contain transition-transform group-hover:scale-[1.01]"
                    src={part.src}
                    alt={part.name}
                    decoding="async"
                  />
                </button>
              {:else if part.html}
                <div
                  class="rendered-markdown rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200"
                  style:opacity={msgOpacity}
                >
                  {@html part.html}
                </div>
              {/if}
            {/each}
            <span class="animate-pulse text-violet-300">▌</span>
          </div>
'''
if old not in text:
    raise SystemExit('streaming display block not found')
text = text.replace(old, new, 1)

text = text.replace(
    '</script>\n\n<div',
    '''</script>

<svelte:window
  onkeydown={(event) => {
    if (event.key === 'Escape' && expandedAsset) expandedAsset = null
  }}
/>

<div''',
    1,
)

marker = '''  </div>
</div>'''
overlay = '''  </div>

  {#if expandedAsset}
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={expandedAsset.name}
      onclick={() => (expandedAsset = null)}
    >
      <button
        class="icon-button absolute right-4 top-4 z-10 h-11 w-11 bg-black/60 text-white hover:bg-black/80"
        type="button"
        aria-label={i18n.t('Close')}
        onclick={() => (expandedAsset = null)}
      >
        <X size={22} />
      </button>
      <img
        class="max-h-[94vh] max-w-[94vw] rounded-lg object-contain shadow-2xl"
        src={expandedAsset.src}
        alt={expandedAsset.name}
        onclick={(event) => event.stopPropagation()}
      />
    </div>
  {/if}
</div>'''
if marker not in text:
    raise SystemExit('root closing marker not found')
text = text.rsplit(marker, 1)[0] + overlay
path.write_text(text)

path = Path('app/src/routes/CharacterAssets.svelte')
text = path.read_text().replace('{{asset:name}}', '{{asset::name}}')
text = text.replace('`{{asset:${name.trim()}}}`', '`{{asset::${name.trim()}}}`')
text = text.replace('`{{asset:${asset.name}}}`', '`{{asset::${asset.name}}}`')
path.write_text(text)

path = Path('app/tests/e2e/assets.spec.ts')
text = path.read_text()
text = text.replace('`main code:text-is("{{asset:${name}}}")`', '`main code:text-is("{{asset::${name}}}")`')
text = text.replace("app.locator('.rendered-markdown img.chat-asset')", "app.locator('button.chat-asset-frame img.chat-asset')")
path.write_text(text)

path = Path('app/tests/e2e/messages.spec.ts')
text = path.read_text()
anchor = "  test('Escape cancels and persists nothing',"
addition = '''  test('message editor opens at media-block height', async ({ app }) => {
    await app.goto('/chat/chat-1')
    await app.locator('button[aria-label="Edit message"]').first().click()

    const editor = app.locator('textarea[aria-label="Edit message"]')
    await expect(editor).toBeVisible()
    await expect(editor).toHaveCSS('min-height', '288px')
    expect(await editor.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(400)
  })

'''
if addition not in text:
    if anchor not in text:
        raise SystemExit('messages test anchor not found')
    text = text.replace(anchor, addition + anchor, 1)
path.write_text(text)
