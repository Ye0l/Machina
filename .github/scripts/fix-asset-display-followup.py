from pathlib import Path

path = Path('app/src/routes/Chat.svelte')
text = path.read_text()

old = """      if (asset) parts.push({ kind: 'asset', name, src: assetUrl(asset.uri) })
      else pushText(match[0])
"""
new = """      if (asset) parts.push({ kind: 'asset', name, src: assetUrl(asset.uri) })
      else pushText(match[0].replace(/\\{/g, '&#123;').replace(/\\}/g, '&#125;'))
"""
if old not in text:
    raise SystemExit('unknown asset fallback not found')
text = text.replace(old, new, 1)

old = '''  {#if expandedAsset}
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
'''
new = '''  {#if expandedAsset}
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={expandedAsset.name}
      tabindex="-1"
    >
      <button
        class="absolute inset-0 bg-black/90 backdrop-blur-sm"
        type="button"
        aria-label={i18n.t('Close')}
        onclick={() => (expandedAsset = null)}
      ></button>
      <div class="relative z-10 flex max-h-[94vh] max-w-[94vw] items-center justify-center">
        <button
          class="icon-button absolute right-0 top-0 z-10 h-11 w-11 -translate-y-1/2 translate-x-1/2 bg-black/70 text-white hover:bg-black/90"
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
        />
      </div>
    </div>
  {/if}
'''
if old not in text:
    raise SystemExit('asset overlay block not found')
text = text.replace(old, new, 1)
path.write_text(text)

path = Path('app/tests/e2e/character-port.spec.ts')
text = path.read_text()
text = text.replace('{{asset:smiling}}', '{{asset::smiling}}')
text = text.replace('{{asset:main}}', '{{asset::main}}')
path.write_text(text)
