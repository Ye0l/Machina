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
`.json`, `.png`, `.apng`, `.jpg`, `.jpeg`, `.webp`, `.charx`.

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
to the user in a notice on the editor — currently the assets a bare V3 card names but does not
carry, and any a CHARX stores outside itself.

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

## CHARX

A `.charx` is a ZIP holding `card.json` (a Character Card V3) and the files its `assets`
entries point at. Asset URIs use the scheme `embeded://` — the misspelling is the V3 spec's —
with a path relative to the archive root. `jszip` was already a dependency for the legacy
client's bulk export, so nothing new was added.

The V3 asset typed `icon` and named `main` becomes the character's **avatar**. Everything else
becomes a character asset (`docs/character-assets.md`), uploaded one request at a time once the
character has an id — the same deferred pattern the memory book uses, for the same reason.

`ccdefault:`, `http(s)://` and `data:` URIs are legal in V3 and are not in the archive. Those
are counted and reported in the import notice rather than fetched: importing a card should not
make requests to whatever host the card names.

**An archive is attacker-supplied input**, so what gets decompressed is capped: 8 MB per asset
and 64 MB across the import, which is the actual defence against a zip bomb. Only files an
asset entry names are read at all, so a path outside the archive's own listing is unreachable.

The entry count is deliberately _not_ capped. It was, at 256, and that was wrong twice over: a
card with a full emotion set legitimately holds hundreds of files, and the count included
directory entries. Hitting it failed the whole import. Nothing about the number of entries
predicts the cost of reading the few an asset names.

The number of assets imported is capped at 512, and anything past it is reported rather than
thrown. Assets that could not be imported are counted apart by reason — stored outside the
archive, missing from it, too large, or past the limit — because the user can only act on the
difference.

A bare V3 card — one that is not a `.charx` — still reports its assets as not carried over,
because only the archive holds the files. That notice is now conditional on the card actually
declaring assets.

## Residual risk and follow-ups

- Covered by `app/tests/unit/character-port.spec.ts` and `app/tests/e2e/character-port.spec.ts`
  since the client gained test runners (`docs/testing-and-ci.md`). `buildCharacterCard` and
  `toPngBytes` still have no unit coverage, because they need a real canvas; the export browser
  test exercises them end to end instead.
- Export to `.charx` is not implemented; import is. Embedded assets are not deduplicated, and
  a file left behind by a deleted asset is not cleaned up.
- Import handles one file at a time; the legacy client accepted several.
- The importer trusts the card's JSON structure. It is parsed, not evaluated, and every
  imported string reaches the DOM through Svelte's escaping or the sanitiser in
  `renderMarkdown`, but there is no schema validation and no size limit on an imported field.
- Chub browsing/download (`web/pages/Chub`) was not ported.
