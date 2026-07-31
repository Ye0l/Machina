<script lang="ts">
  import { apiOrigin } from '/app/lib/config'

  let {
    name,
    avatar,
    size = 'md',
  }: { name: string; avatar?: string; size?: 'sm' | 'md' | 'lg' } = $props()

  let failed = $state(false)

  const initials = $derived(
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  )
  const source = $derived(
    avatar && !failed
      ? /^(https?:|data:|blob:)/.test(avatar)
        ? avatar
        : `${apiOrigin}${avatar.startsWith('/') ? '' : '/'}${avatar}`
      : ''
  )
  const dimensions = $derived(
    size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-base' : 'h-10 w-10 text-sm'
  )
</script>

<span
  class={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-neutral-800 font-semibold text-neutral-300 ${dimensions}`}
  aria-hidden="true"
>
  {#if source}
    <img class="h-full w-full object-cover" src={source} alt="" onerror={() => (failed = true)} />
  {:else}
    {initials}
  {/if}
</span>
