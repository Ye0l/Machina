<script lang="ts">
  import { boot, session } from '/app/lib/session.svelte'
  import { chats } from '/app/lib/chats.svelte'
  import Login from '/app/routes/Login.svelte'
  import Characters from '/app/routes/Characters.svelte'
  import Chat from '/app/routes/Chat.svelte'

  let ready = $state(boot())
</script>

{#await ready}
  <main class="flex h-full items-center justify-center text-sm text-neutral-400">Loading...</main>
{:then}
  {#if session.bootError}
    <main class="flex h-full flex-col items-center justify-center gap-3">
      <p class="text-sm text-red-400">{session.bootError}</p>
      <button class="text-sm text-neutral-400 underline" onclick={() => (ready = boot())}>
        Retry
      </button>
    </main>
  {:else if !session.authed}
    <Login />
  {:else if chats.detail}
    <Chat />
  {:else}
    <Characters />
  {/if}
{/await}
