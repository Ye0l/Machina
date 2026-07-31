<script lang="ts">
  import { chats } from '/app/lib/chats.svelte'
  import { session } from '/app/lib/session.svelte'

  chats.loadCharacters()
</script>

<div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-4">
  <header class="flex items-center justify-between">
    <h1 class="text-xl font-semibold">Characters</h1>
    <button class="text-sm text-neutral-400 underline" onclick={() => session.logout()}>
      Sign out
    </button>
  </header>

  {#if chats.error}
    <p class="rounded bg-red-950 px-3 py-2 text-sm text-red-300">{chats.error}</p>
  {/if}

  {#if chats.loading && !chats.characters.length}
    <p class="text-sm text-neutral-400">Loading...</p>
  {:else if !chats.characters.length}
    <p class="text-sm text-neutral-400">No characters yet.</p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each chats.characters as character (character._id)}
        <li>
          <button
            class="flex w-full items-center gap-3 rounded border border-neutral-800 bg-background-lighter px-3 py-2 text-left hover:border-neutral-600"
            onclick={() => chats.openCharacter(character)}
          >
            <span class="flex-1">
              <span class="block font-medium">{character.name}</span>
              {#if character.description}
                <span class="block truncate text-xs text-neutral-400">
                  {character.description}
                </span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>
