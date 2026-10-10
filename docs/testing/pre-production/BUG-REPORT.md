# Fix verification update

The original certification baseline below remains unchanged: **556 canonical tests, 244 PASS, 7 FAIL and 305 BLOCKED**. Scoped fix retests are recorded separately; no original failure is rewritten as a pass. All 162 original dossier files are preserved, with both reports retaining their complete original baseline beneath this update.

The current verified top is PR #238 at `a52a107e942d55b5137a42a157bc2f1b1fb09e19`: **CI 376 and Security 525 PASS, all five jobs**. The following documentation commit preserves identical product and test files; its actual final checks are recorded in the PR description and final checkpoint. No PR is merged. Main remains `d6ae115359c4d0ae7ab0fd5115336291666cbb08`.

| Layer                | PR   | Branch                                          | Base           | Agent retest / verified CI               |
| -------------------- | ---- | ----------------------------------------------- | -------------- | ---------------------------------------- |
| Branded404 / BUG-007 | #209 | `claude/serene-thompson-yuft81`                 | `main`         | PASS;107a462; CI358/Security507          |
| BUG-001              | #231 | `fix/pre-production-01-invitation-race`         | 404 branch     | PASS;1f38a13; CI361/Security510          |
| BUG-002              | #232 | `fix/pre-production-02-approval-gate`           | BUG-001 branch | PASS;3570dcf; CI363/Security512          |
| BUG-NEW-005          | #233 | `fix/pre-production-new-005-rejection-race`     | BUG-002 branch | PASS;d29d9b9; CI366 attempt2/Security515 |
| BUG-003              | #234 | `fix/pre-production-03-stable-pagination`       | NEW-005 branch | PASS;62b1491; CI368/Security517          |
| BUG-004              | #235 | `fix/pre-production-04-suspended-media`         | BUG-003 branch | PASS;adeb847; CI370/Security519          |
| BUG-005              | #236 | `fix/pre-production-05-membership-commit-guard` | BUG-004 branch | PASS;e80d124; CI372/Security521          |
| BUG-006              | #237 | `fix/pre-production-06-production-storage`      | BUG-005 branch | PASS;c9dfc4d; CI374/Security523          |
| BUG-008              | #238 | `fix/pre-production-08-admin-mobile`            | BUG-006 branch | PASS;a52a107; CI376/Security525          |

All nine PR heads and immediate bases were checked against GitHub. [Full stack map](STACK-MAP.md) records exact branch dependencies. [Next-session handoff](NEXT-SESSION-HANDOFF.md) contains reproduction evidence, runtime setup and the next exact action.

The accumulated automated suite passes **4,516 tests** at `87b462709969d2d75c9ba005435eed8975d18567`: API 2,750 across 132 files, web 1,346 across 99, contracts 420 across 14. API coverage is 97.02% statements, 92.4% branches, 98.37% functions and 97.82% lines; thresholds pass. Existing invitation, activation, rejection, pagination, media, member authorization, RBAC and lifecycle regressions are included. Lint, typecheck, fresh build and committed-history scans pass. Actual remote CI also passes the full suite and build.

[BUG-006](../fixes/BUG-006/README.md) preserves the exact-parent MinIO acceptance failure and verifies R2-only production boot with 61 configuration tests, 177 affected unit tests, 143 adjacent integration tests and 26 isolated process/entrypoint probes. Its final #237 CI374/Security523 proof is carried into BUG-008.

[BUG-008](../fixes/BUG-008/README.md) preserves the 425px Admin overflow at 390px and 320px before source changes. Its final built UI passes 30 geometry checks across six Admin views and five widths, 13 functional scenarios, 20 negative direct endpoints, logout/access-revocation stale-session checks, database ownership/history checks and seven mobile golden checks. Before/after and history screenshots are retained and visually inspected. Automated browser scripts ran locally with the session’s Chromium/Playwright runtime; repository CI does not provide that runtime.

**Remaining confirmed defects: P0 0 confirmed, P1 1, P2 6, P3 1.** NEW-012’s queued enquiry revocation race is the highest-priority next fix. NEW-006 onboarding overflow, NEW-007 inventory pagination, NEW-008 local PDF MIME, NEW-009 suspended yard visibility, NEW-010 warmed vehicle pages, NEW-013 production endpoint validation and NEW-011 media-width prose require separate PRs. NEW-001 logging privacy and BUG-009 dependency reachability/patches remain two provisional P2 assessments. See [open findings](new-bugs.json) and the handoff for individual evidence. No unrelated additional defect was silently fixed in BUG-006/008.

**Human UAT: PENDING. Production: NO GO.** The full 556-test/provider/deployment certification remains incomplete; inert fixtures do not certify live R2, MSG91, Resend, deployed credentials or provider delivery. Scoped automation and Agent retests pass, but known additional defects and blocked gates remain. The user directs handoff after BUG-006/008; no additional PR is started and no merge is authorized.

---

# Baseline bugs — no fixes

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

No fixes were made. P0: 0; P1: 3; P2: 6. All nine bugs are OPEN; dependency severity is provisional.

## BUG-001 — Invitation acceptance versus withdrawal returns an unhandled database conflict

Severity: **P2**. Tests: ADD-RACE-001. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: An ACTIVE dealership owner has invited a verified customer as STAFF; invitation is PENDING.

Steps:

1. Run the repository integration scenario dealer-tenancy-hardening.test.ts / races / never lets an accept outrun a withdrawal into a membership.
2. Send invitation acceptance as the invited customer and DELETE of that invitation as OWNER concurrently.
3. Inspect both HTTP responses and the invitation/membership state.

Expected: If acceptance wins, the losing withdrawal returns the defined 404; if withdrawal wins, acceptance is refused and no membership appears.

Actual: Acceptance returned 200, but withdrawal returned 500 instead of 404. Prisma reported a write conflict/deadlock in the withdrawal transaction. The suite failed its HTTP assertion.

Security/data impact: Unreliable owner revocation UX and a failed race gate. This failure alone does not prove unauthorized membership creation.

Reproducibility: Observed once in the full fresh baseline suite; timing dependent. The suite was not rerun until green.

Evidence: [evidence/ci/tests.log](evidence/ci/tests.log), [evidence/ci/api-assertions.json](evidence/ci/api-assertions.json).

## BUG-002 — Admin approval activates an incomplete DRAFT dealership

Severity: **P1**. Tests: VERIFY-011. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: Authorized Admin; a DRAFT dealership has three document rows in REQUIRED state, with no uploaded verification documents.

Steps:

1. Create a fresh DRAFT dealer through onboarding in the isolated fixture.
2. As Admin, POST /v1/admin/dealers/{dealerId}/approve with an empty JSON body.
3. Read the authoritative dealer status and document checklist.

Expected: Refuse approval and retain a non-ACTIVE state until submission and verification requirements are satisfied.

Actual: HTTP 200; DRAFT became ACTIVE while all three documents remained REQUIRED.

Security/data impact: Server approval bypasses the intended dealer verification gate. Authorized Admins can activate an unverified dealer via direct API.

Reproducibility: One direct HTTP reproduction with DB state, SEC-DISC-001 and its observed row.

Evidence: [evidence/security/api-probes.json](evidence/security/api-probes.json).

## BUG-003 — Timestamp-only cursors omit equal-time saved cars and enquiries

Severity: **P2**. Tests: DATA-DISC-001, DATA-DISC-002, DATA-DISC-003. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: At least three records in the same customer saved/enquiry collection or dealer enquiry inbox have exactly the same createdAt timestamp. This is possible at DB timestamp precision and was forced in the local fixture.

Steps:

1. Use the safe isolated fixture to assign the same createdAt to three existing records.
2. GET /v1/enquiries?limit=1, /v1/saved-vehicles?limit=1 or /v1/dealer/enquiries?limit=1 with the appropriate session.
3. Follow page.nextCursor with limit=1 and compare all visited IDs with the authoritative DB rows.

Expected: Every record appears once, including ties, with a stable secondary key.

Actual: First page contained one row and hasMore=true; the next page contained zero rows while additional equal-time records existed. Reproduced on all three collections.

Security/data impact: Customers and dealership users can miss historical records. No data was deleted. Admin enquiry pagination has a tested ID tie-breaker and did not show this defect.

Reproducibility: Three isolated API/DB reproductions across the affected surfaces.

Evidence: [evidence/security/api-probes.json](evidence/security/api-probes.json), [evidence/security/followup-probes.json](evidence/security/followup-probes.json).

## BUG-004 — Known vehicle media remains public after dealership suspension

Severity: **P2**. Tests: SEC-DISC-002. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: ACTIVE dealer B has a published listing and a known derived public image URL.

Steps:

1. Fetch the listing page/API and its /media/by-media/{mediaId}/{width}.webp URL.
2. Suspend dealer B through the authorized Admin endpoint.
3. Fetch the same listing and image URLs again; inspect status and then reinstate the isolated dealer.

Expected: If suspension removes the listing from public access, public media authorization applies the same dealer visibility rule.

Actual: Listing returned 404 while its known image URL returned 200 during suspension.

Security/data impact: Previously public vehicle photography remains retrievable while the listing is hidden. This probe did not disclose KYC documents or private originals.

Reproducibility: One direct same-URL before/after suspension reproduction.

Evidence: [evidence/security/followup-probes.json](evidence/security/followup-probes.json).

## BUG-005 — A blocked listing mutation commits after membership revocation

Severity: **P1**. Tests: CONCURRENCY-007, CROSS-019. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: An ACTIVE MANAGER has a complete DRAFT listing. A separate local DB connection holds the listing row FOR UPDATE.

Steps:

1. Start MANAGER POST /v1/dealer/vehicles/{vehicleId}/submit and prove it is waiting on the held listing lock using a separate observer connection.
2. As OWNER, DELETE /v1/dealer/team/members/{membershipId}; confirm 204 and REMOVED.
3. Release the listing lock, await the pending response, and inspect listing/member state.
4. Make another protected request using the same manager session.

Expected: After revocation commits, the pending mutation is rejected and the listing remains DRAFT, as required by the campaign’s revocation-before-operation rule.

Actual: Revocation committed, then submission returned 200 and changed the listing to PENDING_REVIEW. The next dealer request returned 401.

Security/data impact: Membership is checked before the blocking transaction and is not revalidated at commit. A revoked actor can complete an in-flight privileged write. It did not publish an ACTIVE listing.

Reproducibility: One controlled and observed lock-order reproduction. An earlier observer-snapshot harness mistake was preserved as BLOCKED and corrected before this reproduction.

Evidence: [evidence/concurrency/revocation-in-flight.json](evidence/concurrency/revocation-in-flight.json).

## BUG-006 — Production configuration accepts the MinIO adapter

Severity: **P1**. Tests: PROD-002. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: Complete generated inert production configuration; no real provider credentials; no provider/network calls.

Steps:

1. Run config-probes.py, which imports the existing env validator in isolated subprocesses.
2. Use NODE_ENV=production, APP_ENV=production and STORAGE_DRIVER=minio with otherwise valid generated configuration.
3. Observe boot validation exit status.

Expected: Production refuses MinIO under the user’s explicit production configuration requirement.

Actual: Validator exited 0 and accepted MinIO. The same probe confirmed rejection of fake OTP, SMTP/Mailpit, dev auth, local disk, memory cache and console mail.

Security/data impact: A configuration mistake can select the forbidden storage adapter at production boot. This demonstrates a guard failure; no deployed storage was contacted.

Reproducibility: One isolated validator reproduction, CONFIG-002.

Evidence: [evidence/security/config-probes.json](evidence/security/config-probes.json).

## BUG-007 — Invalid routes display the default unbranded Next.js 404

Severity: **P2**. Tests: PUBLIC-021, SEO-009. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: Built unchanged web app at localhost; desktop, tablet or mobile Chromium viewport.

Steps:

1. Navigate to /a-route-that-does-not-exist.
2. Inspect HTTP status, visible text and screenshot at 1440, 768 and 390-pixel widths.

Expected: A custom Dealers-Drive not-found experience.

Actual: HTTP 404 with only the local environment ribbon and “404 / This page could not be found.” The Dealers-Drive brand/navigation is absent.

Security/data impact: Invalid public links leave users on a generic dead end. The HTTP status itself is correct.

Reproducibility: Same visible result at all three viewport sizes.

Evidence: [evidence/targeted-browser.json](evidence/targeted-browser.json), [evidence/desktop/not-found.png](evidence/desktop/not-found.png), [evidence/tablet/not-found.png](evidence/tablet/not-found.png), [evidence/mobile/not-found.png](evidence/mobile/not-found.png).

## BUG-008 — Admin pages overflow the mobile viewport

Severity: **P2**. Tests: BROWSER-009. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: Authorized Admin fixture at 390×844 Chromium viewport; Admin uses responsive layouts.

Steps:

1. Open /admin/dealers, /admin/listings and /admin/enquiries.
2. Compare document.documentElement.scrollWidth with innerWidth.
3. Inspect the right edge, table and navigation in the captured screenshots.

Expected: Supported responsive Admin pages remain within the viewport with deliberate contained scrolling for wide tables.

Actual: All three views measured scrollWidth 423 at width 390. The enquiry table and tabs are clipped in the mobile screenshot.

Security/data impact: Admin mobile actions and columns require horizontal page scrolling or become hard to discover. Browser rendering is available, but responsive usability fails.

Reproducibility: Three views plus an independent repeat measurement of the enquiry view.

Evidence: [evidence/targeted-browser.json](evidence/targeted-browser.json), [evidence/admin/final-browser.json](evidence/admin/final-browser.json), [evidence/admin/enquiries.png](evidence/admin/enquiries.png).

## BUG-009 — Dependency audit reports unresolved high-severity advisories

Severity: **P2**. Tests: ADD-AUDIT-001. Status: OPEN. Fix PR: none. Retest: NOT_RUN.

Commit: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Environment: Isolated local Linux / Node 24.19.0 / pnpm 9.15.9 / PostgreSQL 16.14 / Chromium 151.

Preconditions: Unchanged lockfile on the baseline commit and access to the package advisory service.

Steps:

1. Run pnpm audit --audit-level=critical and preserve the result.
2. Run pnpm audit --json to retain advisory details without changing dependencies.
3. Assess installed paths and production reachability before a future dependency fix.

Expected: Launch dependency risks are understood and triaged against deployed paths.

Actual: 24 advisories: 9 high, 12 moderate, 3 low, no critical. The critical threshold exits 0; the default audit exits 1. High advisories include PostCSS, deepmerge-ts, mysql2, undici and brace-expansion.

Security/data impact: Known dependency risks remain untriaged. Advisory presence is confirmed; exploitation and production reachability are not established. P2 is provisional pending that assessment.

Reproducibility: Two registry audit queries against the unchanged lockfile.

Evidence: [evidence/ci/dependency-audit.log](evidence/ci/dependency-audit.log), [evidence/ci/dependency-advisories.json](evidence/ci/dependency-advisories.json).
