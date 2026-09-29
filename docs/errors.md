# Errors — what a failure looks like, and what it is allowed to say

The operating manual for failure. It says how the web app tells a missing thing
from a broken one, what each kind of failure shows and answers with, and where
the real diagnostic goes. Read it before adding a page that fetches, a BFF
route, or a `catch`.

The whole design is one distinction:

- **`RESOURCE_NOT_FOUND`** — the API answered, and said the thing does not
  exist. That is a **404** and the branded not-found page.
- **`SERVICE_UNAVAILABLE` / `INTERNAL_ERROR`** — the API could not be reached,
  did not answer in time, answered with something unreadable, or failed itself;
  or our own code failed. That is a **5xx** and the branded error page — never a
  404, because an outage says nothing about whether a car or a dealership
  exists, and a 404 during an outage tells search engines thousands of valid
  pages have gone.

---

## 1. Scenarios

| Scenario                                   | HTTP     | What the user sees                                                  |
| ------------------------------------------ | -------- | ------------------------------------------------------------------- |
| Unknown route (`/hgdfghdgfnx`)             | 404      | Dealers-Drive 404, inside the public header and footer              |
| Missing car / dealer (API said 404)        | 404      | the same 404 page                                                   |
| Malformed car slug (API said 400)          | 404      | the same 404 page — no slug could be that                           |
| Sold / withdrawn car                       | 404      | the same 404 page (docs/seo.md §7)                                  |
| API unreachable, timed out, 5xx, malformed | 500      | "Something went wrong", Try again, Go to homepage, a reference      |
| Unexpected exception in our code           | 500      | the same error page                                                 |
| Root layout itself failed                  | 500      | `global-error.tsx`: the same page in its own `<html>`               |
| Homepage rows failed                       | 200      | the rest of the homepage, and an inline notice with Try again       |
| Dealer's inventory failed, dealer loaded   | 200      | the dealer's page, and an inline notice where the cars would be     |
| Similar vehicles failed                    | 200      | the car page without the section                                    |
| Header districts / footer config failed    | 200      | the page, with the header and footer's empty defaults               |
| Filters match nothing                      | 200      | the directory's "No cars match" empty state (and `noindex`)         |
| Form validation / duplicate / invalid OTP  | 200      | field and form messages, as before                                  |
| 401 on a signed-in page                    | redirect | the login flow, as before                                           |
| 403 / 409 / 429 from an action             | 200      | the action's own message                                            |
| BFF route, upstream 4xx                    | same     | the API's problem document (code, field errors)                     |
| BFF route, upstream 5xx / unreachable      | 502–504  | a fixed problem document: `SERVICE_UNAVAILABLE` or `INTERNAL_ERROR` |
| Enquiry form cannot open or send           | 200      | an inline message; the button stays to press again                  |

## 2. How a failure is classified

Every call to the API goes through `apps/web/src/lib/api.ts`, and it produces
exactly one of two error types:

- **`ApiError`** — the API answered with a non-2xx. Its `status` is **always the
  response's status**, never a number from the body. The body is kept only if
  it is a problem document (`code` present, and the known fields); anything else
  — an HTML page from a proxy, `{ "error": "PrismaClient…" }` — is discarded and
  a problem is synthesised from the status. So nothing an upstream wrote into a
  body it was not meant to reaches any later layer.
- **`UpstreamUnavailableError`** — no usable answer. `kind` is `network` (the
  connection failed), `timeout` (no answer within `API_TIMEOUT_MS`, 8 s) or
  `malformed` (a 2xx that is not JSON).

`apps/web/src/lib/errors.ts` turns either into a category:

| Input                                                  | Category                     |
| ------------------------------------------------------ | ---------------------------- |
| `ApiError` 404                                         | `RESOURCE_NOT_FOUND`         |
| `ApiError` 401 / 403                                   | `UNAUTHORIZED` / `FORBIDDEN` |
| `ApiError` 400, 422, other 4xx                         | `VALIDATION`                 |
| `ApiError` 409 / 429                                   | `CONFLICT` / `RATE_LIMITED`  |
| `ApiError` 502 / 503 / 504, `UpstreamUnavailableError` | `SERVICE_UNAVAILABLE`        |
| `ApiError` 500, anything else thrown                   | `INTERNAL_ERROR`             |

`isMissingResource(error)` is the only question a page asks before calling
`notFound()`. It is true for `RESOURCE_NOT_FOUND` alone (plus a 400 when the
caller says a rejected identifier means "no such thing", as `/car/[slug]`
does). Everything else is rethrown to the nearest error boundary.

## 3. Boundaries and pages

| File                                                              | Renders                                      | Shell             |
| ----------------------------------------------------------------- | -------------------------------------------- | ----------------- |
| `app/not-found.tsx`                                               | unmatched URLs                               | `PublicShell`     |
| `app/(public)/not-found.tsx`                                      | `notFound()` from a public page              | the public layout |
| `app/(public)/error.tsx`                                          | any public page                              | the public layout |
| `app/(public)/{cars,car/[slug],dealers,dealers/[slug]}/error.tsx` | the same, with a sentence naming what failed | the public layout |
| `app/(dealer)/error.tsx`                                          | the dealer console, back to the dashboard    | `StatusShell`     |
| `app/(admin)/error.tsx`                                           | the admin console (unchanged)                | —                 |
| `app/error.tsx`                                                   | anything above the route groups              | `StatusShell`     |
| `app/global-error.tsx`                                            | the root layout itself                       | its own `<html>`  |

- **The shell choice.** A 404 and a public-page error keep the real header and
  footer: the layout rendered, and a visitor should be able to carry on. The
  root and global boundaries use `StatusShell` — a logo and nothing that fetches
  — because whatever failed may be the layout itself.
- **Try again** is `RetryButton`: `router.refresh()` (ask the server for the
  route again) and the boundary's `reset()`, in one transition. If the API is
  still down the same error screen comes back; nothing redirects, so there is no
  loop.
- **Reference.** An error page shows Next's `digest`, which Next writes to the
  server log beside the error. It is the one correlation id that reliably
  exists for a server render; nothing is invented for display.
- **Metadata.** Error pages render `<title>` and `noindex`; not-found pages get
  Next's `noindex` and "Page not found". A failed page renders no car or dealer
  JSON-LD — the page component never returns.
- **Why the 404 and 500 bodies are client-rendered.** When a dynamic page calls
  `notFound()` or throws, Next answers with the correct status and an HTML shell
  whose body is filled from the flight data on hydration (React does not run
  error boundaries during server rendering). Crawlers get the status and the
  `noindex`; people see the branded page as soon as the script runs. Unmatched
  URLs are prerendered and have full HTML.
- **There is no `loading.tsx` above a public page, deliberately.** A Suspense
  boundary above a page streams the shell before the page's data arrives, and a
  `notFound()` or a failure after that point is answered **200**. Status codes
  are worth more than a skeleton.

## 4. Sections that fail on their own

A page fails only when its **primary** data fails. Secondary data degrades in
place:

- **Homepage rows** — `loadHomeInventory` returns `unavailable: true`; the page
  renders `SectionError` in the rows' place.
- **Dealer inventory** — the dealer's profile is the page; if only
  `/v1/dealers/:slug/vehicles` fails, the profile renders and `SectionError`
  stands where the cars would be. A 404 from it is still a 404.
- **Similar vehicles, header districts, footer config** — left out, or shown with
  their empty defaults, and logged.

## 5. What the user is never shown

No stack, `error.message`, upstream body, host, port, SQL, Prisma text, header,
cookie or token reaches the page, by construction rather than by care:

- Error pages render fixed copy from `components/errors/*/…constants.ts`; the
  `error` prop is read for its `digest` only.
- Server actions return `ApiError.userMessage()`, which is the API's own
  user-facing `detail` for a 4xx and a fixed sentence for anything 5xx, or the
  action's own fallback for anything else.
- BFF routes answer through `lib/bff.ts` `problemResponse()`: a 4xx problem is
  passed through field by field (the known fields only); a 5xx, an unreachable
  API or a bug becomes `{ code: SERVICE_UNAVAILABLE | INTERNAL_ERROR, detail:
<fixed sentence> }` with 502/503/504/500 and the API's `traceId` if it had one.
- Uploads show `failureMessage()`, which only lets through an `UploadFailure`
  the upload flow wrote — never a browser `TypeError: Failed to fetch`.
- In production Next itself strips server error messages from what it sends the
  browser; the rules above hold in development too.

## 6. Where the diagnostic goes

**Production source has no `console` calls** — `no-console` is an ESLint error
for `src/**` (tests, stories, seeds and scripts are exempt). The web app logs
through `lib/logger.ts`: one JSON line per event, errors to stderr, warnings to
stdout, server-side only.

| Event                                                | Level | Fields                                                                         |
| ---------------------------------------------------- | ----- | ------------------------------------------------------------------------------ |
| `api.request_failed`                                 | error | method, path, error (name, message, stack, status, code, kind, traceId, cause) |
| `api.stale_contract_refetched`                       | warn  | path                                                                           |
| `bff.unexpected_failure`                             | error | route, error                                                                   |
| `home.inventory_unavailable`                         | warn  | error                                                                          |
| `dealer.inventory_unavailable`                       | warn  | slug, error                                                                    |
| `vehicle.similar_unavailable`                        | warn  | slug, error                                                                    |
| `locations.unavailable`, `public_config.unavailable` | warn  | error                                                                          |

A 4xx is not logged by the web app (the API logs its own rejections). Nothing
logs a body, a cookie or a header. The API's `traceId` appears in both the API's
log and the web app's, which is how one request is followed across the two.

## 7. Timeouts

Every API call races an **8-second** deadline (`API_TIMEOUT_MS`). The race is on
the response, not an `AbortSignal`, because Next stops de-duplicating a
`fetch` that carries a signal — and `generateMetadata` and the page asking for
the same car must stay one request. On the error path Next renders the page's
metadata a second time, so a completely unresponsive API costs a car or
dealer page at most two deadlines (≈16 s) before it answers 500.

## 8. Checking a change

```bash
pnpm --filter @dealers-drive/web build
APP_ENV=production WEB_BASE_URL=https://www.dealers-drive.com pnpm --filter @dealers-drive/web start
```

With the API stopped, `/cars?brand=x`, `/dealers?q=x`, a car and a dealership
the cache has not seen must answer **500** with the error page; `/car/nope`
with the API running must answer **404**. `next dev` shows its own overlay for
thrown errors and is not the acceptance test.
