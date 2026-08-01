# User Personas

Who _you_ are in a conversation, as a first-class entity rather than a character borrowed from
your library.

## Why this needed a server change

Agnai had no persona entity. `impersonate` on a send is an `AppSchema.Character`
(`srv/api/chat/message.ts`), and `Profile` holds only a handle and an avatar — there was
nowhere to put a persona description. The earlier Svelte implementation therefore made a
persona "one of your own characters", which conflated two different things: a character is
someone you talk _to_.

A `persona` collection now exists alongside the others.

| Piece        | Location                                                                               |
| ------------ | -------------------------------------------------------------------------------------- |
| Type         | `common/types/persona.ts`, exported as `AppSchema.UserPersona`                         |
| Storage      | `srv/db/persona.ts`, indexed on `userId`                                               |
| Routes       | `srv/api/persona.ts` — `GET/POST /persona`, `POST /persona/:id`, `DELETE /persona/:id` |
| Client store | `app/src/lib/personas.svelte.ts`                                                       |
| Screens      | `/persona`, `/persona/new`, `/persona/:id`                                             |

The persona text is stored in the same `AppSchema.Persona` shape a character uses, so it
reaches the prompt through the existing `{{impersonating}}` path with no special casing.

## How a persona rides `impersonate`

`common/persona.ts` converts a stored persona into the character shape the send endpoint and
the prompt assembler expect. The id it produces is prefixed `temp-persona-`, and that prefix
is load-bearing:

`ensureBotMembership` (`srv/api/chat/message.ts:511`) looks the impersonate id up in the
character collection and answers **403** when it is not a character the caller owns — which a
persona never is. The same function deliberately skips that check for ids beginning `temp-`,
which is the seam a persona travels through. The prefix stays parseable (`fromImpersonateId`)
because the server stamps `characterId` on the stored message with whatever id it is given.

No message-path code was changed to make this work.

## Behaviour

- The picker in the chat header lists personas only. Empty means the account profile, which is
  a real choice rather than a placeholder.
- It renders even with no personas to pick, disabled, pointing at the sidebar. Hiding it left
  no trace of the feature for a new account, which is how the previous version went unnoticed.
- The selection is client-side (`localStorage`): the server accepts `impersonate` per request
  and stores no preference.
- Selection resolves _through_ the loaded list, so a persona deleted anywhere stops applying
  rather than lingering as a dead id.
- Personas never appear in the character library and cannot be chatted with.

## Verification

- `pnpm run check` passes. 92 Vitest, 78 mocha, 61 Playwright.
- `app/tests/unit/persona.spec.ts` (7) covers the conversion, including that the id is
  `temp-` prefixed and round-trips.
- `app/tests/e2e/persona.spec.ts` (8): create/list/edit on the persona route; personas absent
  from the character library; the picker's empty state; **the assembled prompt containing the
  persona text** and the send carrying `temp-persona-…` as `impersonate._id`; an impersonated
  message rendering on the user's side; selection surviving a reload; and a deleted persona
  deselecting itself.

## Residual risk and follow-ups

- **The server-side persona routes have never run against MongoDB.** There is no Mongo in this
  environment; the browser tests drive a stub. The type checks and the route shape are
  verified, the storage layer is not.
- **A persona cannot carry its own memory book.** The previous character-based version could,
  because a character has `characterBook` — `common/prompt.ts` still injects
  `impersonate.characterBook` and would pick one up if a persona ever gained the field. Adding
  it means a field on the entity plus entry-editing UI, which was not part of this change.
- Personas have no avatar yet. The field exists on the entity and on the converted character;
  nothing sets it.
- Existing users who selected a character as their persona lose that selection: the stored id
  is now looked up among personas and simply does not resolve. No migration is attempted,
  since the old selection was client-side only.
