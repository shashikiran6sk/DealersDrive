# Test Plan — repository audit and execution plan

Release candidate: `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · audited 2026-10-02 · baseline phase.

Everything below was read from the repository at that SHA. Where this contradicts the
certification brief, the repository wins and the difference is recorded under §18.

## 1. Environment

| Item         | Value                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------- |
| Host         | Isolated, ephemeral cloud container (Linux 6.18). No production or shared data reachable.   |
| Node / pnpm  | 24.21.0 (downloaded, SHA-256 verified, to match `.nvmrc`=24) / 9.15.9                       |
| Database     | Local PostgreSQL 16.14, roles/databases created for this run only                           |
| Docker       | Daemon unavailable → no MinIO, no Mailpit, no `docker compose` profiles                     |
| Storage      | `STORAGE_DRIVER=local` (`.storage`), the driver the test suite uses                         |
| Mail         | `MAIL_DRIVER=console`                                                                       |
| OTP          | `PHONE_OTP_DRIVER=fake` — accepts `dev-otp:<msisdn>:<code>` tokens; MSG91 not reachable     |
| Google OAuth | No client credentials → real Google sign-in is BLOCKED; sessions minted by the test harness |
| Browsers     | Playwright Chromium 1194. WebKit and Firefox binaries are **not** installed                 |

## 2. Architecture

Turborepo + pnpm monorepo: `apps/api` (Express 5 modular monolith, Prisma 7 + `@prisma/adapter-pg`,
pg-boss jobs, outbox), `apps/web` (Next.js 15 App Router, RSC by default, BFF route handlers under
`app/api`), `apps/sandbox` (component sandbox), `packages/contracts` (Zod v4 — the single source of
request/response shapes **and** the RBAC permission table). 16 API modules; routes are one file per
route, mounted in `src/routes.ts` behind four guards: public, `requireCustomer`, `requireSignedIn`,
`requireDealer` (`/v1/dealer/**`), `requireAdmin` (`/v1/admin/**`). OpenAPI generated from contracts
and asserted route-for-route by `tests/unit/docs/openapi.test.ts`.

## 3. Authentication / session model

- One opaque random token (32 bytes, base64url) in cookie `dd_session`; DB stores only its SHA-256
  (`sessions.tokenHash`). `httpOnly`, `sameSite=lax`, `secure` only when `NODE_ENV=production`,
  optional `SESSION_COOKIE_DOMAIN`.
- `sessions.scope` ∈ `DEALER | CUSTOMER | ADMIN`. TTL 30 days (DEALER/CUSTOMER), 12 h (ADMIN).
- Every request re-reads session + user + seats + memberships (no cached principal) → revocation and
  role change take effect on the next request by design.
- Phone proof: the **MSG91 OTP widget runs in the browser**; the server receives an access token
  and verifies it with `control.msg91.com/.../verifyAccessToken`. OTP generation, code checking,
  expiry, attempt and resend limits are MSG91's. The server adds: canonical number
  (`normaliseIndianMobile`), a **replay guard** (spent-token counter in the CachePort; fails closed
  for sign-in), per-user and per-number rate limits, and purposes (`DEALER_PHONE_LINK`,
  `DEALER_LOGIN`, `CUSTOMER_LOGIN`).
- Google OAuth (dealers + admins): sealed transaction cookie, identity keyed by `provider+sub`.
- Logout: `POST /v1/auth/logout`, `/v1/auth/customer/logout`, `/v1/auth/admin/logout` revoke the
  **current** session only. **There is no logout-all route** (`revokeAllForUser` exists, unused).
- `AUTH_MODE=dev` swaps in a resolver that acts as a fixed dealer/admin; `env.ts` refuses it when
  `NODE_ENV=production`.

## 4–5. Unified customer/dealer identity

One `users` row per human (`phone` unique + `users_phone_canonical` CHECK, `email` unique,
`oauth_identities(provider, providerSubject)` unique). Seats in `user_roles`
(`DEALER | ADMIN | CUSTOMER`, each `ACTIVE|SUSPENDED`) can only close a door. A CUSTOMER-scope
session reaches the dealer console (R93): `resolveSignedIn` accepts DEALER **and** CUSTOMER sessions,
picks the workspace from active memberships (`sessions.activeDealerId` is a preference, re-checked
every request). Switching = `PUT /v1/auth/workspaces/current {membershipId}` — never a dealer id.
Customer guard is independent of dealership state (only user status + CUSTOMER seat + verified phone).

## 6. Dealer states

`DRAFT → PENDING_APPROVAL → ACTIVE ⇄ SUSPENDED`, `PENDING_APPROVAL → REJECTED`,
admin "request changes" returns to the dealer. `CLOSED` exists in the enum but **no code path sets
it**. Suspension: `dealers.status=SUSPENDED`; members' sessions are not revoked and seats are not
closed (R92); the dealer resolver refuses a person whose only memberships are suspended.

## 7. Dealer verification lifecycle

Onboarding wizard (`PATCH /v1/dealer/onboarding`, documents presign → PUT → commit, `POST
/v1/dealer/submit`), admin review (`/v1/admin/dealers/:id/approve|reject|request-changes`,
documents verify/reject), profile changes after approval queue in `dealer_profile_changes`
(one PENDING per dealer, partial unique index) and need moderator approval.

## 8. Membership states

`dealer_members.status` ∈ `ACTIVE | INVITED | REMOVED`, unique `(dealerId, userId)` — a removed
member who is re-invited gets the old row reactivated. Invitations (`dealer_invitations`):
`PENDING → ACCEPTED | DECLINED | REVOKED | EXPIRED` (EXPIRED written lazily), TTL 7 days, one
PENDING per (dealer, phone) by partial unique index, max 25 waiting per dealer, matched to the
session's **verified phone** — no token exists to forward or replay. Owner is fixed in V1
(OWNER is not assignable; the owner cannot be removed or demoted through the team routes).

## 9. RBAC implementation

`DEALER_PERMISSIONS` in `packages/contracts/src/dealer-access.ts` — one fixed table:

| Permission                                                                | OWNER | MANAGER | STAFF |
| ------------------------------------------------------------------------- | :---: | :-----: | :---: |
| `vehicle:read`, `vehicle:write`, `enquiry:read`, `enquiry:contact`        |   ✓   |    ✓    |   ✓   |
| `vehicle:delete`, `listing:submit/reserve/sell/withdraw/reactivate/renew` |   ✓   |    ✓    |       |
| `enquiry:close`, `photo:request`, `billing:read`                          |   ✓   |    ✓    |       |
| `dealer:update`, `document:upload`, `billing:purchase`, `member:manage`   |   ✓   |         |       |

Enforced server-side by `requirePermission(…)` on each route plus `requireDealerActive` on submit,
lifecycle moves, withdraw, request-reactivation and invitations. Enquiry moves are checked inside
the service by `enquiryTransitionPermission(from, to)` under `FOR UPDATE`. Admin roles
`SUPPORT | MODERATOR | SUPER_ADMIN` map to `admin:*` permissions; admin access additionally needs
`isPlatformAdmin`, `adminRole`, ACTIVE user, no suspended ADMIN seat and (allow-list **or** granted
ADMIN seat).

## 10. Listing lifecycle (`listings/listing.state.ts`)

| Event            | From              | To                | Actor          |
| ---------------- | ----------------- | ----------------- | -------------- |
| `submit`         | DRAFT             | PENDING_REVIEW    | DEALER         |
| `resubmit`       | CHANGES_REQUESTED | PENDING_REVIEW    | DEALER         |
| `requestChanges` | PENDING_REVIEW    | CHANGES_REQUESTED | ADMIN (reason) |
| `reject`         | PENDING_REVIEW    | REJECTED (final)  | ADMIN (reason) |
| `approve`        | PENDING_REVIEW    | ACTIVE            | ADMIN          |
| `reserve`        | ACTIVE            | RESERVED          | DEALER         |
| `markSold`       | ACTIVE, RESERVED  | SOLD (final)      | DEALER         |
| `withdraw`       | ACTIVE            | WITHDRAWN         | DEALER, ADMIN  |
| `reactivate`     | RESERVED          | ACTIVE            | ADMIN only     |
| `relist`         | WITHDRAWN         | ACTIVE            | ADMIN only     |

Dealers ask for reactivate/relist via `POST /v1/dealer/vehicles/:id/request-reactivation`
(one PENDING request per listing; a sale closes it). "REJECTED" is final — a corrected car is the
CHANGES_REQUESTED → resubmit path, not REJECTED → resubmit.

## 11. Enquiry lifecycle

`NEW | CONTACTED | CLOSED | SPAM`. Created by a signed-in customer (`POST /v1/enquiries`, slug +
optional message; identity from session; dealership from listing; **ACTIVE listings only**,
RESERVED → `409 LISTING_RESERVED`; a member cannot enquire with their own dealership; one open
(NEW/CONTACTED/SPAM) enquiry per customer per car). Dealer moves: `PATCH /v1/dealer/enquiries/:id`
under `FOR UPDATE`; **any status → any other status** is allowed if the actor holds the
permission: `→CONTACTED from NEW/CONTACTED` needs `enquiry:contact` (all roles); every other move
(close, spam, reopen to NEW, CLOSED→CONTACTED) needs `enquiry:close`. Stamps `contactedAt/ById`
(first contact) and `closedAt/ById`. Customers see `SENT | CONTACTED | CLOSED` (SPAM shown as
CLOSED). Admin view is read-only (`admin:enquiry:read`).

## 12. Admin lifecycle

Google sign-in to an ADMIN-scope session (12 h). Allow-list `ADMIN_ALLOWLIST` (default value is a
real address) or a granted ADMIN seat (`POST/DELETE /v1/admin/access`). Admin actions: dealer
approve/reject/request-changes/suspend/reinstate/patch, documents verify/reject, profile-change
approve/reject, listing moderation, photography & images, reactivation requests, config keys,
enquiries (read), support tickets.

## 13. Search / read model

There is **no separate read-model table**: public visibility is two Prisma predicates in
`search/search.repository.ts` evaluated on `listings` at query time —
`PUBLIC_VISIBLE_LISTING_WHERE` (status ∈ ACTIVE/RESERVED, slug set, dealer ACTIVE) and
`PUBLIC_AVAILABLE_LISTING_WHERE` (status ACTIVE, slug set, dealer ACTIVE). Counts are computed by
query (`carCount`), not stored. Consequence: suspension hides all of a dealer's listings
immediately and reinstatement restores them with no write to listings. `dealers.activeListings`
is a stale baseline column nothing writes (see DISC list). Next.js caches public reads.

## 14. Storage / media

`StoragePort` with `local | minio | r2` adapters. Dealer uploads (KYC docs, yard photo): presign →
`PUT` → commit; KYC under `dealers/<slug>/documents/<TYPE>/<documentId>`, no public route; private
reads via short-lived signed URLs. Vehicle photography is **admin-only** (`/v1/admin/listings/
:id/images…`, `admin:media:upload`), keys `vehicles/<vehicleId>/<mediaId>/original.<ext>`; public
delivery through `/media/by-media/:mediaId/:width.webp` from processed variants. The local adapter's
`PUT /uploads` and `GET /private` routes are **mounted for every driver**, HMAC-signed with
`UPLOAD_SIGNING_SECRET`.

## 15–16. Existing automated tests and coverage (run at this SHA)

| Package   | Files | Tests | Result | Coverage                                            |
| --------- | ----: | ----: | ------ | --------------------------------------------------- |
| api       |   124 | 2 586 | PASS   | lines 97.53 %, statements 96.71 %, branches 91.84 % |
| web       |    94 | 1 284 | PASS   | (not collected by `pnpm test`)                      |
| contracts |    14 |   420 | PASS   | statements 98.06 %, branches 95.14 %                |

API integration tests run against a real migrated + seeded PostgreSQL (`dealersdrive_test`) and
already cover: tenancy sweep for every id-taking dealer route by each role (R96), real races
(enquiry moves, sold vs withdrawn, role change vs removal, accept vs withdraw), invitations, roles,
unified session, membership migration, listing lifecycle/approval/reactivation, saved vehicles,
public visibility, moderation, OpenAPI route parity. `lint`, `format:check`, `docs:check`,
`typecheck`, `build`: PASS. (`build` first failed on `next/font` fetching Manrope through this
container's TLS-intercepting proxy; with the proxy CA passed through `--env-mode=loose` it passes
3/3 — an environment artefact, not a product defect.)

## 17. Missing automated coverage

- **No browser E2E suite** (no Playwright/Cypress config). Every BROWSER_E2E layer is new work.
- No test for `approveDealer`/`reinstateDealer`/`suspendDealer` **source-state** preconditions.
- No production-config test that the storage signing secret is not the committed default.
- No custom 404/500 page exists, so nothing tests it.
- No test of admin-approval vs admin-reject race on dealers.
- No failure-injection tests (DB down, storage down, MSG91 down) at HTTP level.
- Web coverage is not collected in CI.

## 18. Undefined business rules / brief vs repository

| #   | Brief assumes                                   | Repository says                                                                                                                                                       | Handling                                            |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| U1  | "Logout-all" exists                             | No route; only current-session logout                                                                                                                                 | AUTH-012 → decision needed (NOT_APPLICABLE or FAIL) |
| U2  | Permanent dealer deactivation exists            | `CLOSED` enum, no code path sets it                                                                                                                                   | DEALER-LIFE-017 → decision needed                   |
| U3  | RESERVED behaviour                              | Defined: visible, unlinked card, enquiry 409, dealer may sell; back to ACTIVE only by admin                                                                           | Test against R71/R82                                |
| U4  | Suspended dealer's listings                     | Defined: hidden from every public surface, restored on reinstatement, no listing writes                                                                               | Test against `PUBLIC_*_WHERE`                       |
| U5  | Enquiry "invalid transitions"                   | No transition table; all 4×4 moves legal, gated only by permission                                                                                                    | Test permission matrix; flag reopen as decision     |
| U6  | Last OWNER self-remove/demote                   | Owner is fixed in V1 (not assignable, not removable)                                                                                                                  | Test as such                                        |
| U7  | Rejected listing "corrects and resubmits"       | REJECTED is final; correction path is CHANGES_REQUESTED → resubmit                                                                                                    | MODERATION-015 tested on CHANGES_REQUESTED          |
| U8  | "Rejected dealer can resubmit"                  | Admin **reject is a purge**: the dealership row and its stored objects are deleted; a "resubmission" is a fresh onboarding. "Request changes" is the remediation path | VERIFY-007/009/010 tested on that basis             |
| U9  | MANAGER cannot edit "protected" profile fields  | Every profile write is OWNER-only (`dealer:update`); there is no partial MANAGER edit                                                                                 | Test as such                                        |
| U10 | Incorrect/expired OTP, attempt & resend limits  | Enforced by MSG91 in the browser, not by this server                                                                                                                  | Server side: replay + rate limits; MSG91: BLOCKED   |
| U11 | Notifications for listings/enquiries/complaints | Not implemented (email only for dealer onboarding/approval/suspension)                                                                                                | NOTIFY-005 checks nothing depends on them           |
| U12 | Mobile/WebKit/Firefox/Edge real devices         | Only Chromium available here                                                                                                                                          | Device emulation in Chromium; others BLOCKED        |

## 19. Safe test-data strategy

All destructive work runs in a database created for this run (`dealersdrive_cert`, separate from
`dealersdrive_test` which the suite drops and recreates). Seed with the repository's own
`prisma/seed/index.ts` + `dev-dealers.ts` + `dev-vehicles.ts` (refuse `NODE_ENV=production`), then
add a fixture script under `docs/testing/pre-production/fixtures/` that creates Dealer A and Dealer B
each with OWNER/MANAGER/STAFF, customers C1/C2, listings in every status, enquiries in every status,
saved cars, invitations. Synthetic numbers only. Sessions are minted by inserting
`sessions` rows with SHA-256 token hashes (exactly what `issue()` does) because Google and MSG91 are
unreachable; that is recorded per test as a harness shortcut, not a product PASS.

## 20. Destructive-test safety

Safe here: everything — the container has no route to production, no production credentials, and
no shared database. Not possible here: real MSG91 SMS/WhatsApp, real Google OAuth, Resend, R2,
AWS deploy/migrate, backup/restore of a managed database. Those scenarios are BLOCKED with the
reason, never PASS.

## 21. Browser automation

Playwright Chromium (headless) with device emulation (iPhone 13/Pixel 7/iPad viewports, touch,
UA). WebKit, Firefox, Edge and real Safari/iOS/Android: BLOCKED in this environment → HUMAN-UAT.

## 22. Database inspection

Full `psql` and Prisma access to the certification database: row state, FKs, audit_log,
outbox_events, sessions, partial unique indexes, `EXPLAIN` for index checks.

## 23. Canonical registry validation (Part D)

```
Expected canonical count = 556
Parsed canonical count   = 556
Duplicate IDs            = 0
Missing IDs              = 0
```

Registry correction: the brief's section headers sum to 554 while it numbers 556 scenarios.
`ENQ-CREATE` lists 18 (header said 017) and `ADMIN-DEALER` lists 10 (header said 009). No scenario
was dropped; those two ID ranges run to `-018` and `-010`. Seven scenarios repeat word-for-word in
two sections (e.g. `LISTING-LIFE-007 = STAFF-006`); each keeps its own ID and its own result.

## 24. Additional scenarios discovered during audit (unconfirmed until executed)

| ID                | Scenario                                                                                                                                                                                                                                                                                         | Suspected severity |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| SEC-DISC-001      | `UPLOAD_SIGNING_SECRET` defaults to a value committed in the repo, production does not refuse it, `deploy/` never sets it, and `PUT /uploads` / `GET /private` are mounted for the R2 driver → forged signatures may write any object key (e.g. replace public car photos) or read a private key | P0 if confirmed    |
| SEC-DISC-002      | `PROD-002`: production refuses `STORAGE_DRIVER=local` but accepts `minio` (with `S3_ENDPOINT` defaulting to `http://localhost:9000`)                                                                                                                                                             | P2                 |
| LIFE-DISC-001     | `approveDealer` accepts any non-ACTIVE dealer (DRAFT, SUSPENDED, REJECTED) with no completeness/document check                                                                                                                                                                                   | P1                 |
| LIFE-DISC-002     | `reinstateDealer` / `suspendDealer` have no source-state check → reinstate can make a DRAFT/PENDING/REJECTED dealer ACTIVE without approval                                                                                                                                                      | P1                 |
| LIFE-DISC-003     | Dealer approve vs reject read status without a row lock → concurrent decisions can both commit                                                                                                                                                                                                   | P2                 |
| LIFE-DISC-004     | Reinstatement re-activates the DEALER seat of every active member, which could reopen a seat closed for an unrelated reason                                                                                                                                                                      | P2                 |
| LIFE-DISC-005     | A `CLOSED`/`REJECTED` dealership is still "enterable" (`isEnterable` only excludes SUSPENDED) → members can create drafts and work enquiries                                                                                                                                                     | P2                 |
| UX-DISC-001       | No `not-found.tsx`, no public `error.tsx`, no `global-error.tsx` → Next.js default 404/500 on public routes                                                                                                                                                                                      | P2                 |
| DATA-DISC-001     | `dealers.activeListings` is returned by the dealer profile API but never written                                                                                                                                                                                                                 | P3                 |
| RECOVERY-DISC-001 | `rejectDealer` deletes storage objects **before** its DB transaction; a failed transaction leaves rows pointing at deleted documents                                                                                                                                                             | P3                 |
| AUTH-DISC-001     | `ADMIN_ALLOWLIST` defaults to a real personal address in every environment including production                                                                                                                                                                                                  | P3                 |

## 25. Execution plan

1. **Environment** — certification DB, seed, fixture script (Dealer A/B × OWNER/MANAGER/STAFF,
   C1/C2, every listing and enquiry state), session-minting helper, API on :4000, web on :3000.
2. **Automated baseline** — done above; plus `pnpm build`, migration replay on an empty DB,
   `pnpm audit`.
3. **API campaign** (`docs/testing/pre-production/harness/*.mjs`, plain HTTP against the running
   API, DB assertions with `psql`): public → auth → customer → saved → enquiry create → onboarding
   → verification → membership → identity → RBAC (every role × every dealer route) → listing
   create/moderation/media/lifecycle → enquiry lifecycle → admin → dealer lifecycle (Part H deep
   test with before/after DB snapshot diff) → cross-lifecycle → search → tenant attack (Part K) →
   direct API (Part L) → mass assignment (Part M) → storage → data integrity → concurrency (Part N,
   real parallel requests, DB-authoritative) → failure injection (stop Postgres, unwritable storage,
   MSG91 adapter timeout) → production config (env parse matrix, bundle secret scan) →
   observability (request IDs, log scrubbing) → abuse.
4. **Browser campaign** (Playwright Chromium, desktop 1440, tablet 820, mobile 390): golden paths,
   Part I revocation with three tabs, Part J role change, responsive checklist, keyboard/a11y,
   SEO (meta, JSON-LD, sitemap, robots), 404/500 UX, Agent UAT exploratory session with
   screenshots.
5. **Record** — one status per canonical ID in `registry/results.json`, evidence under
   `evidence/<area>/`, `BUG-###` for every failure, all Part B reports.
6. **Completeness assertion** — `registry.mjs completeness` must print `COMPLETENESS: OK`.
7. **HUMAN-UAT.md** for the product owner, then **STOP** — no fixes without approval.
