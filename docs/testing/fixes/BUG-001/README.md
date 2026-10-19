# BUG-001 — Invitation acceptance lock order

Base: branded 404 PR #209, branch `claude/serene-thompson-yuft81`, head `107a46259f1e8ee13765e3a3559fe5b5bbc88c99` (remote CI and Security PASS).

Fix branch: `fix/pre-production-01-invitation-race`. Implementation commit: `455938b949fab5c116fd2e684f570ced929573d0`. PR: #231. Remote CI and Security: **PASS** at `ad03fde` (CI run 360 / Security run 509), all five jobs successful. [Exact-head results](remote-ci.json). Initial Security run 508 remains recorded as FAIL on a confirmed metadata-keyword false positive; the correction passed actual remote recheck. No PR was merged.

Acceptance used to lock the invitation before the dealership; owner mutations take the opposite order. This produced a real database deadlock and HTTP 500. Acceptance now reads only the scoped invitation's dealer ID, locks that dealership, then locks/re-reads the invitation before changing membership or audit state. The final invitation read still checks the proven phone, expiry and status. No API contract, schema, role matrix or UI change is needed.

The same order also fixes directly coupled BUG-NEW-002: the dealer's status was previously read before the lock wait, allowing acceptance to use an old ACTIVE state after suspension committed. This has its own negative regression and is documented separately in [REPRODUCTION.md](REPRODUCTION.md). It requires no additional product change beyond the correct lock order.

## Verification and evidence

- Original baseline ADD-RACE-001: FAIL, retained at `d6ae115`. The new controlled regression reproduced PostgreSQL 40P01 and acceptance 500 before the fix. The acceptance-first control passed. The suspension case reproduced 200 instead of 409. [Red log](evidence/ci/bug001-red.log).
- Targeted plus negative/adjacent integration: **65 tests PASS** across invitation locking, team, dealership roles and tenancy hardening. Includes both lock queue orders, owner renewal, decline, expiry, replay, wrong authenticated phone, unauthenticated requests, OWNER role manipulation, role downgrade/removal, suspended dealers and cross-dealer IDs. [Verbose results](evidence/ci/bug001-adjacent.log).
- Full accumulated repository suite at implementation SHA: **4,357 tests PASS** (2,591 API / 1,346 web / 420 contracts), all uncached. API 90% coverage gates PASS: branches 91.76%, lines 97.55%. [Full log](evidence/ci/bug001-full-suite.log) and per-assertion JSON reports in that directory.
- Repository lint, typecheck and production build: **PASS** at the implementation SHA. The build passes this workspace's proxy variables through Turbo; no source workaround. [Metadata and logs](evidence/ci).
- Built-server Chromium Agent UAT: **six cases PASS**, both withdrawal-first stale-tab and acceptance-first flows at 1440/768/390 pixels. UI logout, fake-OTP API login, browser reload and post-login authorization checked. DB queries verify membership counts, actors, timestamps and audit actions. [Results](browser.json); before/after screenshots are alongside this report. No page overflow. Real Google/MSG91 UI login is not established by fake-provider verification.
- Two incorrect harness locators and one network-idle navigation timeout were retained as **BLOCKED**, never treated as product PASS/FAIL. A fresh-session diagnostic returned 200, rendered the expected state and had no pending requests. The passing run uses document readiness plus explicit visible-state and API authorization assertions; navigation cancellations remain in its evidence. No frontend source was changed to make the harness pass.

Tests for this layer prove the invitation lock-order behavior. The other baseline bugs remain open, so this is not a production GO. [Canonical retest rows](canonical-retests.json) map eight related scenarios to individual passing assertions while preserving each baseline classification. Human UAT: **PENDING**; real-device/browser and real-provider gaps are retained from certification.

## Required supporting changes

CI and Security PR triggers previously filtered bases to `main`, skipping this intentionally stacked PR. Both now allow every PR base, preserving existing jobs, credentials policy, push/schedule behavior and permissions.

Secret scanning initially failed on the archived Python metadata keyword `reproducibility=` beside prose ending in “API”. The captured value is the keyword assignment itself, not a credential. A rule-specific allowlist matches only that exact captured text. Local history scan now passes, and invented credential-like values in both a neighboring file and the same report file remain detected. No archive or history was rewritten, and no filename was excluded. [Scanner reproduction and negative evidence](gitleaks-verification.json).

This first fix layer also introduces the original certification dossier under `docs/testing/pre-production/` because it had not been committed. `baseline-archive.json` verifies the 162 report/source/evidence files were copied byte-for-byte before current-status sections were appended to BUG-REPORT and RETEST-REPORT. [Archive verification](archive-verification.json) also validates all 556 scenarios against the uploaded source and 329 evidence references using the original baseline verifier at its required baseline commit. That historical verifier intentionally rejects a fixed branch; it is not a current application gate. Baseline registry statuses and all original failing evidence remain unchanged. This documentation is campaign traceability, not additional product fixes.

## Repeat the browser check

`browser-fixture.mts` refuses production mode, non-local hosts, a database other than `dealersdrive_cert`, live OTP, and enabled jobs. It creates inert fixture identities through actual onboarding/sign-in/invitation routes with fake Google/OTP and a recording mailer. It writes private session material only to `/tmp/dd-bug001-browser-private.json` (0600), then keeps the current-source API server open.

Run it through the API package's `tsx` with `NODE_ENV=test`, local `DATABASE_URL`, `PHONE_OTP_DRIVER=fake`, `JOBS_ENABLED=false`, `WORKER_INLINE=false`, and silent logs. Start the production-built web app on 3004 with `API_BASE_URL` set to the private fixture's `apiPort` and `WEB_BASE_URL=http://localhost:3004`. Run `browser-uat.mjs` with the same local database URL and an available Playwright module/Chromium binary (`PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE`). The script uses assertions for actual domain copy, visible page state, API responses and DB rows; it never emits session cookies or OTP proofs. Fixtures must be recreated for a fresh run because acceptance/withdrawal consume them.
