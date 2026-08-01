<script lang="ts">
  import { ImagePlus, Trash2 } from '@lucide/svelte'
  import type { AppSchema } from '/common/types'
  import { api } from '/app/lib/api'
  import { assetUrl } from '/app/lib/config'
  import { i18n } from '/app/lib/i18n.svelte'

  /**
   * Images the character can show mid-reply.
   *
   * The name is the whole interface to the model: it is told the names and asked to emit
   * `{{asset:name}}`, which the chat swaps for the image. So the name is the field that gets
   * the explanation, not the file.
   */
  let {
    character,
    onSaved,
  }: {
    character: AppSchema.Character
    onSaved: (character: AppSchema.Character) => void
  } = $props()

  let fileInput = $state<HTMLInputElement>()
  let name = $state('')
  let pending = $state<File | null>(null)
  let preview = $state('')
  let busy = $state(false)
  let error = $state('')

  const assets = $derived(character.assets ?? [])

  // Revoke the object URL when it is replaced or the tab unmounts.
  $effect(() => {
    const url = preview
    return () => {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
    }
  })

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    pending = file
    preview = URL.createObjectURL(file)
    // The filename is the obvious first guess at a name, minus its extension.
    if (!name.trim()) name = file.name.replace(/\.[^.]+$/, '')
  }

  /** The API only accepts base64 images, the same as the avatar path. */
  function toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error(i18n.t('Could not read file')))
      reader.readAsDataURL(file)
    })
  }

  function clearPending() {
    pending = null
    preview = ''
    name = ''
  }

  async function upload() {
    const trimmed = name.trim()
    error = ''
    if (!pending) {
      error = i18n.t('Choose an image first.')
      return
    }
    if (!trimmed) {
      error = i18n.t('Enter an asset name.')
      return
    }

    busy = true
    try {
      const updated = await api.post<AppSchema.Character>(`/character/${character._id}/assets`, {
        name: trimmed,
        image: await toDataUrl(pending),
      })
      onSaved(updated)
      clearPending()
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to save asset')
    } finally {
      busy = false
    }
  }

  async function remove(asset: AppSchema.CharacterAsset) {
    if (!window.confirm(i18n.t('Delete "{name}"? This cannot be undone.', { name: asset.name })))
      return

    busy = true
    error = ''
    try {
      const updated = await api.del<AppSchema.Character>(
        `/character/${character._id}/assets/${encodeURIComponent(asset.name)}`
      )
      onSaved(updated)
    } catch (ex) {
      error = ex instanceof Error ? ex.message : i18n.t('Failed to delete asset')
    } finally {
      busy = false
    }
  }
</script>

<div class="space-y-5">
  <p class="text-sm text-neutral-500">
    {i18n.t('Images this character can show. It is told the names and shows one by writing a tag.')}
  </p>

  {#if error}
    <div class="error-banner" role="alert">{error}</div>
  {/if}

  <div class="space-y-4 rounded-xl border border-neutral-800/80 bg-neutral-900/30 p-4">
    <div class="flex flex-wrap items-end gap-3">
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        class="hidden"
        onchange={onFileChange}
      />
      <button class="button-secondary" type="button" onclick={() => fileInput?.click()}>
        <ImagePlus size={16} />
        {preview ? i18n.t('Replace') : i18n.t('Choose image')}
      </button>
      <label class="field-group min-w-[12rem] flex-1">
        <span class="field-label">{i18n.t('Asset name')}</span>
        <input
          class="field"
          bind:value={name}
          maxlength="60"
          placeholder={i18n.t('e.g. smiling')}
          autocomplete="off"
        />
      </label>
      <button class="button-primary" type="button" disabled={busy} onclick={upload}>
        {busy ? i18n.t('Saving...') : i18n.t('Add asset')}
      </button>
    </div>

    {#if preview}
      <div class="flex items-center gap-3">
        <img class="h-20 w-20 rounded-lg object-cover" src={preview} alt={name} />
        <button class="button-secondary" type="button" onclick={clearPending}>
          {i18n.t('Discard changes')}
        </button>
      </div>
    {/if}

    {#if name.trim()}
      <p class="text-xs text-neutral-500">
        {i18n.t('The character shows it by writing')}
        <code class="rounded bg-neutral-800 px-1 py-0.5 text-neutral-300"
          >{`{{asset:${name.trim()}}}`}</code
        >
      </p>
    {/if}
  </div>

  {#if assets.length}
    <ul class="grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
      {#each assets as asset (asset.name)}
        <li class="rounded-xl border border-neutral-800 bg-[#10141c] p-3">
          <img
            class="mb-2 h-32 w-full rounded-lg object-cover"
            src={assetUrl(asset.uri)}
            alt={asset.name}
          />
          <div class="flex items-center justify-between gap-2">
            <code class="min-w-0 truncate text-xs text-neutral-300"
              >{`{{asset:${asset.name}}}`}</code
            >
            <button
              class="icon-button h-8 w-8 shrink-0 text-neutral-600 hover:text-red-300"
              type="button"
              disabled={busy}
              aria-label={i18n.t('Remove {name}', { name: asset.name })}
              onclick={() => remove(asset)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </li>
      {/each}
    </ul>
  {:else}
    <p
      class="rounded-xl border border-neutral-800 bg-[#10141c] px-4 py-8 text-center text-sm text-neutral-500"
    >
      {i18n.t('No assets. This character has no images to show.')}
    </p>
  {/if}
</div>
