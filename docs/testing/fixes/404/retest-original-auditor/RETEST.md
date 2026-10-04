# PR #209 — independent retest by the original auditor

Tested head: `49a624e` (branch `claude/serene-thompson-yuft81`, evidence removed), built with
`pnpm build`, served with `next start`. API: real Express API against the inert
`dealersdrive_cert` database. Browser: Playwright Chromium 1194.

| Check                                                                                                                                        | Result                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Unknown route, nested unknown route, missing car, missing dealer × 1440/768/390: HTTP 404, branded header, `noindex`, no horizontal overflow | 12/12 PASS                                       |
| 404 → "Go to homepage" and "Browse cars" navigate (1440, 390)                                                                                | PASS                                             |
| Valid home, `/cars`, car, dealer, `/dealers` with `APP_ENV=production` and a public origin: 200, indexable, no 404 h1                        | 5/5 PASS                                         |
| API unreachable / 503 / 500 with canary detail: car, cars, dealer, dealers pages → 500 (never 404), safe text, `noindex`, no leak in HTML    | 12/12 PASS                                       |
| Same three outages: homepage stays 200 with a section error                                                                                  | 3/3 PASS                                         |
| Same three outages: BFF `/api/search/vehicles` → 502/503/502 problem+json with generic text, no upstream detail                              | 3/3 PASS                                         |
| `robots.txt` (production public origin)                                                                                                      | Unchanged: `Allow: /`, `Disallow: /api/`, `/v1/` |

Note on the first run: six apparent failures were harness errors (local `APP_ENV` makes every
page `noindex` by design; the BFF takes `search`, not `q`; the link check raced client-side
navigation). Corrected harness re-run: 37/37 PASS. `b209-link.mjs` is the navigation diagnosis.

**BUG-NEW-001 reproduced (independent of #209):** with the 500-canary upstream, the Next.js
server log prints `Error [ApiError]: <upstream detail>` with a stack (12 occurrences). The
structured logger added by #209 does not leak; Next.js's own error logging does. The real API
omits `detail` on 5xx in production, so the practical exposure is limited to text the API
chooses to send. Classified **P3, confirmed**. Not introduced by #209.
