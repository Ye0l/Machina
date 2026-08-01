<script lang="ts">
  import { session } from '/app/lib/session.svelte'
  import { i18n } from '/app/lib/i18n.svelte'

  let mode = $state<'login' | 'register'>('login')
  let username = $state('')
  let password = $state('')
  let handle = $state('')
  let confirm = $state('')
  let localError = $state('')

  const registering = $derived(mode === 'register')

  const setMode = (next: 'login' | 'register') => {
    mode = next
    localError = ''
    session.error = ''
  }

  const submit = (event: SubmitEvent) => {
    event.preventDefault()
    localError = ''

    if (!username || !password) return

    if (!registering) {
      session.login(username, password)
      return
    }

    if (!handle.trim()) {
      localError = i18n.t('Enter a display name.')
      return
    }
    if (password !== confirm) {
      localError = i18n.t('Passwords do not match.')
      return
    }

    session.register(handle.trim(), username, password)
  }
</script>

<main class="flex h-full items-center justify-center p-4">
  <form class="flex w-full max-w-sm flex-col gap-4" onsubmit={submit}>
    <h1 class="text-center text-2xl font-semibold">{i18n.t('Agnai')}</h1>

    {#if session.canAuth}
      <div class="flex rounded-lg border border-neutral-700 p-1" role="tablist">
        <button
          class:bg-neutral-800={!registering}
          class:text-white={!registering}
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-400 transition"
          type="button"
          role="tab"
          aria-selected={!registering}
          onclick={() => setMode('login')}
        >
          {i18n.t('Login')}
        </button>
        <button
          class:bg-neutral-800={registering}
          class:text-white={registering}
          class="flex-1 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-400 transition"
          type="button"
          role="tab"
          aria-selected={registering}
          onclick={() => setMode('register')}
        >
          {i18n.t('Register')}
        </button>
      </div>
    {/if}

    {#if registering}
      <label class="flex flex-col gap-1 text-sm">
        {i18n.t('Display name')}
        <input
          class="rounded border border-neutral-700 bg-background-lighter px-3 py-2 outline-none focus:border-neutral-500"
          bind:value={handle}
          maxlength="80"
          autocomplete="nickname"
        />
        <span class="text-xs text-neutral-500">{i18n.t('Shown to characters as your name.')}</span>
      </label>
    {/if}

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
        autocomplete={registering ? 'new-password' : 'current-password'}
      />
    </label>

    {#if registering}
      <label class="flex flex-col gap-1 text-sm">
        {i18n.t('Confirm password')}
        <input
          class="rounded border border-neutral-700 bg-background-lighter px-3 py-2 outline-none focus:border-neutral-500"
          type="password"
          bind:value={confirm}
          autocomplete="new-password"
        />
      </label>
    {/if}

    {#if localError || session.error}
      <p class="rounded bg-red-950 px-3 py-2 text-sm text-red-300" role="alert">
        {localError || session.error}
      </p>
    {/if}

    <button
      class="rounded bg-purple-700 px-3 py-2 font-medium disabled:opacity-50"
      type="submit"
      disabled={session.loading}
    >
      {#if session.loading}
        {registering ? i18n.t('Creating account...') : i18n.t('Signing in...')}
      {:else}
        {registering ? i18n.t('Create account') : i18n.t('Login')}
      {/if}
    </button>
  </form>
</main>
