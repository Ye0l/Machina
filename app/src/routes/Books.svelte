<script lang="ts">
  import { BookOpen, Pencil, Plus } from '@lucide/svelte'
  import { books } from '/app/lib/books.svelte'
  import { i18n } from '/app/lib/i18n.svelte'
  import { isRouterClick, router, routes } from '/app/lib/router.svelte'

  const link = (path: string) => (event: MouseEvent) => {
    if (!isRouterClick(event)) return
    event.preventDefault()
    router.go(path)
  }

  const enabledCount = (entries: { enabled: boolean }[]) =>
    entries.filter((entry) => entry.enabled).length
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
        <h1 class="text-2xl font-semibold tracking-tight text-white">{i18n.t('Memory books')}</h1>
        <p class="mt-1 text-sm text-neutral-500">
          {i18n.t('Keyword-triggered notes injected into the prompt when they come up.')}
        </p>
      </div>
      <a
        class="button-primary self-start sm:self-auto"
        href={routes.newBook()}
        onclick={link(routes.newBook())}
      >
        <Plus size={17} />
        {i18n.t('New book')}
      </a>
    </header>

    {#if books.error}
      <div class="error-banner mt-4" role="alert">{books.error}</div>
    {/if}

    {#if books.loading && !books.books.length}
      <div class="mt-12 flex items-center justify-center gap-2 text-sm text-neutral-500">
        <span
          class="h-4 w-4 animate-spin rounded-full border-2 border-neutral-700 border-t-violet-400"
          ><span class="sr-only">{i18n.t('Loading')}</span></span
        >
        {i18n.t('Loading memory books')}
      </div>
    {:else if !books.books.length}
      <div
        class="mt-12 flex flex-col items-center border-y border-neutral-800/80 py-12 text-center"
      >
        <span
          class="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-neutral-500"
        >
          <BookOpen size={22} />
        </span>
        <h2 class="font-medium text-neutral-200">{i18n.t('No memory books yet')}</h2>
        <p class="mt-1 max-w-sm text-sm text-neutral-500">
          {i18n.t('Create a book of keyword-triggered entries, then attach it to a chat.')}
        </p>
        <a class="button-secondary mt-5" href={routes.newBook()} onclick={link(routes.newBook())}>
          <Plus size={17} />
          {i18n.t('Create memory book')}
        </a>
      </div>
    {:else}
      <ul class="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {#each books.books as book (book._id)}
          <li
            class="flex min-w-0 items-center gap-3 rounded-xl border border-neutral-800 bg-[#10141c] p-3 transition hover:border-neutral-700 hover:bg-[#131822]"
          >
            <span
              class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300"
            >
              <BookOpen size={20} />
            </span>
            <div class="min-w-0 flex-1">
              <h2 class="truncate font-medium text-neutral-100">{book.name}</h2>
              <p class="mt-1 truncate text-sm text-neutral-500">
                {book.description || i18n.t('No description')}
              </p>
              <p class="mt-1 text-xs tabular-nums text-neutral-600">
                {i18n.t('{enabled} of {total} entries enabled', {
                  enabled: enabledCount(book.entries ?? []),
                  total: (book.entries ?? []).length,
                })}
              </p>
            </div>
            <a
              class="icon-button shrink-0"
              href={routes.book(book._id)}
              aria-label={i18n.t('Edit {name}', { name: book.name })}
              title={i18n.t('Edit book')}
              onclick={link(routes.book(book._id))}
            >
              <Pencil size={17} />
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>
