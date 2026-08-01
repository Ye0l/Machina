# Memory Books

The server had complete memory-book CRUD (`srv/api/memory`), `common/memory.ts` implemented
the matching and budgeting, `common/prompt.ts` accepted books, and the preset editor already
listed `memory` as a prompt section — but the Svelte client had no way to create a book, and
never passed one to the prompt assembler. A book could not be authored, attached, or used.

All three gaps are closed here. No server contract changed and no dependency was added.

## The wiring that made it real

`app/src/lib/generate.ts` called `createPromptParts` without `book`. Even a chat with
`memoryId` already set would have generated with no memory. Both call sites now take an
optional book, resolved by `Chats.memoryBook()` from `chat.memoryId`.

Only the chat-level book is passed: `common/prompt.ts` folds in the character's own
`characterBook` separately, so supplying it here would inject it twice.

## Routes

| Path          | View                  |
| ------------- | --------------------- |
| `/memory`     | Book library          |
| `/memory/new` | Book editor, empty    |
| `/memory/:id` | Book editor for `:id` |

## Editor

Entries are a collapsible list. Each has an enabled toggle, keywords, entry text, priority
and weight, plus reorder and delete. The hints state what priority and weight actually do
(lowest priority is dropped first when the budget is tight; highest weight sits last, nearest
the reply), because the names alone do not say.

Two rules are enforced on save:

- Entries with no text are dropped, as are entries with no keywords unless they are marked
  always-included. Either way saving them would be storing something dead.
- A book must have at least one usable entry.

Keywords are de-duplicated case-insensitively, matching how `common/memory.ts` compares them.

**V2 fields are preserved.** The server replaces `entries` wholesale but only `$set`s name,
description and entries, so book-level fields (`scanDepth`, `tokenBudget`,
`recursiveScanning`, `extensions`) survive on their own. Per-entry fields (`id`, `comment`,
`secondaryKeys`) would not, so the editor keeps whole entry objects and sends them back
rather than rebuilding entries from the fields it exposes.

## Attaching to a chat

A picker in the chat header, next to the preset picker, appears once at least one book
exists. It writes `memoryId` through `PUT /chat/:id`, which validates partially, so nothing
else on the chat is touched. Selecting the empty option detaches.

## Also changed

- The unsaved-changes guard now covers any editor route rather than the character editor
  specifically, so book edits are protected the same way. Its message became
  "Discard your unsaved changes?".
- `AppShell` loads books alongside characters, because the chat's picker needs them outside
  the `/memory` route.

## Fixed while implementing

`books.load()` originally guarded re-entry with a boolean and returned early while a request
was in flight. Opening `/memory/:id` directly calls it twice on the same tick — once from the
shell, once from the editor — so the editor fell through to an empty list and reported the
book as missing. The guard is now the in-flight promise, which concurrent callers await. This
is the same failure mode found earlier in `chats.loadCharacters` and recorded in
`docs/client-routing.md`.

## Verification

- `pnpm run check` (prettier, tsc, svelte-check, mocha) passes; 72 tests. `pnpm run build`
  passes.
- Driven in Chromium against the production build — 48 checks total (the previous 40 plus 8
  here), all passing. The harness gained a WebSocket server so the real generation path runs:
  the client authenticates the socket, posts its assembled prompt to
  `/chat/inference-stream`, and receives the reply over the socket.
  - The `/memory` empty state, `/memory/new`, and a `/memory/:id` deep link all render.
  - Creating a book POSTs name, description and the entry with its keyword, then returns to
    the list.
  - Attaching a book PUTs `memoryId` on the chat.
  - **The prompt is asserted directly**: a conversation with no keyword produces a prompt
    without the entry text; a message mentioning `dragon` produces a prompt containing
    `MEMORY-DRAGON-FACT`; detaching the book removes it again even though the keyword is
    still in recent history.

## Always-included entries

`MemoryEntry.constant` was already in the schema and was already round-tripped by card import
and export — `common/memory.ts` simply never read it when matching, so the flag was inert
wherever it came from. `findMatchWithLowestAge` now treats a constant entry as matched
regardless of its keywords.

It is aged as if the newest message had triggered it: it is relevant right now, and the token
budget is still shared, so `priority` stays the lever for what survives a tight one. Disabled
still wins over constant, and a constant entry that does not fit the context limit is dropped
like any other match.

The three places that dropped keywordless entries as dead — the book editor, a character's own
book, and the card importer — now keep them when they are constant. That is the only way to
write lore with nothing to hang a keyword off.

Covered by `tests/memory-constant.spec.ts` (6, asserting on the built memory prompt) and one
browser test that saves a keywordless entry and finds its text in the assembled prompt.

## Residual risk and follow-ups

- The editor does not expose `scanDepth`, `tokenBudget` or `recursiveScanning`. They are
  preserved, not editable — the API's own validator does not accept them either.
- Long-term memory / embeddings (`chat_embed`, `userEmbedId`) are untouched.
- Deleting a book that is attached to a chat leaves a dangling `memoryId`. This is handled at
  read time — `memoryBook()` resolves through the loaded list and yields nothing when the
  book is gone, and the picker falls back to "No memory book" — but the stale id stays on the
  chat record.
