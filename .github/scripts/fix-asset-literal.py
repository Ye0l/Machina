from pathlib import Path

path = Path('app/src/routes/Chat.svelte')
text = path.read_text()

text = text.replace(
    """  type RenderedBodyPart =
    | { kind: 'text'; html: string }
    | { kind: 'asset'; name: string; src: string }
""",
    """  type RenderedBodyPart =
    | { kind: 'text'; html: string }
    | { kind: 'literal'; text: string }
    | { kind: 'asset'; name: string; src: string }
""",
    1,
)

text = text.replace(
    """      if (asset) parts.push({ kind: 'asset', name, src: assetUrl(asset.uri) })
      else pushText(match[0].replace(/\\{/g, '&#123;').replace(/\\}/g, '&#125;'))
""",
    """      if (asset) parts.push({ kind: 'asset', name, src: assetUrl(asset.uri) })
      else parts.push({ kind: 'literal', text: match[0] })
""",
    1,
)

stored = """                {:else if part.html}
                  <div
                    class:bg-violet-600={isUser}
                    class:text-white={isUser}
                    class:ml-auto={isUser}
                    class=\"rendered-markdown rounded-2xl bg-[#151a23] px-4 py-3 leading-6 text-neutral-200 {isUser
                      ? 'rounded-tr-md'
                      : 'rounded-tl-md'}\"
                    style:opacity={msgOpacity}
                  >
                    <!-- Sanitised in renderMarkdown via DOMPurify. -->
                    {@html part.html}
                  </div>
                {/if}
"""
stored_new = """                {:else if part.kind === 'literal'}
                  <div
                    class:bg-violet-600={isUser}
                    class:text-white={isUser}
                    class:ml-auto={isUser}
                    class=\"asset-tag-missing rounded-2xl bg-[#151a23] px-4 py-3 font-mono text-sm leading-6 text-neutral-200 {isUser
                      ? 'rounded-tr-md'
                      : 'rounded-tl-md'}\"
                    style:opacity={msgOpacity}
                  >
                    {part.text}
                  </div>
                {:else if part.html}
                  <div
                    class:bg-violet-600={isUser}
                    class:text-white={isUser}
                    class:ml-auto={isUser}
                    class=\"rendered-markdown rounded-2xl bg-[#151a23] px-4 py-3 leading-6 text-neutral-200 {isUser
                      ? 'rounded-tr-md'
                      : 'rounded-tl-md'}\"
                    style:opacity={msgOpacity}
                  >
                    <!-- Sanitised in renderMarkdown via DOMPurify. -->
                    {@html part.html}
                  </div>
                {/if}
"""
if stored not in text:
    raise SystemExit('stored text branch not found')
text = text.replace(stored, stored_new, 1)

streaming = """              {:else if part.html}
                <div
                  class=\"rendered-markdown rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200\"
                  style:opacity={msgOpacity}
                >
                  {@html part.html}
                </div>
              {/if}
"""
streaming_new = """              {:else if part.kind === 'literal'}
                <div
                  class=\"asset-tag-missing rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 font-mono text-sm leading-6 text-neutral-200\"
                  style:opacity={msgOpacity}
                >
                  {part.text}
                </div>
              {:else if part.html}
                <div
                  class=\"rendered-markdown rounded-2xl rounded-tl-md bg-[#151a23] px-4 py-3 leading-6 text-neutral-200\"
                  style:opacity={msgOpacity}
                >
                  {@html part.html}
                </div>
              {/if}
"""
if streaming not in text:
    raise SystemExit('streaming text branch not found')
text = text.replace(streaming, streaming_new, 1)

text = text.replace(
    """      <button
        class=\"absolute inset-0 bg-black/90 backdrop-blur-sm\"
        type=\"button\"
        aria-label={i18n.t('Close')}
        onclick={() => (expandedAsset = null)}
      />
""",
    """      <button
        class=\"absolute inset-0 bg-black/90 backdrop-blur-sm\"
        type=\"button\"
        aria-label={i18n.t('Close')}
        onclick={() => (expandedAsset = null)}
      >
        <span class=\"sr-only\">{i18n.t('Close')}</span>
      </button>
""",
    1,
)
path.write_text(text)

path = Path('app/tests/e2e/assets.spec.ts')
text = path.read_text()
old = """    // Scoped by content: the greeting is the first rendered message in this chat.
    await expect(app.locator('.rendered-markdown', { hasText: 'Look:' })).toContainText(
      '{{asset::invented}}'
    )
    await expect(app.locator('img.chat-asset')).toHaveCount(0)
"""
new = """    await expect(app.locator('.rendered-markdown', { hasText: 'Look:' })).toContainText('Look:')
    await expect(app.locator('.asset-tag-missing')).toContainText('{{asset::invented}}')
    await expect(app.locator('img.chat-asset')).toHaveCount(0)
"""
if old not in text:
    raise SystemExit('unknown asset test block not found')
path.write_text(text.replace(old, new, 1))
