# @store-builder/error-reporter

Where the front ends send unexpected errors (SPEC §3.5). The backend and the
worker have the same thing in `src/core/errors/errorReporter.js`.

| Adapter   | When                    | What happens                                       |
|-----------|-------------------------|----------------------------------------------------|
| `console` | no DSN (the default)    | nothing is sent; the error stays in the console    |
| `sentry`  | a Sentry DSN is set     | the error is sent to that Sentry project too       |

There is no Sentry SDK: an event is one envelope POSTed to the project's
`/api/<project>/envelope/` endpoint, so nothing is added to an app that has
no DSN. Errors only — no performance tracing, no session replay.

## Settings

| App                  | Variable                                              |
|----------------------|-------------------------------------------------------|
| merchant dashboard   | `VITE_SENTRY_DSN`, optional `VITE_SENTRY_ENVIRONMENT`, `VITE_RELEASE` |
| platform admin       | `VITE_SENTRY_DSN`, optional `VITE_SENTRY_ENVIRONMENT`, `VITE_RELEASE` |
| storefront (browser) | `NEXT_PUBLIC_SENTRY_DSN`, optional `NEXT_PUBLIC_SENTRY_ENVIRONMENT`, `NEXT_PUBLIC_RELEASE` |
| storefront (server)  | `SENTRY_DSN` (falls back to `NEXT_PUBLIC_SENTRY_DSN`), `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` |

Vite and `NEXT_PUBLIC_` values are baked in at build time: set them before
`npm run build`. A DSN is public by design (it can only send events).

## What is reported

- Browser: uncaught errors and unhandled promise rejections, plus what the
  dashboard's route error boundary catches.
- Storefront server: errors Next reports through `onRequestError`
  (`src/instrumentation.ts`): server components, route handlers, the proxy.

## What is sent

The error's type, message and stack; the app; environment and release; the
page's address without its query string or hash (they can carry tokens);
and the tags the caller adds. Never the user, cookies, request bodies or
form values. At most 20 reports per page load, and the same error once.
