# Test plan and repository audit

Audited commit: `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2` (main, #330). Audit started
2026-10-20 15:24 UTC. This file answers the brief's "first response" questions from the
repository, then gives the plan that was executed. The application was not modified.

## 1. Commit and lineage

- `main` = `6e39a9a` (#330), preceded by #335 and #332. #331 (`c4f3d22`) **reverted main to
  `a969dc2c`, the commit production runs**; everything merged between #279 and #328 — legal
  policies and consent (#279), the Android app (F099–F113) and customer deactivation (F107) —
  is **not on main** and is therefore out of scope. The tree is `a969dc2c` plus three web-only
  PRs (31 files).
- Last certified commit before this campaign: `8436820` (#251, `testing_branch`,
  `docs/testing/campaign/FINAL-LAUNCH-REPORT.md`). Between it and `6e39a9a`, 71 commits
  landed: Admin Members and least privilege (R110/R111), the Sales workspace (R112–R114),
  notifications and lifecycle/enquiry/support emails (R115–R117), identity linking (R109),
  mobile-OTP admin sign-in with isolated sessions (#293), five-message ticket limits (#295),
  genuine dealer verification and two document categories (#297, #299, #301–#304), service
  locations (#291), optional tagline/GSTIN (#292, #298, #302), dealer e-mail uniqueness
  (#288), R98–R108 performance/caching work and the #304/#330 galleries.
- The "Production Acceptance Baseline v2.0 (676 scenarios)" was searched for on `main` and
  every branch of `origin` (32 branches) by name and by content (`676`, `v2.0`). **It does not
  exist.** The inventory used is the 556 canonical scenarios plus 80 discovered ones — see
  [ACCEPTANCE-BASELINE-PR304.md](ACCEPTANCE-BASELINE-PR304.md).

## 2. Environment

| Item      | Value                                                                                                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container | Isolated cloud container, 4 vCPU; no production network, credential or data                                                                                                      |
| Runtime   | Node 24.22.0 (the repository pins `>=24`; the container default 22.22.0 was **not** used for any result), pnpm 9.15.9                                                            |
| Database  | PostgreSQL 16.15, local; `dealersdrive_cert` (migrated with `prisma migrate deploy`, 56 migrations, seeded with the repository's dev seeds)                                      |
| API       | `tsx src/index.ts` ×6: `:4000` rate limits off · `:4001` rate limits on · `:4002` database unreachable · `:4005` S3 driver → fake S3 · `:4007` msg91 driver with fault injection |
| Web       | `next start` (production build of this commit) ×4: `:3000` local · `:3001` `APP_ENV=production` public origin · `:3002` API unreachable · `:3003` API through a cuttable proxy   |
| Providers | `PHONE_OTP_DRIVER=fake` (and msg91 behind a fault-injecting preload), `MAIL_DRIVER=console`, `STORAGE_DRIVER=local` (and minio→fake S3)                                          |
| Browsers  | Playwright 1.56.1 with the pre-installed Chromium 141 (1194). **WebKit, Firefox and Edge are not installed** and `playwright install` is not permitted here.                     |

## 3. Architecture

A Turborepo/pnpm monorepo: `apps/api` (Express 5 modular monolith, Prisma 7, PostgreSQL 16,
pg-boss on the same database, transactional outbox), `apps/web` (Next.js 15 App Router, RSC by
default, Server Actions for mutations), `apps/sandbox` (component sandbox) and
`packages/contracts` (Zod v4 schemas shared by both apps; every input is `.strict()`). 178
operations are mounted and documented (`EVIDENCE/route-inventory.txt`; OpenAPI is generated
from the contracts and a test fails in both directions on drift).

## 4–5. Authentication, sessions and unified identity

- One `users` row per person. Phone proof comes from MSG91's widget (`verifyAccessToken`,
  server-side; a spent-token record in the CachePort refuses a replay — AUTH-005, AUTH-DISC-005); Google OAuth links an identity.
- Sessions are opaque random tokens stored as SHA-256 hashes. `dd_session` carries the
  CUSTOMER/DEALER ("person") scopes; **admin sessions are isolated** in `dd_admin_session`
  (#293), 12 h, Google or mobile-OTP. Person sessions last 30 days. Cookies are `HttpOnly`,
  `SameSite=Lax`, `Secure` in production.
- Every request re-reads the session, user, seats and memberships — no cached principal — so
  revocation, suspension and role changes apply on the next request.
- R93: a customer session opens the dealer console of any dealership the person belongs to.
  `PUT /v1/auth/workspaces/current` switches by **membership id**, never dealer id.
  Personal (customer) actions are owned by the user; dealer actions by the dealership with the
  actor stamped.

## 6–7. Dealer and verification lifecycles

```
Dealer.status           DRAFT ──submit──▶ PENDING_APPROVAL ──approve──▶ ACTIVE ⇄ SUSPENDED
                          ▲                 │  │  │                       (suspend/reinstate)
                          └─request-changes─┘  │  └─close──▶ CLOSED (record kept, #249)
                                               └─reject──▶ purge (row deleted, audit kept)
                        Manual activation override: SUPER_ADMIN only (#299).

Dealer.verificationStatus (the "Dealer Verified" badge, independent of status, #297/#303)
  NOT_VERIFIED → PENDING | IN_REVIEW | VERIFIED ;  PENDING → IN_REVIEW | VERIFIED | REJECTED
  IN_REVIEW → VERIFIED | REJECTED ;  VERIFIED → REVOKED ;  REJECTED/REVOKED → PENDING | IN_REVIEW | VERIFIED
  VERIFIED requires an ACTIVE dealership, proved phone and e-mail and both document categories
  verified; decisions carry expectedVersion (stale → 409) and are audited.

Documents: two categories (PERSONAL_IDENTITY, BUSINESS_IDENTITY) + SUPPORTING; REQUIRED →
  UPLOADED → VERIFIED | REJECTED. Locked (409 DOCUMENT_LOCKED) once the dealership is past DRAFT.
```

## 8–9. Membership and RBAC

`DealerMember.status` ACTIVE / INVITED / REMOVED (row kept for attribution);
`DealerInvitation` PENDING → ACCEPTED | DECLINED | REVOKED | EXPIRED (one PENDING per dealer +
number, at most 25 waiting). Roles are fixed (`DEALER_PERMISSIONS` in contracts, enforced by
`requirePermission`/`authorizeDealerWrite` inside the transaction): STAFF create/edit drafts and
mark enquiries contacted; OWNER and MANAGER also submit, reserve, sell, withdraw, request
reactivation, close enquiries; profile, documents and team are OWNER-only; OWNER is not
assignable and the last owner is locked. Admin side: `ADMIN_PERMISSIONS` for SUPPORT,
MODERATOR, SUPER_ADMIN and SALES_REP (Sales workspace only; no console). See
[RBAC-MATRIX.md](RBAC-MATRIX.md).

## 10–11. Listing and enquiry lifecycles

```
Listing (transition(listing, event, actor) only)
  DRAFT ─submit (DEALER/SALES)─▶ PENDING_REVIEW ─approve (ADMIN)─▶ ACTIVE
  PENDING_REVIEW ─request-changes─▶ CHANGES_REQUESTED ─resubmit─▶ PENDING_REVIEW
  PENDING_REVIEW ─reject─▶ REJECTED (terminal)
  ACTIVE ─reserve─▶ RESERVED ;  ACTIVE|RESERVED ─mark sold─▶ SOLD (terminal)
  ACTIVE ─withdraw (DEALER|ADMIN)─▶ WITHDRAWN
  RESERVED|WITHDRAWN ─back on sale─▶ ACTIVE only by ADMIN approval of a reactivation request (R82)

Enquiry   NEW / CONTACTED / CLOSED / SPAM. STAFF: NEW→CONTACTED only. OWNER/MANAGER: any
  status to any other (closing, spam, reopening). There is no from→to table — see §18.
Support ticket  OPEN / IN_PROGRESS / WAITING_FOR_CUSTOMER / RESOLVED / CLOSED (CLOSED final;
  customer reopens RESOLVED explicitly; five unanswered customer messages, #295).
```

Public visibility (R71): a car is public when its listing is ACTIVE or RESERVED **and** its
dealership is ACTIVE; RESERVED is shown but not available (no enquiry, not counted). SOLD and
WITHDRAWN leave every public surface — note that CLAUDE.md invariant 6 still describes the
older "sold stays greyed" policy (DOC-DISC-002, BUG-106).

## 12. Admin

Admin Members (R110/R111) replace the allow-list as the source of admission (BOOTSTRAP rows
still need the allow-list). Disabling a member revokes its admin sessions; role changes apply on
the next request. Admin decisions: dealer approve/request changes/reject/close/suspend/
reinstate/activation override, documents verify/reject, verification badge, profile changes,
listing checks/photography/moderation, reactivation requests, portfolio photos, yard visits,
service locations, config, members, support desk, enquiries (read-only), notifications log.

## 13. Search and read model

There is no separate search table on this commit: public reads query `listings` joined to
`dealers` through one predicate (`visible` vs `available`), so lifecycle changes are visible on
the next read. The web caches pages with ISR (60 s) and tags; Admin console decisions
revalidate the `vehicles` and dealer tags (#243); out-of-band changes drop out on refresh (#251).

## 14. Storage and media

`StoragePort` with local, minio and r2 drivers; production requires r2 with an HTTPS
non-loopback endpoint. Uploads are presign → PUT → commit; private documents are read through
signed URLs only; public images through `/media/by-media/:id/:width.webp` with a visibility
check on every request (no-cache + ETag, R108). The signed local stand-ins (`/uploads`,
`/private`) are mounted only for the local driver (#241).

## 15–17. Existing tests, coverage and gaps

CI (`.github/workflows/ci.yml`) runs prisma generate, format, lint, docs:check, typecheck,
test (unit + a real-PostgreSQL integration suite with a 90 % coverage gate) and build; plus
`pnpm audit --audit-level=critical`, Terraform fmt/validate and a Semgrep job. On this commit:
API 3,422 tests / 173 files, web 1,756 / 145, contracts 576 / 24 — all green; API coverage
96.99 % lines, 90.19 % branches ([AUTOMATED-TEST-REPORT.md](AUTOMATED-TEST-REPORT.md)).

There is no end-to-end browser suite in the repository; every browser check in this campaign
is in `harness/` (b0x, u0x). Also missing before this campaign: real-provider tests (MSG91,
Resend, Google, R2 — out of reach without credentials), multi-engine browser runs, and a
restore drill.

## 18. Undefined business rules found

| ID    | Rule                                                                                                                              | Affects      |
| ----- | --------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| UPD-1 | Is "log out of every device" a V1 requirement? No route exists; `revokeAllForUser` is unused. **Decided 2026-10-21: not for V1.** | AUTH-012     |
| UPD-2 | Which enquiry status moves are invalid? OWNER/MANAGER may move any status to any other (e.g. CLOSED → NEW, CONTACTED → NEW).      | ENQ-LIFE-010 |
| UPD-3 | Should a signed-out `/saved` invite sign-in rather than show "No saved cars yet"?                                                 | UAT-OBS-001  |
| UPD-4 | Should the console show listing credits while billing (F050–F054) is deferred?                                                    | UAT-OBS-003  |

## 19–20. Test data and destructive-test safety

All data is synthetic and local: `+9196…`/`+9192…` numbers, `*.example.test` e-mails, generated
JPEG/PDF fixtures. Admin sessions are inserted rows (SIM-SESSION); Google identities are
inserted rows (SIM-GOOGLE); invited Admin Members are activated by an UPDATE (SIM-ADMIT); every
other step goes through the running API or the browser. Destructive tests (suspensions, object
deletion, outages, restores) touch only `dealersdrive_cert`, a throwaway restore database and the
container's own processes. Nothing contacted MSG91, Resend, Google, AWS, Vercel or any
production host.

## 21–22. Browser automation and database inspection

Playwright + Chromium 141 (desktop 1440, tablet 820, phone 390 with touch/DPR 3). Direct SQL
on `dealersdrive_cert` for every lifecycle, ownership, actor, timestamp, audit and FK assertion.

## 23. Canonical registry validation

`node registry/registry.mjs validate` → expected 556, parsed 556, duplicate IDs 0, missing 0,
out-of-order 0 ([EVIDENCE/registry-validation.txt](EVIDENCE/registry-validation.txt)). The
brief's headers for ENQ-CREATE (17) and ADMIN-DEALER (9) are one short of their numbered
scenarios; the IDs run to ENQ-CREATE-018 and ADMIN-DEALER-010 and no scenario was dropped.

## 24. Additional scenarios

80 discovered scenarios across the delta features, security, regression of every finding
from the previous fix campaign, Agent UAT and analysis — listed in
[ACCEPTANCE-BASELINE-PR304.md](ACCEPTANCE-BASELINE-PR304.md).

## 25. Execution plan (as executed)

1. Repository gate (CI-equivalent) under Node 24.
2. Port the previous certification harness (`testing_branch`, 556-scenario campaign at
   `8436820`) to the current API — admin cookie, two-category documents, portfolio photos,
   Sales and Admin Members — and **re-judge every inherited assertion against the current
   product** (§26).
3. Run c01–c12 (canonical API/DB campaigns), d01–d05 (delta and fault injection),
   retest-* (every prior finding), b01–b03 (browser SEO, UX, golden paths), u01–u04 (Agent
   UAT, touch, gallery, outage recovery), p01 (performance), d04 (restore drill).
4. Triage every non-PASS, then a **final full pass** of the whole harness (`run-all.sh`) and
   `finalize.mjs` (completeness assertion, traceability, counts).

## 26. Integrity of the inherited harness

The harness that certified `8436820` was not trusted as-is. Systematic sweeps — every recorded
400 `VALIDATION_FAILED`, every unmatched route in the API log, and a line-by-line comparison of
all 556 scenario texts with the notes recorded for them — found inherited checks that passed for
the wrong reason or under the wrong ID. Each was rewritten and re-run:

| Problem found                                                                                                   | Scenarios                                       |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Refusal "passed" because the request used a payload shape the API no longer accepts (400), not the guarded rule | API-DISC-001/003, STORAGE-002, ONBOARD-006      |
| Support ticket never created (outdated field), so the cross-customer read was skipped but still PASS            | AUTH-014, API-SEC-007                           |
| Weak assertion (≤ 20 images after 14 tries; empty reorder accepted as "works")                                  | MEDIA-003, MEDIA-004                            |
| UI behaviour judged from an API payload; browser check referred to did not exist; IDs shifted by one            | MEDIA-009 … MEDIA-012 (now u03 in a browser)    |
| IDs shifted by one; e-mail sender configuration never tested                                                    | PROD-009 … PROD-013                             |
| IDs swapped                                                                                                     | STORAGE-002 ↔ STORAGE-003                       |
| "Owner decision" for NOT_APPLICABLE not documented anywhere                                                     | AUTH-012 → BLOCKED                              |
| Reasoning instead of execution for "API down during save/enquiry/refresh"                                       | RECOVERY-002, -003, -009 (now u04 in a browser) |

Harness drift that came from intended product changes (#289, #292, #299, #302, R108) was
corrected and is listed per script in [RETEST-REPORT.md](RETEST-REPORT.md).
