<script lang="ts">
  import { apiOrigin } from '/app/lib/config'
  import type { AvatarCornerRadius } from '/common/types/ui'

  let {
    name,
    avatar,
    size = 'md',
    px,
    corners,
  }: {
    name: string
    avatar?: string
    size?: 'sm' | 'md' | 'lg'
    /** Explicit pixel dimensions. Overrides `size` when provided. */
    px?: number
    corners?: AvatarCornerRadius
  } = $props()

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
    px
      ? ''
      : size === 'sm'
      ? 'h-8 w-8 text-xs'
      : size === 'lg'
      ? 'h-14 w-14 text-base'
      : 'h-10 w-10 text-sm'
  )
  const cornerClass = $derived(
    corners === 'circle'
      ? 'rounded-full'
      : corners === 'none'
      ? 'rounded-none'
      : corners === 'sm'
      ? 'rounded'
      : corners === 'md'
      ? 'rounded-lg'
      : corners === 'lg'
      ? 'rounded-2xl'
      : 'rounded-xl'
  )
</script>

<span
  class={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-neutral-800 font-semibold text-neutral-300 ${cornerClass} ${dimensions}`}
  style:width={px ? `${px}px` : undefined}
  style:height={px ? `${px}px` : undefined}
  style:font-size={px ? `${Math.max(10, Math.round(px * 0.35))}px` : undefined}
  aria-hidden="true"
>
  {#if source}
    <img class="h-full w-full object-cover" src={source} alt="" onerror={() => (failed = true)} />
  {:else}
    {initials}
  {/if}
</span>
