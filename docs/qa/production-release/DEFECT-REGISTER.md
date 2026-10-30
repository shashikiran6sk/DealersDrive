# Defect register

Audited commit `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`. Baseline phase: **every defect is
recorded, none is fixed** — no application source was changed. Numbering starts at BUG-101 so it
cannot collide with the earlier campaigns' BUG-001…, BUG-NEW-… and ORIG-BUG-… identifiers,
which this campaign re-tested (all still fixed — [RETEST-REPORT.md](RETEST-REPORT.md)).

| Severity | Open |
| -------- | ---- |
| P0       | 0    |
| P1       | 0    |
| P2       | 1    |
| P3       | 10   |

Severity follows the brief: P0 security compromise / cross-tenant exposure / data loss /
auth bypass / outage; P1 critical lifecycle broken or major authorization error; P2 important
degradation with a workaround; P3 cosmetic, minor or low-impact.

---

## BUG-101 — A non-public or unknown car URL answers HTTP 200, and so does a car page during an API outage

| Field                 | Value                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity              | **P2**                                                                                                                                                                                                                                                                                                                                                          |
| Scenarios             | SEO-009 **FAIL**, SEO-010 **FAIL**; linked (outcome correct, status wrong): PUBLIC-015, SEO-006, LISTING-LIFE-015, GOLDEN-008, GOLDEN-010, CAMPAIGN-03                                                                                                                                                                                                          |
| Role / workflow       | Anonymous visitors, crawlers, uptime monitors · public car pages                                                                                                                                                                                                                                                                                                |
| Environment           | Web production build (`next start`), `APP_ENV=production` instance `:3001` and local `:3000`; API outage instance `:3002`                                                                                                                                                                                                                                       |
| Reproduction          | `curl -o /dev/null -w '%{http_code}' https://<web>/car/this-car-does-not-exist` → **200**. Same for a SOLD or WITHDRAWN car's URL, a car of a suspended dealer, and any car page while the API is unreachable (which renders "Something went wrong" with 200). Compare `/dealers/no-such-dealer` → 404 and `/no/such/page` → 404.                               |
| Expected              | 404 for a car that is not public; a 5xx (or 503) for an outage — as the dealer page and the generic not-found route already do.                                                                                                                                                                                                                                 |
| Actual                | HTTP 200 with the branded not-found (`<title>Car not found</title>`, `noindex`) or error document. No listing data is shown and `noindex` is present, so nothing private leaks and the pages are not indexed.                                                                                                                                                   |
| Evidence              | `EVIDENCE/browser-public-seo/api-log.json`, `EVIDENCE/screenshots/UAT-B-mobile-invalid-17-unknown-car-url.png`, `EVIDENCE/screenshots/SEO-010-outage.png`, `EVIDENCE/console-suspension/`, `EVIDENCE/stale-suspension/`                                                                                                                                         |
| Root cause (probable) | `apps/web/src/app/(public)/car/[slug]/loading.tsx` (added by R101, #257) wraps the page in a streaming Suspense boundary, so the 200 status line is flushed before the page calls `notFound()` / throws. `/dealers/[slug]` lost its `loading.tsx` in #332 and answers 404 correctly — the same mechanism in reverse. Not proved by rebuilding without the file. |
| Impact                | Search engines treat these as soft 404s (crawl budget, Search Console errors); synthetic monitors and CDNs see an outage as healthy 200s; the previous campaign's BUG-NEW-010 retest expectation (404) no longer holds.                                                                                                                                         |
| Suggested fix         | Resolve the vehicle before the streamed boundary (e.g. call `notFound()` from `generateMetadata`, which runs before streaming, or drop/move `loading.tsx`), and map an API outage to a non-200 error response; add an HTTP-status assertion for `/car/<unknown>` to the web tests.                                                                              |
| Status                | OPEN                                                                                                                                                                                                                                                                                                                                                            |

## BUG-102 — `/v1/auth/me` reports `emailVerified: true` for a person with no e-mail

| Field         | Value                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| Severity      | P3                                                                                                                  |
| Scenario      | AUTH-DISC-002 FAIL                                                                                                  |
| Reproduction  | Phone sign-in as a new dealer (no Google yet) → `GET /v1/auth/me` → `user.email: null`, `user.emailVerified: true`. |
| Root cause    | `apps/api/src/modules/auth/auth.service.ts:109` hard-codes `emailVerified: true` in the pre-onboarding branch.      |
| Impact        | No web consumer reads this field today (checked), so no user-visible effect; a future client would be misled.       |
| Suggested fix | Return the user's real verification state (or `email !== null && verified`).                                        |
| Status        | OPEN                                                                                                                |

## BUG-103 — The dev-sales seed creates assisted dealerships with no OWNER, one of them ACTIVE

| Field         | Value                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity      | P3 (development data only)                                                                                                                                                                                                            |
| Scenario      | DATA-DISC-003 FAIL (DEPLOY-002 itself passes for every API-created dealership)                                                                                                                                                        |
| Reproduction  | `pnpm --filter @dealers-drive/api db:seed:dev:sales` → `SELECT … FROM dealers d WHERE NOT EXISTS (owner membership)` → Kaveri Auto Hub (ACTIVE), Sri Murugan Cars, Anna Nagar Wheels (DRAFT), Vellore Motor Point (PENDING_APPROVAL). |
| Root cause    | `apps/api/prisma/seed/dev-sales.ts` writes rows directly and was not updated for #301 (owner account at creation).                                                                                                                    |
| Impact        | Local/dev databases contain states the product cannot produce; tests or demos built on them can mislead. `dev-guard` refuses production.                                                                                              |
| Suggested fix | Seed an owner user + OWNER membership per assisted dealership.                                                                                                                                                                        |
| Status        | OPEN                                                                                                                                                                                                                                  |

## BUG-104 — Notification e-mail throughput is capped at 30 per minute per worker

| Field         | Value                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity      | P3 (capacity; becomes P2 if launch volume or admin fan-out grows)                                                                                                                                          |
| Scenario      | PERF-DISC-001 FAIL                                                                                                                                                                                         |
| Evidence      | `EVIDENCE/email-queue/throughput.txt` — exactly 30 `notification.email` jobs completed every minute for 16 consecutive minutes; median queue wait 1,054 s, p95 1,281 s during campaign bursts.             |
| Root cause    | `apps/api/src/platform/jobs/queue.ts` calls `boss.work(name, handler)` with pg-boss defaults (batch size 1, 2 s polling). Admin notifications fan out to every permitted Admin Member, multiplying volume. |
| Impact        | Dealer enquiry alerts, application and listing decision e-mails are delayed under bursts. Nothing is lost; the Sales e-mail code is sent synchronously and is unaffected.                                  |
| Suggested fix | Set `batchSize`/`pollingIntervalSeconds` (or local concurrency) for `notification.email`, and alert on queue depth.                                                                                        |
| Status        | OPEN                                                                                                                                                                                                       |

## BUG-105 — A signed-out `/saved` says "No saved cars yet" instead of asking to sign in

| Field        | Value                                                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Severity     | P3 (UX)                                                                                                                 |
| Scenario     | UAT-OBS-001 FAIL · undefined product decision UPD-3                                                                     |
| Reproduction | Sign in, save a car, open `/saved`, Logout from the account menu → the page shows "No saved cars yet — Tap the heart…". |
| Impact       | Reads as data loss right after logout; the cars are intact and return on sign-in.                                       |
| Evidence     | `EVIDENCE/screenshots/UAT-E-desktop-tabs-44-logout-tab-one.png`                                                         |
| Status       | OPEN                                                                                                                    |

## BUG-106 — CLAUDE.md invariant 6 contradicts the implemented public-visibility policy

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity      | P3 (documentation)                                                                                                                                                                                                                                                                                                                                                                    |
| Scenario      | DOC-DISC-002 FAIL                                                                                                                                                                                                                                                                                                                                                                     |
| Detail        | CLAUDE.md §4 rule 6 says a SOLD car stays on the marketplace (greyed, badged, sorted last) and that `listing_search` holds APPROVED/SOLD rows. On this commit R71 (#194) removes SOLD and WITHDRAWN cars from every public surface, there is no `listing_search` table, and the status is `ACTIVE`, not `APPROVED`. PUBLIC-011/012, SEARCH-002/003 confirm the implemented behaviour. |
| Impact        | The operating manual misleads every contributor (human or agent) about a security-relevant visibility rule.                                                                                                                                                                                                                                                                           |
| Suggested fix | Update CLAUDE.md §4 rule 6 in its own PR (CLAUDE.md §8).                                                                                                                                                                                                                                                                                                                              |
| Status        | OPEN                                                                                                                                                                                                                                                                                                                                                                                  |

## BUG-107 — Cosmetic: not-found title/heading mismatch; support number unformatted

| Field    | Value                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Severity | P3                                                                                                                                         |
| Scenario | UAT-OBS-002 FAIL                                                                                                                           |
| Detail   | An unknown car URL's `<title>` is "Car not found" while the page heading is "404 · Page not found"; the footer prints `+914162248890` raw. |
| Evidence | `EVIDENCE/screenshots/UAT-B-mobile-invalid-17-unknown-car-url.png`                                                                         |
| Status   | OPEN                                                                                                                                       |

## BUG-108 — Dependency advisories (no critical)

| Field         | Value                                                                                                                                                                                                                                                                                                                                                      |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity      | P3                                                                                                                                                                                                                                                                                                                                                         |
| Scenario      | DEP-DISC-001 FAIL (CI's critical gate passes)                                                                                                                                                                                                                                                                                                              |
| Detail        | `pnpm audit`: 0 critical, 7 high, 8 moderate. Only `qs` 6.15.3 (Express body-parser, `express.urlencoded({ extended: true })`) is in the API's request path; a bounded 1 MB crafted-body probe was refused in 4–16 ms with the API healthy (SEC-DISC-002). The rest is build/dev tooling (postcss via next, prisma CLI deps, vite, braces, source-map-js). |
| Evidence      | `EVIDENCE/dependency-audit.txt`, `EVIDENCE/ci/audit-critical.log`                                                                                                                                                                                                                                                                                          |
| Suggested fix | Bump via the existing Dependabot routine; drop `express.urlencoded` if no route needs form bodies.                                                                                                                                                                                                                                                         |
| Status        | OPEN                                                                                                                                                                                                                                                                                                                                                       |

## BUG-109 — A vehicle card shows a broken image when its stored photo is missing

| Field        | Value                                                                                                                                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Severity     | P3                                                                                                                                                                                                                                                                                                                 |
| Scenario     | MEDIA-012 **FAIL** (canonical); linked STORAGE-005 (no crash — PASS)                                                                                                                                                                                                                                               |
| Reproduction | Publish a car, delete its primary image's stored object (storage outage, lifecycle rule or failed replication), open any page with its card (search, dealer page, similar cars) → broken-image icon. The vehicle page gallery handles the same case correctly ("Photographs coming soon", missing frames skipped). |
| Root cause   | `apps/web/src/components/vehicle/vehicle-card/vehicle-image.tsx` renders the "no photo" slot only when the API sends no image; it has no `onError` fallback, unlike `PhotoGallery`.                                                                                                                                |
| Evidence     | `EVIDENCE/gallery-browser/api-log.json`, `EVIDENCE/screenshots/MEDIA-012-all-images-missing.png`                                                                                                                                                                                                                   |
| Status       | OPEN                                                                                                                                                                                                                                                                                                               |

## BUG-110 — The dealer console shows listing credits while billing is deferred

| Field    | Value                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Severity | P3 (UX / product decision UPD-4)                                                                                                                                   |
| Scenario | UAT-OBS-003 FAIL                                                                                                                                                   |
| Detail   | "0 credits" in the console top bar and a "Listing credits 0" panel, with no way to buy or use credits (F050–F054 deferred). A new dealer may read it as a blocker. |
| Evidence | `EVIDENCE/screenshots/RECOVERY-002-save-while-api-down.png`                                                                                                        |
| Status   | OPEN                                                                                                                                                               |

## BUG-111 — After an out-of-band suspension a dealer's public page stays up for about ten minutes

| Field         | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Severity      | P3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Scenario      | BUG-NEW-010-timing (the console path is immediate: BUG-NEW-010-console-timing PASS, GOLDEN-008 PASS)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Detail        | When a dealership is suspended without going through the admin console (direct API call, script, database), the API refuses at once, the warmed car pages stop serving the car after ≈ 70 s (revalidate 60) but the dealer page (name, address, map) is served until its 600 s revalidate expires plus one regeneration — measured 332 s once and 614 s on the final run (two intermediate runs stopped observing at 600 s, before it expired). Car listings on it are not shown once their own 60 s cache expires. |
| Root cause    | `apps/web/src/app/(public)/dealers/[slug]/page.tsx` `revalidate = 600`; only console actions revalidate tags (#243). By design per #251.                                                                                                                                                                                                                                                                                                                                                                            |
| Suggested fix | Publish a revalidation webhook from the API on dealer status changes, or shorten the dealer page's revalidate.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Status        | OPEN                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

---

## Harness defects found and fixed during the campaign (not product defects)

Recorded so the evidence trail is complete; each was corrected and re-run, and none changed a
product verdict to PASS without a real assertion behind it. Details in [TEST-PLAN.md §26](TEST-PLAN.md)
and [RETEST-REPORT.md](RETEST-REPORT.md).

- False PASSes from outdated payloads (API-DISC-001/003, STORAGE-002, ONBOARD-006), skipped
  cross-customer reads (AUTH-014, API-SEC-007), weak assertions (MEDIA-003/004), shifted or
  swapped IDs (MEDIA-009…012, PROD-009…013, STORAGE-002/003), API-only judgements of browser
  behaviour (MEDIA-010/011, RECOVERY-002/003/009).
- Timestamp-ordered result merging let an earlier, shallower verdict override a later one after
  files were reformatted; replaced by explicit `run-all.sh` precedence.
- My own d04 restore drill first compared an empty result (a failed UNION) and reported
  "identical"; caught from the evidence ("1 count"), fixed and re-run (17 values compared).
- Flaky harness timing: GOLDEN-002 sampled `/saved` before the list rendered (observed once in
  four runs; the list always appears within 3 s and survives reload) — now waits.
