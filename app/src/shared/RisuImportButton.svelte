<script lang="ts">
  import { Upload } from '@lucide/svelte'
  import { presetDefaults } from '/common/default-preset'
  import { importRisuPreset, isRisuPresetFilename } from '/common/risu-import'
  import type { AppSchema } from '/common/types'
  import { api } from '/app/lib/api'
  import { i18n } from '/app/lib/i18n.svelte'
  import { router } from '/app/lib/router.svelte'
  import { serviceForProvider } from '/app/lib/settings.svelte'
  import { session } from '/app/lib/session.svelte'

  let input: HTMLInputElement | null = null
  let importing = $state(false)
  let message = $state('')

  const route = $derived(router.route)
  const visible = $derived(route.name === 'settings' && route.tab === 'presets')
  const providers = $derived(session.user?.providers ?? [])

  async function chooseFile(event: Event) {
    const target = event.currentTarget as HTMLInputElement
    const file = target.files?.[0]
    target.value = ''
    if (!file) return

    message = ''
    if (!isRisuPresetFilename(file.name)) {
      message = i18n.t('Choose a .risup or .risupreset file.')
      return
    }

    const provider = providers[0]
    if (!provider) {
      message = i18n.t('Add a provider before importing a preset.')
      return
    }

    importing = true
    try {
      const imported = await importRisuPreset(new Uint8Array(await file.arrayBuffer()), file.name)
      const model = imported.thirdPartyModel ?? imported.oaiModel ?? ''
      const created = await api.post<AppSchema.UserGenPreset>('/user/presets', {
        ...presetDefaults,
        ...imported,
        name: imported.name.trim() || 'RisuAI Preset',
        service: serviceForProvider(provider),
        providerId: provider._id,
        providerModels: { ...(imported.providerModels ?? {}), [provider._id]: model },
        presetMode: 'advanced',
        useAdvancedPrompt: 'no-validation',
        promptTemplateId: undefined,
      })

      session.presets = [...session.presets, created]
      if (session.user && !session.user.defaultPreset) {
        session.user = { ...session.user, defaultPreset: created._id }
      }
      message = i18n.t('RisuAI preset imported.')
    } catch (ex) {
      message = ex instanceof Error ? ex.message : i18n.t('Could not import the RisuAI preset.')
    } finally {
      importing = false
    }
  }
</script>

{#if visible}
  <div
    class="fixed bottom-5 left-5 z-30 flex max-w-[min(28rem,calc(100vw-2rem))] flex-col items-start gap-2"
  >
    {#if message}
      <p
        class="rounded-lg border border-neutral-700 bg-[#10151d]/95 px-3 py-2 text-xs text-neutral-200 shadow-xl backdrop-blur"
        aria-live="polite"
      >
        {message}
      </p>
    {/if}
    <input
      bind:this={input}
      class="hidden"
      type="file"
      accept=".risup,.risupreset,application/octet-stream"
      onchange={chooseFile}
    />
    <button
      class="button-secondary shadow-xl"
      type="button"
      disabled={!providers.length || importing}
      onclick={() => input?.click()}
    >
      <Upload size={17} />
      {importing ? i18n.t('Importing...') : i18n.t('Import RisuAI preset')}
    </button>
  </div>
{/if}
