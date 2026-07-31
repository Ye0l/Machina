<script lang="ts">
  import { session } from '/app/lib/session.svelte'
  import { i18n } from '/app/lib/i18n.svelte'

  let username = $state('')
  let password = $state('')

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    if (!username || !password) return
    session.login(username, password)
  }
</script>

<main class="flex h-full items-center justify-center p-4">
  <form class="flex w-full max-w-sm flex-col gap-4" onsubmit={submit}>
    <h1 class="text-center text-2xl font-semibold">{i18n.t('Agnai')}</h1>

    <label class="flex flex-col gap-1 text-sm">
      {i18n.t('Username')}
      <input
        class="rounded border border-neutral-700 bg-background-lighter px-3 py-2 outline-none focus:border-neutral-500"
        bind:value={username}
        autocomplete="username"
      />
    </label>

    <label class="flex flex-col gap-1 text-sm">
      {i18n.t('Password')}
      <input
        class="rounded border border-neutral-700 bg-background-lighter px-3 py-2 outline-none focus:border-neutral-500"
        type="password"
        bind:value={password}
        autocomplete="current-password"
      />
    </label>

    {#if session.error}
      <p class="rounded bg-red-950 px-3 py-2 text-sm text-red-300">{session.error}</p>
    {/if}

    <button
      class="rounded bg-purple-700 px-3 py-2 font-medium disabled:opacity-50"
      type="submit"
      disabled={session.loading}
    >
      {session.loading ? i18n.t('Signing in...') : i18n.t('Login')}
    </button>
  </form>
</main>
