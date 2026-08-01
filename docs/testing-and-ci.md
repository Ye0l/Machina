# Testing and CI

Until now the client had no automated tests at all, and the repository had no CI: the ten
workflows inherited from upstream were deployment and publishing jobs pointing at that
project's infrastructure, and they were removed in `d5e1017` along with the Dockerfile. This
adds the test runners the client was missing, and rebuilds CI and the image around what the
project actually ships.

## Layers

| Suite           | Runner     | Scope                                           | Command              |
| --------------- | ---------- | ----------------------------------------------- | -------------------- |
| Server / shared | mocha      | `common/`, `srv/` prompt and parsing logic      | `pnpm test`          |
| Client units    | Vitest     | pure client logic: routing, markdown, card port | `pnpm run test:unit` |
| Browser flows   | Playwright | the built app end to end                        | `pnpm run test:e2e`  |

`pnpm run check` runs formatting, all four TypeScript projects, svelte-check, mocha and
Vitest. Browser tests stay out of it: they need a build and a browser binary, which is the
wrong cost for the command run before every commit. CI runs them as a separate job.

### Why the client needed its own runners

The mocha suite compiles through `srv.tsconfig.json`, which covers only `srv/`, `common/`
and `tests/`. Adding `app/` to it would emit `.js` beside the `.ts` sources — exactly the
stale-output hazard `app/vite.config.ts`'s `preferCommonSources` plugin exists to prevent for
`common/`. Vitest reuses the Vite pipeline instead, so `.svelte.ts` runes modules and the
`/app/` and `/common/` aliases resolve the same way they do in the app.

## Unit tests (`app/tests/unit`)

`jsdom`, because DOMPurify needs a window and the router reads `location`/`history`. Covers
`parse`/`toPath` round trips and unknown-path fallback; the markdown pipeline including quote
wrapping and sanitising; and every character-card import format, the V2 persona rule, and the
PNG chunk round trip.

Anything needing a real canvas, a download, or navigation is a browser test, not a unit test.

## Browser tests (`app/tests/e2e`)

`tests/e2e/stub-server.ts` stands in for `srv/`: it serves `/api`, falls back to
`dist/index.html` for every other path (as `srv/app.ts` does), serves an avatar asset, and
accepts a WebSocket — generation results reach the client over the socket, not the HTTP
response, so without one the send path cannot run.

It records what the client sent, including **the assembled prompt**. That is what makes the
memory-book test meaningful: it asserts the entry text is in the prompt when a keyword
matches and absent when it does not, rather than asserting on the UI.

Each Playwright worker gets its own server on its own port, so specs run in parallel. The
`app` fixture seeds the auth token before any script runs; `anon` does not, for the auth
screen. Both fail the test on unexpected page errors.

Mobile viewport specs are a separate project (`mobile.spec.ts` at 390x844); everything else
runs at 1440x900.

`PLAYWRIGHT_CHROMIUM_PATH` overrides the browser binary for sandboxes that already have a
Chromium of a different version. CI installs its own and leaves it unset.

## Found by these tests

The markdown quote-wrapper's code-skipping clauses were dead. It runs on Showdown's _output_,
where fenced blocks are already `<pre><code>` and inline code is `<code>`, but it matched
backticks — which can never appear at that stage. Quotes inside code blocks were being
restyled as dialogue. The legacy client has the same bug. The clauses now match the markup.

## CI (`.github/workflows/ci.yml`)

Two jobs on pushes to `dev` and on pull requests: `check` (format, types, mocha, Vitest) and
`e2e` (build, then Playwright, uploading traces on failure). Concurrency is per-ref with
cancel-in-progress, so a new push supersedes an in-flight run.

## Image (`.github/workflows/docker.yml`, `Dockerfile`)

The previous Dockerfile built the Parcel frontend from `web/`, which is no longer what ships.
The new one is two stages: a build stage with devDependencies that runs `build:all`, and a
runtime stage with a production-only install that copies the compiled output across.

`CMD` is `node srv/start.js` rather than going through pnpm, so the server is PID 1's child
and receives SIGTERM directly.

Pull requests build the image but do not push it. Publishing needs credentials a fork's PR
cannot have, and publishing from unreviewed code would be wrong regardless.

## Verification

- `pnpm run check` passes: 72 mocha tests and 57 Vitest tests.
- `pnpm run test:e2e` passes: 37 browser tests across both viewports.
- The Docker **build stage** was validated by assembling a directory containing only the
  files the Dockerfile copies and running `pnpm run build:all` there — it succeeds, which
  confirms the COPY list is complete and that `web/` and `tests/` are genuinely not needed.
- The **runtime stage** was validated by running `pnpm install --frozen-lockfile --prod` over
  that output and starting `node srv/start.js`: it registers every adapter and proceeds to
  database and network concerns, so no runtime dependency is misplaced in `devDependencies`.

## Residual risk and follow-ups

- **The image is built by CI but has never been run.** There is no Docker daemon in the
  environment this was written in. `docker.yml` has since built it successfully on every pull
  request, so the Dockerfile is sound; the `VOLUME` declarations, `corepack` in the runtime
  image, and the container actually starting and serving are still unverified. The
  `docker-compose.selfhost.yml` stack has never been brought up.
- Both workflows have since run green on pull requests. GHCR publishing is still unobserved:
  it is gated to `dev` and `v*` tags, neither of which has been pushed since.
- No coverage thresholds are enforced. Large parts of the client — every Svelte component's
  internals, the settings and character editors, the generation stream's error paths — have
  no unit coverage; the browser tests exercise them only along the paths they walk.
- The Vitest suite does not cover `buildCharacterCard` or `toPngBytes`, which need a real
  canvas. They are covered end to end by the export browser test instead.
- The e2e stub is a stand-in, not the real server. It validates what the client sends and
  does with responses, not that `srv/` agrees with it. A contract drift between them would
  pass here — the mocha suite and manual runs against a real server remain the check for that.
