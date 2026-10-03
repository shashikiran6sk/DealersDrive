# BUG-002 — authoritative dealer activation gate

Canonical: VERIFY-011. Baseline: FAIL at `d6ae115`. Reproduced: YES at stacked base `1f38a1333fb2fa6f933c3a1972a3a4298a2d071e`.

Environment: isolated Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14; fresh migrated `dealersdrive_test`, fake Google/OTP, local storage and recording mailer. No production connection.

Branch: `fix/pre-production-02-approval-gate`, from BUG-001 PR #231's verified final head. Intended PR base: `fix/pre-production-01-invitation-race`. No PR merged.

## Exact original reproduction

1. Create a dealership through real sign-in, phone proof and onboarding; leave it DRAFT with three REQUIRED documents.
2. Authenticate an authorized Admin through the real cookie/session resolver with a fake identity provider.
3. Read Admin detail: `actions.canApprove` is false.
4. Directly POST `/v1/admin/dealers/{id}/approve` with `{}`.
5. Inspect dealer/document/membership, audit and notification-outbox rows, and its public profile endpoint.

Expected: HTTP 422; dealer remains DRAFT; approval timestamp absent; no approval audit/outbox event; public profile 404; membership unchanged.

Actual: HTTP 200, ACTIVE, approval timestamp written, three documents still REQUIRED, one approval audit and one DealerApproved event, public profile 200. Membership remains unchanged. The same failure occurs for an incomplete PENDING_APPROVAL row.

[Initial red regression](evidence/ci/bug002-red.log) and [expanded public/DB lifecycle reproduction](evidence/ci/bug002-red-lifecycle.log). These are pre-implementation failures, retained separately from future retests.

## Root cause before implementation

The validated Admin route checks identity and approval permission, then `approveDealer` reads the dealer and refuses only ACTIVE. It does not require a submitted application, verified required documents, or the submission completeness rules. It updates ACTIVE and commits audit/outbox state in one transaction. Public directory/portfolio and verified-only capabilities trust ACTIVE. The UI's stricter `canApprove` hint is not server enforcement.

The initial read also lacks a dealership row lock: concurrent decisions can act on old state. Document review updates a child document before a possible dealer-state update; approval must use one parent-before-child lock order with review and re-read authoritative state after waiting. Required documents must be locked while evaluating their verified state; profile completeness must read through that same transaction.

Related architecture inspected: submitted/DRAFT review state, mandatory fields and owner identity, KYC presign/PUT/commit, yard-photo ownership/state, document rejection and return to draft, suspension/reinstatement, memberships/sessions, public dealer/listing visibility, audit, outbox and email notification idempotency. Existing positive mail fixtures bypass document readiness; they need valid prerequisites rather than weakened assertions.

## Directly required supporting findings

BUG-NEW-003, P1: POST `/v1/admin/documents/{id}/verify` returns 200 for both a REQUIRED document and an UPLOADING presign with no PUT/commit. It writes VERIFIED, reviewer/timestamp and a verification audit. The UI permits review only for UPLOADED. [Two red API/DB cases](evidence/ci/bug002-review-red.log).

BUG-NEW-004, P1: POST `/v1/admin/dealers/{id}/reinstate` changes an unapproved DRAFT dealer directly to ACTIVE, with an approval timestamp and reinstatement audit. `/suspend` also accepts DRAFT, enabling a two-step route around a reinstatement-only status check. [Two red state cases](evidence/ci/bug002-state-red.log).

Both are separately attributed, rather than silently bundled. Their guards are directly required for a sound activation gate: approval cannot trust fabricated VERIFIED state or leave another activation endpoint available to an unapproved dealer.

## Smallest proposed correction

- Lock and re-read the dealer before moderation decisions; use dealer-before-document order for review.
- Require PENDING_APPROVAL, all three verified committed documents, and the existing submission completeness rules in the same transaction before ACTIVE/audit/outbox changes.
- Let the existing completeness/read methods accept the transaction; avoid a second copy of the business rules.
- Verify only a committed UPLOADED document. Preserve ordinary rejection behavior while serializing its dealer-state decision.
- Suspend only ACTIVE; reinstate only SUSPENDED. Preserve successful approved-dealer behavior and ALREADY_ACTIVE approval semantics.
- Keep the UI action hint consistent with the authoritative readiness result.

Completed: implementation, valid full-pipeline positive coverage, negative role/session/ID tests, controlled non-destructive review queues, adjacent lifecycle, browser/API/DB evidence, and full local gates. Pending: remote CI and PR diff verification. Production GO remains unestablished; human UAT PENDING.

## Legacy document-state integrity follow-up

A new red test at implementation commit `4df14b4` preserves VERIFIED/fileName metadata but changes the document UUID to reference an absent storage object. Approval still returns 200, commits ACTIVE, and writes one approval audit/event. This models persistent unsafe verification state left by BUG-NEW-003 rather than assuming the new review guard repairs historical rows. The authoritative approval path must also check that each referenced upload exists. An absent object returns DOCUMENT_UPLOAD_MISSING / 422 before activation; storage errors must fail closed. The red evidence is retained as `bug002-legacy-object-red.log`. This directly required correction remains within BUG-002.
