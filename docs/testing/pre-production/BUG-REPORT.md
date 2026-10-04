# Authorized fix campaign — current status

Original baseline bytes below are preserved. No PR has been merged. Human UAT PENDING. Production NO GO until remaining fixes and complete-stack certification pass.

| Finding                                        | PR / branch                                                           | Agent retest / CI                                                                                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BUG-007 branded 404                            | #209 `claude/serene-thompson-yuft81`                                  | PASS; final107a462 CI358/Security507 PASS                                                                                                                                                               |
| BUG-001 invitation race / NEW-002              | #231 `fix/pre-production-01-invitation-race`                          | PASS; final1f38a13 CI361/Security510 PASS                                                                                                                                                               |
| BUG-002 activation / NEW-003 / NEW-004         | #232 `fix/pre-production-02-approval-gate`                            | PASS; final3570dcf CI363/Security512 PASS                                                                                                                                                               |
| BUG-NEW-005 destructive rejection              | #233 `fix/pre-production-new-005-rejection-race`                      | PASS; finald29d9b9 CI366 attempt2/Security515 PASS                                                                                                                                                      |
| BUG-003 DATA-DISC-001/002/003                  | #234 `fix/pre-production-03-stable-pagination`                        | Baseline FAIL retained; scoped Agent PASS; 4428 tests, nine browser cases with refresh/back PASS at20c1b39; lint/typecheck/build PASS; final62b1491 actual CI368/Security517 PASS                       |
| BUG-004 SEC-DISC-002                           | #235 `fix/pre-production-04-suspended-media`, base #234               | Vehicle media Agent PASS at3aa48c4; 4440 tests/three browser widths; lint/typecheck/fresh build PASS; history scan PASS; #235 finaladeb847 actualCI370/Security519 PASS                                 |
| BUG-005 CONCURRENCY-007 / CROSS-019            | `fix/pre-production-05-membership-commit-guard`, base #235; #236 open | Baseline FAIL retained; scoped Agent PASS at69cfc0d;4506 full tests/38 target/335 unit/201 adjacent/three browser widths PASS; lint/typecheck/fresh build/DB PASS; history scan PASS; actual CI pending |
| BUG-006 / BUG-008                              | Not started                                                           | Original findings retained; NOT_RUN                                                                                                                                                                     |
| BUG-NEW-012 queued enquiry revocation          | Next dedicated layer after BUG-005 CI                                 | OPEN P1; real-cookie/API/DB reproduction retained                                                                                                                                                       |
| BUG-NEW-011 media width prose                  | Separate later layer                                                  | OPEN P3; width500/4000 accepted contrary to prose                                                                                                                                                       |
| BUG-NEW-008 /009 /010                          | Separate later layers                                                 | OPEN P2: local PDF MIME, public yard visibility and warmed car page cache                                                                                                                               |
| BUG-NEW-006 mobile onboarding                  | Dedicated later layer                                                 | OPEN P2: viewport390 / scrollWidth518                                                                                                                                                                   |
| BUG-NEW-007 inventory pagination               | Dedicated later layer                                                 | OPEN P2: DB51 / visited1, pages1+0; reproduced atc0d8e3a                                                                                                                                                |
| BUG-009 dependencies / BUG-NEW-001 log privacy | Dedicated assessment/fix pending                                      | Provisional OPEN                                                                                                                                                                                        |

[BUG-003 report](../fixes/BUG-003/README.md) records original red evidence, keyset root correction, supporting Admin test-oracle correction, complete assertions, API/DB lifecycle/authorization checks and browser screenshots. Its base is NEW-005, preserving the accumulated stack. Inventory source is unchanged; [new findings](new-bugs.json) records its separate reproduction.

[NEW-005 report](../fixes/BUG-NEW-005/README.md) preserves destructive-race and rollback red evidence. Its final head d29d9b9 passed actual CI366 attempt2 and Security515. First-attempt unchanged Next font-loader failure was investigated and retained; same-head rerun passed a fresh build and 4404 tests. VERIFY-012 original baseline BLOCKED remains unchanged. Functional UAT does not certify BUG-008 Admin overflow424 or NEW-006 onboarding overflow518.

See [STACK-MAP.md](STACK-MAP.md) for dependencies. Full 556-case recomputation, complete-stack regression, provider/deployment, real-device and human gates remain pending.

[BUG-004](../fixes/BUG-004/README.md) preserves SEC-DISC-002 additional baseline FAIL and exact-parent red evidence. Fresh API and vehicle image checks pass after suspension; warmed public page remains FAIL under NEW-010 and public yard image under NEW-009. Private local PDF MIME is NEW-008. These remain separate OPEN findings, not silently fixed or certified. DATA-DISC and SEC-DISC are additional probes; their results do not rewrite the556 canonical classifications.

[BUG-005](../fixes/BUG-005/README.md) retains exact-parent race red evidence and canonical baseline FAIL. Vehicle writes revalidate locked authority after resource waits. Browser owner-removal/queued-submit/refresh/personal-history checks pass at1440/768/390. Enquiry revocation remains a separately confirmed P1, BUG-NEW-012, scheduled for the next layer.

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
