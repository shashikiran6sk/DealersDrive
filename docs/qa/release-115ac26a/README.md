# Release certification — Dealers-Drive `115ac26a`

**Release candidate:** `115ac26a077d55bf10ba073129e360fa86f7e37b` (`main` after
[#359](https://github.com/shashikiran6sk/DealersDrive/pull/359)) · **Date:** 2026-10-30 ·
**Environment:** isolated cloud container, Node 24.22.0, PostgreSQL 16, Chromium 141, fake and
fault-injected providers, synthetic data only. No production system, credential, provider or
customer was touched.

This certifies one commit. It re-runs the whole baseline campaign of
[`../production-release/`](../production-release/README.md) (which certified `6e39a9a`) against
the release candidate, retests every defect and decision that campaign raised, and adds four
campaigns for what shipped since: Call dealer and call leads, the login fix, the daily enquiry
summary and the legal v1 gate.

## Verdict

**GO — promote `115ac26a` to production.**

There are no open P0, P1 or P2 defects. Every defect the baseline found (BUG-101 … BUG-113) is
fixed and retested. Every product decision it waited on (UPD-1 … UPD-4) is made and verified.

Nine canonical scenarios remain **BLOCKED**. Each needs something this environment cannot
provide: a real MSG91 account, a managed-database restore, or non-Chromium browsers. None is a
code defect, and all nine were already open at the baseline. They are the owner's checklist
under [Owner actions](#owner-actions), not a reason to hold this code back.

## Counts

### Canonical scenarios

| Expected | Accounted | Missing | Unclassified | PASS | FAIL | BLOCKED | NOT_APPLICABLE |
| -------: | --------: | ------: | -----------: | ---: | ---: | ------: | -------------: |
|      556 |       556 |       0 |            0 |  546 |    0 |       9 |              1 |

Baseline (`6e39a9a`): 542 PASS · 3 FAIL · 10 BLOCKED · 1 NOT_APPLICABLE.

### Additional tests

| Total | PASS | FAIL | BLOCKED | NOT_APPLICABLE |
| ----: | ---: | ---: | ------: | -------------: |
|   138 |  137 |    0 |       0 |              1 |

That is 80 carried over from the baseline plus 58 new:

- 32 call, call-lead and approval checks;
- 12 browser checks;
- 5 daily-summary checks;
- 7 legal-gate checks;
- 2 live retests of BUG-112 and BUG-113.

### Repository gate

CI is green on the identical tree (`3814d0fa`, squash-merged as `115ac26a`):

- lint · typecheck · test · build;
- dependency audit;
- semgrep;
- gitleaks;
- terraform.

Locally on Node 24, before the merge:

| Package   | Tests |
| --------- | ----: |
| contracts |   608 |
| web       | 1,881 |
| api       | 3,527 |

Lint, typecheck and build were green.

`pnpm audit` reports 0 critical, 0 high, 4 moderate and 2 low.

## Areas

| Area                            | Result                                                                |
| ------------------------------- | --------------------------------------------------------------------- |
| Security · tenant isolation     | PASS (44 security, 95 member/identity/RBAC)                           |
| Auth and unified identity       | PASS; 4 MSG91-side checks BLOCKED (real provider)                     |
| #360 login regression           | PASS — Google dealer session, then customer login (BCALL-002)         |
| Dealer and listing lifecycles   | PASS (48 + 74)                                                        |
| Enquiry lifecycle               | PASS — UPD-2 forward-only, every backward move refused (ENQ-LIFE-010) |
| Call dealer and call leads      | PASS (32 API + 12 browser)                                            |
| Admin "Approve for calls"       | PASS                                                                  |
| Daily enquiry summary           | PASS (5) through the real pg-boss schedule and worker                 |
| Legal v1 gate                   | PASS (7) with the gate on, as production runs it                      |
| Public visibility, SEO, caching | PASS (26 public, 15 SEO, stale-suspension windows)                    |
| Failure recovery                | PASS (API and database outage, MSG91 faults)                          |
| Data integrity · concurrency    | PASS (races, pagination, media)                                       |
| Production config               | PASS for boot-time guards; 1 BLOCKED (managed DB restore)             |
| Browsers                        | Chromium desktop, tablet and mobile PASS; 4 BLOCKED (non-Chromium)    |
| Human UAT                       | PENDING — owner                                                       |

## New features, as tested

### Call dealer ([#346](https://github.com/shashikiran6sk/DealersDrive/pull/346))

Evidence: `EVIDENCE/contact-calls`, `EVIDENCE/screenshots/BCALL-*`.

**What customers see**

- Signed out, a visitor sees only **Enquire now** and "Requires login with your mobile number". The number is in no HTML (BCALL-001).
- Signed in, a dealership with an approved number offers **Call dealer** or **Request a callback**. The line "The dealer will see your name and mobile number." is shown first (BCALL-004/005).
- A dealership without an approved number opens the enquiry form directly (BCALL-007, CALL-011).
- After login, `?enquire=1` reopens straight at the choices (BCALL-008).

**The reveal route**

- Anonymous → 401.
- A signed-in customer who has not accepted the terms → 403 from the legal gate.
- Any body field → 400.
- A reserved, sold or withdrawn car → 409.
- Unknown slug → 404.
- No approved number → 404 `CONTACT_UNAVAILABLE`.
- A member revealing their own dealership's number → 422.
- A suspended dealership → 409.
- The response is `no-store`.
- The 11th reveal by one customer in an hour → 429.

**Privacy**

- The number is absent from four API reads and from the car and dealer HTML (PRIV-001).

**Call leads**

- One lead per customer and car:
  - a repeat reveal within 24 h changes nothing;
  - one after 25 h moves the latest time and the count;
  - 10 concurrent reveals make one row.
- Leads create no enquiry.
- Dealers see the customer's current name and number:
  - owner, manager and staff → 200;
  - another dealership sees none;
  - keyset pages do not overlap.
- Admins can narrow by dealership.

**Number approval**

- Managers and staff cannot propose a number.
- An owner's proposal is stored normalised, and the live number is untouched while pending.
- Approval enables calling.
- A rejection leaves the approved number in place.
- An admin edit withdraws approval.
- Admin **Approve for calls**:
  - normalises a legacy onboarding number;
  - is idempotent and audited once;
  - refuses unparseable text (409) and a missing number (409);
  - is visible on the next car-page load (BCALL-011/012).

### Daily enquiry summary ([#359](https://github.com/shashikiran6sk/DealersDrive/pull/359))

Evidence: `EVIDENCE/enquiry-digest`.

- The API registers the schedule `31 8 * * *` in `Asia/Kolkata`.
- One firing sent one summary per admin for the previous IST day.
- The day's boundaries hold: 00:00:00 and 23:59:59 IST are in; the day before and today are out.
- It groups by dealership, with counts and cars.
- Firing again for the same day sends nothing more.
- No per-enquiry admin email exists.

### Legal v1 gate (with `LEGAL_V1_PREVIEW=true`)

Evidence: `EVIDENCE/legal-gate`.

- A customer who has not accepted the terms gets 403 on enquiry, save and the enquiry list, and nothing is written.
- Bad accept bodies → 400.
- Acceptance is idempotent: one row.
- An active dealer is refused by the console until it accepts.
- A DRAFT dealer can still finish onboarding.
- `/enquiries` redirects an unaccepted customer to the terms. It is a streamed redirect: HTTP 200 carrying `NEXT_REDIRECT` and a meta refresh. The page is private and `noindex`.

## Defects and decisions — final status

| ID      | Was                                                      | Fixed by | Retest on `115ac26a`                                     |
| ------- | -------------------------------------------------------- | -------- | -------------------------------------------------------- |
| BUG-101 | Missing car → HTTP 200; outage → 200                     | #337     | SEO-009/010, PUBLIC-015, UAT-OBS-002: 404 / 500 PASS     |
| BUG-102 | `emailVerified` true with no email                       | #340     | AUTH-DISC-002 PASS                                       |
| BUG-103 | Assisted dealerships seeded with no OWNER                | #340     | DATA-DISC-003: 4 assisted, each one OWNER                |
| BUG-104 | Email queue capped at 30/min                             | #340     | PERF-DISC-001: polls every 0.5 s                         |
| BUG-105 | Signed-out `/saved` said "No saved cars yet"             | #339     | UAT-OBS-001: Customer login shown (UPD-3)                |
| BUG-106 | Manual contradicted public visibility (R71)              | #357     | DOC-DISC-002: AGENTS.md invariant 6 is R71               |
| BUG-107 | Not-found title/heading; unformatted number              | #339     | UAT-OBS-002 PASS                                         |
| BUG-108 | High-severity dependency advisories                      | #356     | DEP-DISC-001: 0 high, 0 critical                         |
| BUG-109 | Broken image for a missing photo                         | #339     | STORAGE-005, MEDIA-012 PASS                              |
| BUG-110 | Credits shown while billing is deferred                  | #341     | UAT-OBS-003: no credits in the dealer console (UPD-4)    |
| BUG-111 | Dealer page up about 10 min after out-of-band suspension | #339     | BUG-NEW-010-timing: dealer page drops at 0 s (was 332 s) |
| BUG-112 | Footer support number stale after a config change        | #339     | RETEST-BUG-112: footer value follows the admin change    |
| BUG-113 | Sold car on `/cars` until refresh                        | #343     | RETEST-BUG-113: gone on the next request after sale      |
| UPD-1   | Logout everywhere                                        | decided  | not in V1 — AUTH-012 NOT_APPLICABLE                      |
| UPD-2   | Enquiry transitions                                      | #338     | ENQ-LIFE-007/010 PASS                                    |

### New findings (none blocks release)

| ID             | Sev     | Finding                                                                                                                                                                                                              |
| -------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DISC-CALL-001  | P3      | A revealed **landline** is displayed in mobile grouping: "+91 44234 56789" instead of "044 2345 6789". The `tel:` link and the digits are correct.                                                                   |
| DISC-ADMIN-001 | P3      | The admin dealer page still shows Credit balance and Credits held tiles while billing is deferred. UPD-4 / #341 covered the dealer console only.                                                                     |
| DISC-PERF-001  | info    | `/cars` is about 2× slower than the baseline (sequential p50 58 ms vs 24; 10 concurrent requests p50 372 ms vs 196, p99 727 ms) because #343 no longer caches search results. This is the accepted cost of BUG-113.  |
| DISC-TEST-001  | P3      | `apps/api/tests/legal-v1-migration.test.ts` assumes the legal migration is the newest, so the next migration with a later timestamp breaks it.                                                                       |
| DISC-LINT-001  | trivial | One unused `eslint-disable` in `apps/web/tests/unit/components/ui/classify-photo.test.ts`. It is a warning, not an error.                                                                                            |
| DISC-LEGAL-001 | owner   | The privacy policy does not yet say that Call dealer shares the customer's name and mobile with the dealer. The UI says so before the number is shown. A policy change means a new version that customers re-accept. |

## Owner actions

1. **Promote `115ac26a`** with `promote.yml`. The Release run for it is green and deployed to dev.
   - Migration `20261022100000_dealer_customer_contact` is additive (columns plus a table), so the existing API keeps working against it.
   - If the web deploys `main` to production on its own, promote the API promptly: until then, the dealer and admin **Customer calls** pages and **Approve for calls** call routes that the production API does not have yet.
   - The car page itself degrades safely: no `canCall` means no Call button.
2. **Turn on calling for the dealer whose landline was entered at onboarding.** Open the admin dealer page and choose **Approve for calls**. The migration deliberately leaves existing numbers unapproved. The dealer with no number keeps enquiries only.
3. **The daily summary** starts at the first 08:31 IST after the API is promoted. It needs `JOBS_ENABLED`, and it emails admins who hold `admin:enquiry:read`.
4. **The nine BLOCKED checks:**

   | Checks                        | What they need                                                           |
   | ----------------------------- | ------------------------------------------------------------------------ |
   | AUTH-004 · 006 · 007 · 008    | OTP expiry, attempt cap, resend cap and outage UX, against MSG91 staging |
   | DEPLOY-009 (OP-001)           | An RDS snapshot-restore drill                                            |
   | BROWSER-002 · 003 · 004 · 006 | Safari, Firefox, Edge and iOS Safari on real devices                     |

5. **Human UAT**, using
   [`../production-release/MANUAL-UAT-CHECKLIST.md`](../production-release/MANUAL-UAT-CHECKLIST.md),
   plus the Call dealer flow on a real phone.

## How this run differs from the baseline harness

The scripts are in `harness/`. `run-all.sh` replays everything, then `v01-final-retest.mjs`, then
`finalize.mjs`. Changes, each because `main` changed:

| Change                       | Why                                                                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `world.mjs` vehicle fixture  | #349 replaced the insurance types with `NONE` / `LIVE` and removed `insuranceValidUntil`.                                                                                                |
| `b01` SEO-008                | #354 serves icons at versioned URLs. The check now fetches every icon the page declares instead of `/icon.png`.                                                                          |
| `b03` GOLDEN-002             | The check waits for the enquiry list instead of sampling once, as it already did for the saved list, and also checks the enquiry row in the database.                                    |
| `n01`–`n04` (new)            | The four new campaigns above. They run against a second API pair and a web on `LEGAL_V1_PREVIEW=true` (4003, 4004, 3004).                                                                |
| `v01-final-retest.mjs` (new) | Re-verifies BUG-101 … 113 and UPD-2/3 live, with new checks for BUG-112 and BUG-113. It replaces the baseline's hand-written analysis verdicts and ENQ-LIFE-007's pre-UPD-2 expectation. |
| `registry/triage.json`       | Bug links for fixed defects removed; ENQ-LIFE-010's BLOCKED entry removed now that UPD-2 defines the transitions.                                                                        |

**Environment artefacts seen during the run (not product defects):**

- **Shared rate-limit store.** All API instances share one `cache_counter` table. d05 first hit the per-IP sign-in limit that earlier campaigns had used up, and passed after the counters were cleared. The limiter worked as designed.
- **Shared Next.js cache.** All web instances share one `.next` cache, so SEO-001 once received a page rendered by the local instance. It passed when b01 ran on its own. Production runs one deployment per environment.

To reproduce, follow [`../production-release/TEST-EXECUTION-GUIDE.md`](../production-release/TEST-EXECUTION-GUIDE.md) with these additions:

- **Extra API pair:** start 4003 and 4004 with `LEGAL_V1_PREVIEW=true`. 4004 also has rate limits on.
- **Extra web:** start 3004, with `LEGAL_V1_PREVIEW=true`, pointing at 4003.
- **Environment:** export `CERT_API_LEGAL`, `CERT_API_LEGAL_RL` and `CERT_WEB_LEGAL`.
- **Release SHA:** set `CERT_SHA=115ac26a…` for `finalize.mjs`.

## Records

| Path                                                   | Content                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `registry/results.final.json`, `TEST-TRACEABILITY.csv` | Every verdict, after triage, with its evidence and defect link                           |
| `registry/results/*.json`                              | Per-area harness verdicts                                                                |
| `EVIDENCE/<area>/api-log.json`                         | Sanitised request logs: tokens, cookies and signatures redacted, mobiles masked          |
| `EVIDENCE/screenshots/`                                | The new and changed screens (BCALL-_, UAT-OBS-_, GOLDEN-002). Others match the baseline. |
| `EVIDENCE/performance/`                                | Latency smoke (p01)                                                                      |
| `EVIDENCE/final-counts.json`                           | The counts above                                                                         |
