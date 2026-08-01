# Message Markdown and Editing

Chat messages rendered as plain text in a `whitespace-pre-wrap` paragraph, and could only be
deleted, regenerated or swiped -- never corrected. Both are restored here. The server already
supported editing (`PUT /chat/:messageId/message`), and both `showdown` and `dompurify` were
already dependencies, used by the legacy client.

No server contract changed and no dependency was added.

## Rendering

### `app/src/lib/markdown.ts`

Ported from the legacy pipeline (`web/shared/markdown.ts` plus the render path in
`web/pages/Chat/components/Message.tsx`) so both frontends present a message the same way.

`renderMarkdown(text)` runs three stages, in this order:

1. **Showdown**, with `simpleLineBreaks` and `tables`, matching the legacy converter options.
   Its `&amp;nbsp;` bug in code blocks is patched the same way
   ([showdown#669](https://github.com/showdownjs/showdown/issues/669)).
2. **Quote wrapping** over the resulting HTML. Double-quoted spans become `<q>`, and emphasis
   inside them becomes `<qem>`. This is the dialogue/narration split the app's themes are
   built on. The regex skips HTML tags, fenced blocks and inline code so quotes inside code
   are left alone; Unicode double quotes are normalised first.
3. **DOMPurify**, last, so nothing the first two stages emit is trusted by accident. `qem` is
   the one non-standard tag, added through `ADD_TAGS`.

Placeholders (`{{user}}`, `{{char}}`) are substituted before rendering, so what is displayed
matches what the prompt assembler sees.

The streaming bubble renders through the same function. Partial markup mid-stream is closed
off by the sanitiser rather than leaking broken HTML.

### Styles

`.rendered-markdown` rules live outside `@layer components` in `app/src/app.css`. They are
descendant selectors over HTML produced at runtime, so Tailwind's content scanner cannot see
the tags and would purge them from a component layer. Colours use the Svelte client's
neutral/violet palette rather than the legacy CSS variables, which this client does not
define.

## Editing

- A pencil action on every message opens an inline textarea in place of the bubble.
- The **stored** text is edited, not the placeholder-substituted rendering, so `{{char}}`
  survives a round trip.
- Ctrl/Cmd+Enter saves, Escape cancels, and there are explicit Save and Cancel buttons.
- `chats.editMessage` applies the change optimistically and reverts it if the server rejects,
  surfacing the error in the existing chat error banner.
- `retries` is deliberately left untouched: only the visible variant is edited, so cycling to
  another swipe still returns that swipe's original text.

## Verification

- `pnpm run check` (prettier, tsc, svelte-check, mocha) passes; 72 tests. `pnpm run build`
  passes.
- Driven in Chromium against the production build with a stub API — 29 checks total (the 20
  routing checks plus 9 here), all passing:
  - Bold, italic, inline code, lists and links render as real elements.
  - A quoted line renders as `<q>"... <qem>emphasis</qem> ..."</q>`.
  - **Sanitising**: a message containing `<script>window.__xss = 1</script>` and
    `<img src=x onerror="window.__xss = 1">` produces no `script` element, no `onerror`
    attribute, and `window.__xss` stays undefined.
  - Edit opens with the stored text; Escape cancels and persists nothing; saving issues
    exactly one `PUT /chat/msg-1/message` with the typed body, re-renders the result as
    markdown, and closes the editor.

## Residual risk and follow-ups

- Coverage is `app/tests/unit/markdown.spec.ts` (jsdom, which is what `renderMarkdown` needs
  for DOMPurify) and `app/tests/e2e/messages.spec.ts`. Writing that suite is what surfaced the
  dead code-skip clauses in the quote wrapper, recorded above.
- Editing a message does not re-run generation or invalidate later messages; it only changes
  stored text, matching the legacy behaviour.
- The legacy client also runs preset `parsers` over message text before rendering
  (`runPresetParsers`). That is not wired up here, so preset-defined text transforms do not
  apply to the Svelte client's display.
- `imageWrap`, noted as dropped in `docs/prompt-presets-and-display-settings.md`, is now
  closer to viable: markdown images render, so that display setting could be reintroduced.
