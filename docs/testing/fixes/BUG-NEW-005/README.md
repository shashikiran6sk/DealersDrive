# BUG-NEW-005 — destructive application rejection

Canonical test: VERIFY-012. Original VERIFY-012 baseline remains BLOCKED. The separately attributed campaign reproduction is FAIL before this P1 concurrency fix.

Branch: `fix/pre-production-new-005-rejection-race`.
Base: PR #232, `fix/pre-production-02-approval-gate`, SHA `3570dcf5dcffb85235315eaed8e69c54bab1f87a`.

## Phase A: reproduced before product changes

Environment: isolated local PostgreSQL 16, reset/migrated/seeded test database; real HTTP API, cookie authentication, local object storage, fake OAuth/OTP, recording mailer. No production systems or live messages.

1. Complete and upload the application, submit it, and verify all three documents.
2. Hold an exclusive lock on the outbox table.
3. Start approval; observe its outbox insert waiting after the activation and upload checks.
4. Start rejection; observe its write waiting too, then release the blocker.

Expected: approval 200, rejection 422, dealer ACTIVE, original uploads intact, only approval history.
Actual: approval 200, rejection 200, dealer absent, both approval and rejection audit rows.
Reproduced: YES. Regression test fails on the unchanged base product source.

A second deterministic reproduction injects a test-only PostgreSQL trigger failure when inserting DealerRejected. Expected: 500 and a complete rollback including preservation of four uploaded objects. Actual: dealer PENDING_APPROVAL and no rejection history, but zero of four objects remain. Reproduced: YES.

## Root cause and relationships

Admin permission is enforced in the service. Rejection reads the dealer outside its transaction, never locks or rechecks its eligibility, and deletes external storage before the database commits. Its media/dealer deletes can therefore destroy an account approved after the stale read, or leave an intact application without uploads after rollback.

Dealer deletion cascades memberships, invitations, documents, profile changes, vehicles, listings, enquiries and saved-listing records. Sessions clear activeDealerId; users remain. Audit and outbox have no dealer foreign key and retain history. Rejection email uses the preserved audit recipient snapshot and notification deduplication. Media has no dealer foreign key and is explicitly removed. ACTIVE/SUSPENDED and any previously approved application must remain ineligible for destructive rejection.

Object deletion is idempotent in local storage and S3. The current event bus swallows subscriber errors, so a normal subscriber cannot provide durable cleanup retries: the outbox would mark a failed cleanup published. Required cleanup delivery must preserve retry failure while existing optional subscribers retain their behavior. Cleanup keys must commit atomically with the purge and be processed only after commit.

## Correction and verification

Implementation: `0e363494e42876294e5c037959a84c90b373321c`; final product/test state: `d5043b5dd36d7733e9255c0c94615988585fcd0a`. Rejection locks and re-reads dealer state inside its transaction; any approved history makes destructive rejection ineligible. Audit, rejection event, exact cleanup keys and purge commit together. Upload deletion starts only after commit. Required cleanup delivery retains failures for the existing outbox retry policy; optional subscribers keep their behavior. No schema or frontend changes.

The response preserves its successful deletion count. The immutable audit records objectsDeleteRequested rather than claiming precommit external side effects succeeded. Local/S3 deletion is idempotent. Ten failed outbox deliveries leave a retained, unpublished row for investigation and replay after provider recovery; this does not claim unlimited retry or completed deletion while a provider is unavailable.

- **15 layer-specific real HTTP/DB tests PASS**, including both race winners, duplicate rejection, transaction rollback, provider retry, audit actor and persisted/deduplicated rejection email, anonymous/owner/manager/staff/cross-dealer denial, forged fields, stale Admin role/session changes, and eight ACTIVE/SUSPENDED × ACTIVE/RESERVED/SOLD/WITHDRAWN history combinations.
- **137 targeted integration and 214 affected unit tests PASS**. Original red failures retained. Early fixture/type/format failures are retained and described below.
- **Full accumulated suite: 4,404 PASS**: 2,638 API, 1,346 web, 420 contracts. API coverage: statements 96.97%, branches 92.18%, functions 98.36%, lines 97.8%; all coverage gates PASS. [Per-assertion evidence](evidence/ci/api-assertions.json).
- **Final lint/format/docs, typecheck and production build PASS** on d5043b5; build uses loose environment passthrough for the environment proxy. Final source was committed before these checks.
- **Four functional Chromium Agent UAT cases PASS** on the built web server: rejection at 1440/768/390 and stale Admin rejection after approval. Visible confirmations, decoded assets, previous signed file URLs 404 after purge, owner stale cookie/API 401 and refresh to onboarding, replay 404, exactly-one audit/rejection/cleanup record, actor and public visibility are verified against the API and PostgreSQL. [Browser results](browser.json). All screenshots were visually inspected.

CI: PENDING until the actual PR head passes. Human UAT: PENDING. Final 556-case and live-provider/real-device certification: PENDING. Production certification: NO GO while remaining campaign defects and gates are unresolved.

## Retained failed or blocked attempts

The pre-fix two failures are actual product reproductions. Initial copied test fixtures reused BUG-002 GSTIN/PAN values and collided; new fixtures use a separate prefix. A lifecycle assertion selected a seeded listing-media key after WITHDRAWN reordered rows; it now records actual uploaded keys before seeded listing media. Both attempts remain in evidence and do not count as a PASS. Type/lint failures were corrected before the final gates. One local lint process exited 137 with a recorded cgroup OOM while obsolete campaign servers and concurrent checks consumed memory; obsolete campaign processes were stopped and final checks reran sequentially. Generated Vitest JSON files initially failed formatting; complete raw reports were moved to private temporary paths after sanitized per-assertion evidence was archived.

The first browser attempt completed rejection, then its diagnostic SQL compared text history IDs with an inferred UUID parameter. It is retained as [BLOCKED](evidence/ci/new005-browser-initial-blocked.log). Explicit casts and fresh fixtures produced the final four passing functional cases. A stale fixture child also occupied the port during restart; stopping that exact old campaign fixture allowed a fresh run.

## Separate mobile findings

BUG-008 remains FAIL: Admin detail width 424 at viewport 390. Screenshot review also reproduced **BUG-NEW-006 P2**: the post-purge onboarding account step reaches width 518 at viewport 390, including inputs. [Measured reproduction](evidence/owner-layout-finding.json) and [screenshot](after-owner-onboarding-390.png) are retained. These functional results do not certify mobile layout. No unrelated layout fixes are included here.

## Browser reproduction

Use browser-fixture.mts with NODE_ENV=test, cookie auth, a local dealersdrive_cert DATABASE_URL, STORAGE_DRIVER=local, STORAGE_LOCAL_DIR=.storage-new005, fake OTP, JOBS_ENABLED=false, silent logs, inert ADMIN_ALLOWLIST=cert-admin@example.com, API_BASE_URL=http://localhost:4013 and MEDIA_BASE_URL=http://localhost:4013/media. It refuses a production/remote database and real-provider execution. It creates valid marked PDF/JPEG uploads and private 0600 session material outside the repository. Start the built web app at localhost:3008 with that API origin. Run browser-uat.mjs with the same local database URL, WEB_BASE_URL, TESTED_SHA and available PLAYWRIGHT_MODULE. Recreate fixtures for another destructive run.
