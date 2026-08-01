<script lang="ts">
  import { Pencil, Plus, UserRound } from '@lucide/svelte'
  import { personas } from '/app/lib/personas.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { isRouterClick, router, routes } from '/app/lib/router.svelte'

  const link = (path: string) => (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    router.go(path)
  }

  const personaText = (persona: { kind: string; attributes: Record<string, string[]> }) =>
    persona.kind === 'text'
      ? persona.attributes.text?.[0] ?? ''
      : Object.entries(persona.attributes)
          .map(([key, values]) => `${key}: ${values.join(', ')}`)
          .join(' · ')
</script>

<div class="flex h-full min-h-0 flex-col overflow-y-auto">
  <div class="mx-auto w-full max-w-6xl px-4 py-5 lg:px-8 sm:px-6 sm:py-7">
    <header
      class="flex flex-col gap-4 border-b border-neutral-800/80 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p class="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-violet-400">
          {i18n.t('Library')}
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-white">{i18n.t('Personas')}</h1>
        <p class="mt-1 text-sm text-neutral-500">
          {i18n.t('Who you are in a conversation. Pick one in any chat.')}
        </p>
      </div>
      <a
        class="button-primary self-start sm:self-auto"
        href={routes.newPersona()}
        onclick={link(routes.newPersona())}
      >
        <Plus size={17} />
        {i18n.t('New persona')}
      </a>
    </header>

    {#if personas.error}
      <div class="error-banner mt-4" role="alert">{personas.error}</div>
    {/if}

    {#if personas.loading && !personas.list.length}
      <div class="mt-12 flex items-center justify-center gap-2 text-sm text-neutral-500">
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
          ><span class="sr-only">{i18n.t('Loading')}</span></span
        >
        {i18n.t('Loading personas')}
      </div>
    {:else if !personas.list.length}
      <div
        class="mt-12 flex flex-col items-center border-y border-neutral-800/80 py-12 text-center"
      >
        <span
          class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-500"
        >
          <UserRound size={22} />
        </span>
        <h2 class="text-base font-semibold text-neutral-200">{i18n.t('No personas yet')}</h2>
        <p class="mt-1 max-w-md text-sm text-neutral-500">
          {i18n.t('A persona describes you to the model, the way a character describes a bot.')}
        </p>
        <a
          class="button-primary mt-5"
          href={routes.newPersona()}
          onclick={link(routes.newPersona())}
        >
          <Plus size={17} />
          {i18n.t('Create persona')}
        </a>
      </div>
    {:else}
      <ul class="mt-5 grid gap-3 lg:grid-cols-3 sm:grid-cols-2">
        {#each personas.list as persona (persona._id)}
          <li class="rounded-xl border border-neutral-800 bg-[#10141c] p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="truncate text-sm font-semibold text-neutral-100">{persona.name}</h2>
                {#if personas.selectedId === persona._id}
                  <span
                    class="mt-1 inline-block rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-200"
                    >{i18n.t('In use')}</span
                  >
                {/if}
              </div>
              <a
                class="icon-button shrink-0"
                href={routes.persona(persona._id)}
                aria-label={i18n.t('Edit {name}', { name: persona.name })}
                onclick={link(routes.persona(persona._id))}
              >
                <Pencil size={16} />
              </a>
            </div>
            <p class="mt-2 line-clamp-3 whitespace-pre-wrap text-xs text-neutral-500">
              {personaText(persona.persona) || i18n.t('No description')}
            </p>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
