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
  inserts at the current caret/selection. Manual edits clear `promptTemplateId`.
- Prompt format select backed by `BUILTIN_FORMATS` (the existing `modelFormat` field).
- Global system prompt, jailbreak/UJB, and bot response prefill, each with the matching
  character-override toggle.
- Validation: advanced mode requires a non-empty raw template; basic mode always emits a
  normalized order.

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
- Prompt preview / token estimate for the assembled template.
- Reasoning, Jinja template, and parser preset fields are still not exposed in the Svelte editor.

### Deferred: CHARX and Character Card V3

Not started. Requires a separate plan and real `.charx` fixtures:

- `.charx` ZIP import/export.
- Character Card V3 schema and `assets` manifest validation.
- Archive bomb, path traversal, file count, and size protections.
- Embedded asset persistence, deduplication, ownership, deletion cleanup, and URL resolution.
- Display-time character-card asset substitution.

These must not be represented as supported by this restoration pass.
