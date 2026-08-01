# Character Assets

Images a character can show mid-reply.

Nothing existed for this before: `AppSchema.Character` had `avatar` and `sprite` (the separate
visual-novel system) and no general asset field at all. The missing menu was a symptom — there
was nowhere to store one.

## The shape of it

The model never sees a URL. It is told the asset **names** and asked to emit a tag; the tag is
swapped for an image when the message is rendered.

That ordering is the point:

- A model cannot invent a path it was never given, so a reply cannot smuggle in a remote image.
- A stored message holds the name, not a URL, so it survives the file moving.
- The tag looks like the placeholders already in this app's templates, so a model that has
  seen `{{char}}` treats `{{asset:name}}` as the same kind of thing.

| Piece       | Location                                                             |
| ----------- | -------------------------------------------------------------------- |
| Type        | `CharacterAsset` in `common/types/library.ts`, on `Character.assets` |
| Tag + rules | `common/assets.ts`                                                   |
| Storage     | `POST /character/:id/assets`, `DELETE /character/:id/assets/:name`   |
| Editor      | The workspace's Assets tab (`/character/:id/assets`)                 |
| Rendering   | `renderAssets` in `app/src/routes/Chat.svelte`                       |

## Prompt injection

`withAssetInstruction` appends the instruction to the assembled prompt in
`app/src/lib/generate.ts`, at both generation call sites.

It is appended after assembly rather than exposed as a `{{assets}}` placeholder, and that is
deliberate: an asset the model was never told about is an asset it can never show, so this must
not depend on the user having edited a prompt template. Appending also puts it nearest the
reply, where an instruction carries most.

A character with no assets produces a byte-identical prompt — there is no empty block.

## Rendering

`replaceAssetTags` runs **before** the markdown pass, so the `<img>` it emits goes through the
same DOMPurify sanitiser as everything else in a message. Nothing this path produces is trusted
on its own. Attribute values are escaped even though the URI is server-issued.

A tag naming an asset that does not exist is left on screen as written. The model naming
something it invented is worth seeing rather than silently deleting.

Names are matched case-insensitively and trimmed, because models are inconsistent about both
and neither changes which asset was meant.

## Verification

- `pnpm run check` passes. 106 Vitest, 78 mocha, 67 Playwright.
- `app/tests/unit/assets.spec.ts` (14): replacement, repeated tags, case and padding, unknown
  names, ordinary placeholders left alone, and that the instruction names every asset and is
  empty when there are none.
- `app/tests/e2e/assets.spec.ts` (6): upload and delete through the workspace; **the assembled
  prompt containing the tag rule and the asset name**; a prompt unchanged when the character
  has none; a tag in a stored reply rendering as `img.chat-asset`; and an unknown tag staying
  visible.

## Residual risk and follow-ups

- **The upload route has never run against a real filesystem or MongoDB.** The browser tests
  drive the stub. Type checks and route shape are verified; `entityUploadBase64` writing the
  file is not.
- No size or dimension limit on an uploaded asset, and no image re-encoding — unlike the avatar
  path, which downscales through a canvas.
- Deleting an asset drops it from the character but does not delete the stored file.
- Card V3's `assets` manifest is still not imported. The field it would populate now exists,
  which removes the reason that was blocked.
- The instruction is English regardless of the UI language.
