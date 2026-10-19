# Baseline certification plan and audit

Release candidate: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`.

The repository was clean on `main`, and `git pull origin main` confirmed it was current on 2 October 2026. Reports are being prepared on `test/pre-production-baseline-d6ae115`. Application behavior must remain unchanged. A later main commit is outside this certification.

## Architecture and state discovery

The actual dependencies are Node 24, pnpm 9.15.9, Turborepo, Next.js 15.5, React 19, Express 5, Prisma 7 and PostgreSQL 16. Older README/schema comments are not reliable descriptions of the latest behavior.

One User has unique verified phone identity and OAuthIdentity records keyed by provider/subject. CUSTOMER and DEALER are person session scopes; ADMIN requires a separate session. Session tokens are random, stored hashed, expiring and revocable. The cookie is HttpOnly, SameSite=Lax and Secure in production. Dealer membership, role, selected workspace, dealership state and role seats are read on each request. Browser-only permission checks are insufficient.

Dealer states: DRAFT, PENDING_APPROVAL, ACTIVE, SUSPENDED, REJECTED, CLOSED. Verification documents are private and independently reviewed. Rejection can purge the application; changes-requested is a separate remediation path. Suspension leaves membership, listing and customer history intact and closes the dealership context.

DealerMember states: ACTIVE/REMOVED; role: OWNER/MANAGER/STAFF. Invitations: PENDING/ACCEPTED/DECLINED/REVOKED/EXPIRED. Membership is unique per dealer/user. Invitation acceptance checks the verified phone; invitation renewal uses a partial unique index. OWNER cannot be assigned by invitation.

OWNER manages team/profile/documents. OWNER and MANAGER submit and reserve/sell/withdraw listings and close enquiries. All three roles read inventory, prepare drafts, read leads and contact NEW enquiries. Permissions derive from the shared contract table, not the legacy per-member permissions column.

Listing transitions: DRAFT → PENDING_REVIEW; CHANGES_REQUESTED → PENDING_REVIEW; Admin review → ACTIVE/REJECTED/CHANGES_REQUESTED; ACTIVE → RESERVED/SOLD/WITHDRAWN; RESERVED → SOLD or Admin-approved ACTIVE; WITHDRAWN → Admin-approved ACTIVE. Conditional updates defend competing transitions. Current public queries expose ACTIVE and RESERVED listings only from ACTIVE dealers with a slug; SOLD and WITHDRAWN are absent. ACTIVE alone is available for new enquiries and available counts. Current public search queries authoritative Prisma models rather than the historical listing_search projection described in CLAUDE.md.

Enquiries: NEW/CONTACTED/CLOSED/SPAM. STAFF contacts NEW; OWNER/MANAGER close, mark spam or reopen. Transactions lock enquiry rows. Creation locks listings and uses an advisory lock to prevent a duplicate open lead. Customer ownership, dealer ownership and handling actor are separate.

Admin roles: SUPPORT/MODERATOR/SUPER_ADMIN. An Admin session, active account, active Admin seat, role and allowlist/granted-seat checks determine access. Moderation, support, config, enquiry aggregation and access-management routes have distinct permissions.

Storage: local disk in tests, S3-compatible storage in deployment. Media upload signing, byte/type checks, ownership checks, processing, private documents and published delivery need separate security tests. Notifications use outbox events, pg-boss and a delivery ledger; dealer onboarding/status/profile email is implemented. Do not infer listing/enquiry notifications.

## Existing coverage and missing layers

Before execution the repository contains 82 API unit test files, 42 API integration files, 94 web test files and 14 contract test files. The API and contracts impose 90% coverage gates. Database integration is serial against a dedicated database recreated by global setup. React tests are component tests, not browser UAT. There is no repository Playwright E2E script. CI scripts: format:check, lint (including docs:check), typecheck, test and build; CI also validates Terraform and audits dependencies.

Risk gaps: deployed OTP/Google/email/storage; existing-session revocation in actual tabs; migration/restore against representative existing data; complete lifecycle intersections; authorization changes after principal resolution but before transaction commit; equal timestamp pagination; provider and network failures; real browsers/devices. These require their own evidence and must stay BLOCKED when unavailable.

## Registry and additional discovery

All 556 numbered scenarios are preserved. ENQ-CREATE has 18 entries despite its 017 heading; ADMIN-DEALER has 10 despite its 009 heading. Extend these ID ranges without removing scenarios. Validation checks count, unique IDs and ordinals. Results may be PASS, FAIL, BLOCKED or NOT_APPLICABLE only. A source audit alone does not demonstrate a runtime PASS.

Additional adversarial checks: incomplete dealer approval through the direct Admin API; production MinIO acceptance; production seeding guards; equal timestamp pagination; role/membership changes during in-flight writes; replay guard outage during phone linking; cross-workspace behavior after suspension. Every discovered failure gets a bug record.

## Environment and destructive-test safety

Local `.env` selects development/local, loopback database, local disk, fake OTP and console mail. No real provider credentials are configured by the managed environment. Do not dump `.env`, process environment, cookies or response authentication headers into evidence.

The integration suite drops only `dealersdrive_test`; it must connect to a PostgreSQL instance created exclusively for this campaign. Browser/API exploration uses a different database, `dealersdrive_cert`, so it cannot overwrite suite evidence. Synthetic users use example.test addresses and fictional phone identities. Existing repository fixtures remain unchanged. Seed only into these local databases. No production hostname or data is used. Docker Hub rate limiting requires a local PostgreSQL 16 binary fallback, documented as a tooling deviation rather than an application fix.

Node 24.19.0; Corepack pnpm 9.15.9 (global pnpm 11.19.0 is not used); Chromium 151.0.7922.173 and preinstalled Playwright. PostgreSQL/Prisma permit authoritative inspection. Browser engines unavailable locally stay blocked. Mobile viewport emulation does not certify Android/iPhone hardware or Safari.

## Execution sequence

1. Validate registry and isolated database provenance; generate Prisma client.
2. Run actual CI commands once with sanitized command logs and exit codes. Record first failures; do not rerun until green.
3. Map executed assertions individually to canonical scenarios; supplement APIs, database state, tenant attacks, lifecycle/concurrency and configuration probes.
4. Launch the unchanged application with isolated local dependencies. Explore real Chromium by click/type/scroll/refresh/back/new tabs at desktop/tablet/mobile widths; inspect screenshots. Do not label component tests as Agent UAT.
5. Record provider/device/deployment blocks separately from defects. Preserve failed assertions and flaky first attempts.
6. Recalculate all 556 statuses, missing IDs and unclassified IDs. Produce matrices, bugs, final NO GO/GO evidence and exact independent Human UAT steps.
7. Stop after baseline. Fixes, fix PRs, merges, retests and release tagging await the separate approved fix/release phases.
