# Character Import and Export

The Svelte client could only create characters by hand — there was no way to bring an
existing library in, or to get a character back out. Both are restored here, porting the
legacy client's implementation (`web/pages/Character/port.ts`, `card-utils.ts`, and the
download helpers in `util.ts`).

No server contract changed and no dependency was added: `png-chunks-extract`,
`png-chunks-encode`, `png-chunk-text` and `exifreader` were already present for the legacy
frontend, and the export shapes come from `common/characters.ts` (`exportCharacter`), which
both frontends share.

## Bytes, not Buffers

The one deliberate difference from the legacy code: everything works in `Uint8Array`. The
legacy path used `Buffer`, which Parcel polyfilled for the browser and Vite does not.
`app/src/ambient.d.ts` re-declares the three PNG modules against `Uint8Array` — `common/module.d.ts`
types them with `Buffer` and is not in this project's `include`.

## Import

**Entry point**: an Import button in the character library, accepting
`.json`, `.png`, `.apng`, `.jpg`, `.jpeg`, `.webp`.

**Formats recognised** (`detectFormat`, matching the legacy detector):

| Source                 | Detected by                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| Agnai native           | `kind === 'character'`, or name/persona/greeting/scenario all present |
| Character Card V2 / V3 | `spec === 'chara_card_v2'` / `'chara_card_v3'`                        |
| TavernAI V1            | `mes_example` present                                                 |
| TextGen (ooba)         | `char_name` present                                                   |
| Charas                 | `extensions.charas` present                                           |

**Card extraction**: PNG/APNG/JPEG cards carry base64 JSON in a `chara` tEXt chunk; WEBP
cards keep the same JSON in EXIF `UserComment`, in either the older raw-JSON form or the
newer byte-array form. For image imports the image itself becomes the character's avatar.

**Persona**: a V2 card may carry a lossless Agnai persona in `extensions.agnai.persona`, but
another editor may have rewritten `description` since. The structured persona is trusted only
when re-formatting it through `formatCharacter` still reproduces the card's `description`;
otherwise the persona is rebuilt from `description` + `personality`. This is the legacy rule.

**Text normalisation**: escaped `\n` is unescaped and the `You:` convention is rewritten to
`{{user}}:`, as the legacy importer did, so cards written for other frontends read correctly.

**Review before saving**: an import routes to `/character/new` with the editor pre-filled
rather than creating the character outright. The empty-form snapshot is taken _before_ the
import is applied, so the draft registers as unsaved work and the navigation guard protects
it.

**Nothing is dropped silently.** Recognised data the editor cannot represent is listed back
to the user in a notice on the editor — currently Character Card V3 asset manifests.

**Character books are carried.** A card's `character_book` becomes the new character's own
`characterBook`, which is what the workspace's Memory book tab edits and what
`common/prompt.ts` injects whenever the character replies. Two shapes reach the importer —
the V2 card's (`keys`/`content`), converted by `characterBookToNative` from
`common/memory.ts`, and Agnai's own (`keywords`/`entry`) from a native export — and both are
then re-checked field by field, because every field the converter leaves optional is required
by the server's book validator (`srv/api/memory/index.ts`) and a hand-written card is under
no obligation to supply them. Entries with no text are dropped, as are entries with no keyword
unless the card marked them constant — see `docs/memory-books.md`. A book whose entries are all unusable is reported in the "not carried over"
notice instead, so an empty book is never silently saved.

The editor has no entry UI of its own — the character does not exist yet, so there is nothing
to attach a book to. The book is held on the draft and written with the other deferred fields
once the character has an id, and the notice says how many entries are coming.

## Export

Offered in the editor for a character that already exists on the server. It exports the
**saved** character, not the current draft: a card claiming to be a character that does not
exist would be misleading.

- **Tavern card (PNG)** — the character's avatar with the V2 card JSON embedded in a `chara`
  tEXt chunk. Existing tEXt chunks are dropped and the new one is inserted before `IEND`,
  which must stay last for the file to remain valid. An already-PNG avatar keeps its exact
  bytes; anything else is re-encoded through a canvas. A character with no avatar gets a
  generated placeholder image, since the JSON has to ride inside a real PNG.
- **Tavern V2 (JSON)**, **TextGen (JSON)** — `exportCharacter` from the shared layer.
- **Agnai (JSON)** — the native record with `_id` stripped.

## Also changed

Avatar URL resolution moved out of `CharacterAvatar.svelte` into `assetUrl()` in
`app/src/lib/config.ts`, since the card exporter needs the same rule.

## Verification

- `pnpm run check` (prettier, tsc, svelte-check, mocha) passes; 72 tests. `pnpm run build`
  passes.
- Driven in Chromium against the production build with a stub API — 40 checks total (the
  previous 29 plus 11 here), all passing. Card fixtures were built with the same PNG chunk
  libraries the app uses:
  - A PNG card with an embedded `chara` chunk routes to the editor with the card's name,
    tags and alternate greetings applied.
  - Its `character_book` is announced in the import notice, counting only the entries that
    survived (the fixture's keyword-less entry is dropped).
  - Saving that draft sends the book as the new character's `characterBook`, and opening the
    workspace's Memory book tab shows the entries the card carried.
  - An unsaved import is protected by the navigation guard.
  - The same card as `.json` fills the editor identically.
  - An unrecognised JSON file reports an error and does not navigate.
  - **Round trip**: exporting Aria as a PNG card yields `Aria.card.png`, whose first eight
    bytes are the PNG signature and whose embedded chunk parses back as a `chara_card_v2`
    card naming Aria.
  - Native JSON export yields `Aria.json` with `_id` absent.

## Residual risk and follow-ups

- Covered by `app/tests/unit/character-port.spec.ts` and `app/tests/e2e/character-port.spec.ts`
  since the client gained test runners (`docs/testing-and-ci.md`). `buildCharacterCard` and
  `toPngBytes` still have no unit coverage, because they need a real canvas; the export browser
  test exercises them end to end instead.
- CHARX / Character Card V3 remains unstarted, as recorded in
  `docs/prompt-presets-and-display-settings.md`. A V3 card's JSON is read here because its
  `data` block is V2-shaped, but its `assets` manifest is not, and `.charx` archives are not
  accepted at all.
- Import handles one file at a time; the legacy client accepted several.
- The importer trusts the card's JSON structure. It is parsed, not evaluated, and every
  imported string reaches the DOM through Svelte's escaping or the sanitiser in
  `renderMarkdown`, but there is no schema validation and no size limit on an imported field.
- Chub browsing/download (`web/pages/Chub`) was not ported.
