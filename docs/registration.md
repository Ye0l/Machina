# Registration

The Svelte client's auth screen was login-only, so a new user could not create an account in
the shipped frontend at all — the only route in was to register through the legacy client or
directly against the API. `POST /user/register` already existed and returns the same
`{ token, user, profile }` shape as login.

No server contract changed and no dependency was added.

## What was added

- `session.register(handle, username, password)`, mirroring `session.login`: on success it
  stores the token, authenticates the socket, and loads the session.
- A Login / Register toggle on the auth screen. Registering additionally asks for a display
  name (`handle`, the name characters address you by) and a password confirmation.
- Client-side checks before any request: a display name is required and the two passwords
  must match.

## `canAuth`

The toggle only appears when the deployment reports `canAuth`. That flag comes from
`GET /api/settings` and is `isConnected()` — whether the server has a database, and therefore
whether it has accounts at all. A JSON-storage self-host has none, and the legacy client hides
its auth form for the same reason.

The config request is fired during boot but deliberately not awaited: it is public, it only
decides whether to offer registration, and a failure must not block boot. `canAuth` defaults
to `false`, so a failed config fetch leaves the screen exactly as it was rather than
advertising a sign-up that cannot work.

## Verification

- `pnpm run check` (prettier, tsc, svelte-check, mocha) passes; 72 tests. `pnpm run build`
  passes.
- Driven in Chromium against the production build — 52 checks total (the previous 48 plus 4
  here), all passing:
  - A signed-out visitor sees the Register tab when `canAuth` is true.
  - A mismatched confirmation shows an error and issues no request.
  - Registering posts exactly `handle`, `username` and `password`, and lands the user in the
    character library signed in.
  - With the deployment reporting `canAuth: false`, the Register tab is absent.

## Residual risk and follow-ups

- No automated regression test, for the reason recorded in `docs/client-routing.md`.
- Password strength is not checked client-side; whatever the server enforces is what applies.
- Not ported from the legacy auth screen: password reset (`POST /user/reset-password`), Google
  OAuth (`/user/login/google`), remote/device login, and the 18+ terms acknowledgement shown
  under the legacy form. A deployment with age-gating or terms requirements should treat that
  last one as a gap.
- There is still no `/login` route; the auth screen is rendered by the gate in `App.svelte`,
  so a signed-out deep link lands on auth and then shows the library rather than the
  originally requested page. This was already noted in `docs/client-routing.md`.
