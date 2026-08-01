# Global Prompt Presets and Chat Display Settings

Restores two capabilities that already existed in the inherited backend/shared layer but were
not reachable from the new Svelte client: global generation presets with prompt composition
controls, and account-level chat display settings.

`common/prompt.ts` remains the authoritative prompt assembler. No Svelte-only prompt semantics
were introduced, and no server contract was changed.

## What Was Added

### 1. Preset contracts (`app/src/lib/settings.svelte.ts`)

- `PROMPT_SECTION_IDS` — the nine supported prompt sections.
- `normalizePromptOrder(order?)` — drops unsupported placeholders, removes duplicates, appends
  missing sections, and always returns each supported section exactly once. Falls back to
  `SIMPLE_ORDER` when no order is stored.
- `DEFAULT_PROMPT_TEMPLATE` — re-exports `common/mode-templates` `defaultTemplate`.
- `PresetInput` extended with `useAdvancedPrompt`, `modelFormat`, `promptOrder`, `gaslight`,
  `promptTemplateId`, `systemPrompt`, `ultimeJailbreak`, `prefill`,
  `ignoreCharacterSystemPrompt`, and `ignoreCharacterUjb`.
- Create and update paths share one `promptFields` object, so both routes persist the same
  fields. Unrelated stored preset fields still round-trip on update.

### 2. Prompt editor (`app/src/routes/Settings.svelte`)

- A Prompt section inside the existing preset form; provider/model and sampling controls are
  unchanged.
- Basic / Advanced mode select.
- **Basic**: reorderable list of the nine sections with an enabled toggle and keyboard-accessible
  move up/down buttons (same controls on desktop and mobile). Persists `{ placeholder, enabled }[]`.
- **Advanced**: raw `gaslight` editing in a monospace textarea with a placeholder insert menu that
  inserts at the current caret/selection, plus the template picker and preview below.
- Prompt format select backed by `BUILTIN_FORMATS` (the existing `modelFormat` field).
- Global system prompt, jailbreak/UJB, and bot response prefill, each with the matching
  character-override toggle.
- Validation: advanced mode requires a non-empty raw template; basic mode always emits a
  normalized order.

### 2a. Reusable prompt templates (`app/src/lib/prompt-templates.svelte.ts`)

A preset can point at a shared template through `promptTemplateId`, which outranks both its raw
`gaslight` and its prompt order — see `getTemplate` in `common/prompt.ts`.

**The locator.** `common/prompt.ts` resolves that id through a locator it leaves as a no-op until
a frontend registers one, because the shared layer cannot reach either client's store. The legacy
client registers it in `web/store/data/bot-generate.ts`; this one did not, and it matters more
here: the Svelte client assembles the prompt in the browser and posts the finished text to
`/chat/inference-stream`, so a preset carrying a template id was silently generating from its
`gaslight` instead. The store registers the locator on import and `AppShell` loads the templates
before the first generation can happen.

**Resolution order** mirrors the server's (`srv/api/chat/message.ts`): a built-in name from
`common/presets/templates.ts` first, then one of the user's saved templates.

**Editor.** A picker above the raw textarea lists "This preset only", the built-ins, and the saved
templates; choosing one copies its text into the editor and attaches it. Editing the text does
_not_ detach — that matches the legacy editor, and detaching per keystroke would hide the update
button. Because the two can then drift, the hint under the picker says which one actually
generates and points at "Update template" or "This preset only". Switching to the basic prompt
order detaches, since a template id would otherwise make the section list a lie.

CRUD goes through the server's existing `/user/templates` routes, which no client of this app had
been calling.

### 2b. Prompt preview (`app/src/lib/prompt-preview.ts`)

Renders the attached template (or the raw one) through `buildPromptPlaceholders` and
`parseTemplate` against the invented cast from `common/dummy.ts`, then applies the preset's
`modelFormat` instruct tags exactly as generation does. The settings screen is global with no chat
in scope, so sample data is the only option — the same approach as the legacy previewer.

Token count comes from the app's tokenizer. The encoder is a parameter rather than a fixed
import so tests can count without standing one up. The preview is a snapshot: an edit to the
template, the attached id, or the model format clears it rather than leaving a stale render.

### 3. Display settings store (`app/src/lib/ui-settings.svelte.ts`)

- `uiSettings.settings` is `$derived` from `session.user.ui` merged over `defaultUIsettings`.
  Because it derives from the session, login and logout reset it without a separate reset path.
- `save(patch)` posts to `POST /user/ui` and only writes back to `session.user.ui` after a
  successful response, so navigation always reflects the persisted value.
- Subscribes to the server `ui-update` event and merges the pushed patch.
- No `localStorage` is used for account settings.

### 4. Display tab (`app/src/routes/Settings.svelte`)

Top-level Display tab next to General, Providers, and Presets:

- Chat width (`CHAT_WIDTHS`), font (`FONT_FACES`), font size.
- Avatar visibility, size (`AVATAR_SIZES`), corners (`AVATAR_CORNERS`), custom width/height.
- Message opacity (range input) and alternating message presentation.
- Compact live message preview.
- Explicit save with a dirty-aware Reset, consistent with the provider/preset editors.

### 5. Chat rendering (`app/src/routes/Chat.svelte`, `app/src/shared/CharacterAvatar.svelte`)

- Chat width applied to the message list rows, error banner, and composer so the composer stays
  aligned at every width.
- Font family and font size applied once at the chat root; message opacity applied per bubble.
- `CharacterAvatar` gained optional `px` and `corners` props. Defaults are unchanged, and pixel
  dimensions are fixed so avatar changes cannot cause layout shift.
- Avatars hide when `avatarSize` is `hide` or `chatAvatarMode` is off.
- Streaming, variant cycling, regenerate, delete, and empty states remain visible at every width.

### 6. Localization (`app/src/lib/i18n.svelte.ts`)

English and Korean labels for every new prompt and display string.

## Verification

- `pnpm run check` (prettier, tsc, svelte-check, mocha) passes; 72 tests.
- `pnpm run build` passes. `git diff --check` is clean.
- `tests/prompt-order.spec.ts` (new, 4 tests):
  - Scenario reordered before Personality is emitted in that order.
  - Example Dialogue disabled is omitted from the assembled prompt.
  - Character system prompt and post-history instructions are used by default, and the global
    override suppresses both.
  - A saved advanced raw template reaches prompt assembly verbatim.
- Live browser round-trip at 1440x900 and 390x844 against the real API:
  - Preset created with a reordered and partially disabled section list plus system/UJB/prefill,
    page reloaded, preset reopened — every value came back from the server.
  - Advanced template with an inserted placeholder persisted as `E2E-RAW {{personality}}{{history}}`.
  - Display settings saved, page reloaded, values read back from `session.user.ui`, and visibly
    applied to chat width, font size, avatar shape, and message opacity.
  - No console or page errors; `scrollWidth == clientWidth` on both viewports.

### Prompt templates and preview

- `app/tests/unit/prompt-templates.spec.ts` (9) asserts through `getTemplate` rather than through
  the store, which is what proves the locator is registered: a built-in and a saved template are
  each returned, they outrank the preset's own `gaslight`, a deleted id falls back to it, and a
  preset with no id is untouched.
- `app/tests/unit/prompt-preview.spec.ts` (6): placeholders, history, persona/scenario and
  conditional blocks all fill from the sample cast; `modelFormat` substitutes instruct tags; the
  token count is of the rendered text, not the template.
- `app/tests/e2e/prompt-templates.spec.ts` (6): picking a built-in fills the editor and is saved
  as `promptTemplateId`; "Save as template" POSTs and attaches the new id; an existing template is
  listed, updated in place and deleted (leaving its text on the preset); switching to the basic
  order detaches; the preview renders with a token count and is dropped when the template changes.
- Providers and presets are seeded per test rather than served by default, because a preset
  reaches prompt assembly and would change the prompts the chat specs assert on.

### Fixed during verification

Adding a fourth settings tab caused the tab row to overflow on mobile and scroll the entire page.
The tab row is now `overflow-x-auto` with `shrink-0` tabs.

### Intentionally dropped

The `imageWrap` control was removed from the Display tab. The current Svelte chat renders no
images, so the switch would have had no effect.

## Residual Risk

Streaming partial output and retry-variant states were not captured in live screenshots because
that requires a real provider key. They reuse the same bubble markup and styling variables, which
were verified.

## Remaining Work

### Display and prompt follow-ups

- Re-introduce `imageWrap` once the chat renders markdown or attached images.
- Inherited `UISettings` fields still unused by the Svelte client: `theme`, `themeBg`, `mode`,
  `bgCustomGradient`, `light` / `dark` `CustomUI` colours, `viewMode`, `viewHeight`, `textSpeed`,
  `trimSentences`, `contextWindowLine`, `expandReasoning`, `displayReasoning`, `msgOptsInline`,
  `mobileSendOnEnter`.
- `uiGuard` on the server validates only a subset of `UISettings`; unguarded fields
  (`font`, `fontSize`, `customAvatarWidth` / `customAvatarHeight`, `chatAlternating`, …) are
  persisted without validation. Extending the guard is a server-side change and was out of scope.
- Drag-and-drop reordering as an addition to the existing move up/down controls.
- Reasoning, Jinja template, and parser preset fields are still not exposed in the Svelte editor.
- The preview renders sample data only. Previewing the prompt for the chat actually open would
  need the preview to live in the chat rather than in global settings.

### Deferred: CHARX and Character Card V3

Not started. Requires a separate plan and real `.charx` fixtures:

- `.charx` ZIP import/export.
- Character Card V3 schema and `assets` manifest validation.
- Archive bomb, path traversal, file count, and size protections.
- Embedded asset persistence, deduplication, ownership, deletion cleanup, and URL resolution.
- Display-time character-card asset substitution.

These must not be represented as supported by this restoration pass.

## Persona picker visibility

The chat header's "Speak as" select used to render only when the library held a character
other than the one being chatted with. That is the common case for a new account, and the
result was that the entire persona feature was invisible — there is no other entry point for
it, so nothing on screen suggested it existed.

It now always renders, disabled, with an option explaining that another character is what
makes it usable. A persona in Agnai _is_ one of your own characters sent as `impersonate`;
there is no separate persona entity to configure elsewhere.
