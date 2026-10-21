# Retest report

Audited commit `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`. Two kinds of retest are recorded
here: (1) every finding of the earlier certification and fix campaigns (`testing_branch`,
certified `8436820`), re-run on the current commit to catch regressions; (2) every check of this
campaign that was changed and re-run, with the reason — so no verdict appears without its history.

## 1. Earlier findings re-run on 6e39a9a

| Earlier finding (fixed in)                                                                   | Retest                                                                  | Result on 6e39a9a                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ORIG-BUG-001 P0 — forged `/uploads` / `/private` signatures with the committed secret (#241) | SEC-DISC-001a–c, CAMPAIGN-01, R237-ORIG-BUG-001                         | **Still fixed.** S3-driver API: forged PUT and read → 404 (stand-ins not mounted); production refuses the local driver                                                                                                                                                      |
| ORIG-BUG-004 P1 — ACTIVE dealer could replace/delete verified KYC (#242)                     | API-DISC-001…003, CAMPAIGN-02                                           | **Still fixed**, re-expressed for #299's two categories: presign and delete → 409 DOCUMENT_LOCKED, rows and files intact                                                                                                                                                    |
| BUG-NEW-010 P1 — warmed car page public after suspension (#243, #251)                        | BUG-NEW-010-console-timing, GOLDEN-008, CAMPAIGN-03, BUG-NEW-010-timing | **Content still fixed** — the car and dealer pages stop serving the dealership within 0.1 s of a console suspension. **The status code regressed**: the car page now answers 200 with the not-found document, not 404 → **BUG-101 (P2)**. Out-of-band window → BUG-111 (P3) |
| BUG-NEW-012 — queued enquiry write after removal (#244)                                      | BUG-NEW-012-queued-enquiry-close-after-removal, retest-new012           | Still fixed (401, enquiry NEW)                                                                                                                                                                                                                                              |
| ORIG-BUG-005 + BUG-NEW-009 — yard photo bypassed moderation / public while suspended (#245)  | CAMPAIGN-05, R235-yard-photo-while-suspended, API-DISC-004              | Still fixed; the route is gone (#299), approved portfolio photo 404 while suspended                                                                                                                                                                                         |
| BUG-NEW-013 — production r2 accepted a missing/loopback endpoint (#246)                      | R237-BUG-NEW-013                                                        | Still fixed (both refused)                                                                                                                                                                                                                                                  |
| BUG-NEW-007 — inventory lost tied rows (#247)                                                | R234-*, CAMPAIGN-07                                                     | Still fixed (all four lists)                                                                                                                                                                                                                                                |
| BUG-NEW-006 / ADMIN-MOBILE-DETAIL-001 — mobile overflow (#248)                               | BUG-NEW-006, BROWSER-009, Agent UAT                                     | Still fixed (0 px overflow at 320/390)                                                                                                                                                                                                                                      |
| ORIG-GAP-CLOSE — no closure for DRAFT/in-review (#249)                                       | CAMPAIGN-09, ORIG-GAP-CLOSE, DEALER-LIFE-017                            | Still fixed                                                                                                                                                                                                                                                                 |
| BUG-NEW-008 / BUG-NEW-011 — PDF type, width docs (#250)                                      | BUG-NEW-008, BUG-NEW-011                                                | Still fixed                                                                                                                                                                                                                                                                 |
| #232 approval prerequisites, #233 approve/reject race, #235 media follows dealer status      | R232-_, R233-_, R235-*                                                  | Still fixed (8/8 races valid)                                                                                                                                                                                                                                               |

## 2. Changes to checks in this campaign

### 2a. Harness drift from intended product changes (corrected, re-run)

| Check                                      | Product change                                                                                   | Correction                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Admin sessions (all)                       | #293 isolated `dd_admin_session`                                                                 | session minting and browser cookie use the admin cookie    |
| World onboarding, ONBOARD-012, CAMPAIGN-09 | #299 two document categories, #302 GSTIN on the certificate                                      | presign/commit by category; two documents, not three       |
| PROFILE-006                                | #292 optional tagline (short values valid)                                                       | invalid = over 200 characters                              |
| PROFILE-007, R235, CAMPAIGN-05             | #289/#299 yard photo optional, replaced by moderated portfolio photos                            | use an approved portfolio photo                            |
| STORAGE-004                                | #299 delete by category resets the slot                                                          | assert slot REQUIRED + object deleted                      |
| R235 cache header                          | R108 public images `no-cache` + ETag                                                             | expect `no-cache` before, `no-store` on denial             |
| R237-ORIG-BUG-001                          | #241 stand-ins local-only                                                                        | judge the real condition, not "default secret present"     |
| GOLDEN-003                                 | #299 two documents                                                                               | verify each document offered                               |
| UX-004                                     | #291 the configuration page grew past the 150-press tab walk; controls behind closed `<details>` | open disclosures with the keyboard, walk up to 600 presses |
| UX-008                                     | (harness) name computed from the DOM                                                             | use the browser's accessible name (ARIA snapshot)          |

### 2b. Inherited checks that passed for the wrong reason (rewritten, re-run)

Listed in [TEST-PLAN.md §26](TEST-PLAN.md): API-DISC-001/003, STORAGE-002, ONBOARD-006, AUTH-014,
API-SEC-007, MEDIA-003, MEDIA-004, MEDIA-009…012, PROD-009…013, STORAGE-002↔003,
RECOVERY-002/003/009. Each now asserts the scenario's own behaviour; MEDIA-012 turned from an
API-level PASS into a browser FAIL (BUG-109) as a result.

### 2c. Reclassified after review (`registry/triage.json`, harness verdict kept)

| Scenario                  | Harness        | Final          | Why                                                        |
| ------------------------- | -------------- | -------------- | ---------------------------------------------------------- |
| AUTH-012                  | NOT_APPLICABLE | BLOCKED        | the "owner decision" it cited is not documented anywhere   |
| ENQ-LIFE-010              | PASS           | BLOCKED        | no invalid enquiry transition is defined to reject (UPD-2) |
| BUG-NEW-010 (65 s sample) | FAIL           | NOT_APPLICABLE | superseded by the measured BUG-NEW-010-timing              |

### 2d. My own harness mistakes, found from the evidence and fixed

- d01: expected 200 where the API correctly answers 201; wrong table/column names
  (SUPPORT-DISC-005/006, NOTIFY-DISC-001, DOC-DISC-001).
- d04: compared an empty result (a failed UNION) and reported "identical"; now requires all
  17 values and a clean query.
- NOTIFY-DISC-001: a 10-digit dealer-name suffix matched as a "phone number"; scoped to
  customer-facing templates.
- `merge.mjs`: timestamp precedence let earlier verdicts win after files were reformatted
  (MEDIA-012, DEPLOY-010); replaced by `run-all.sh` order.
- u01 Back/Forward, GOLDEN-002 timing — see [AUTOMATED-TEST-REPORT.md §3](AUTOMATED-TEST-REPORT.md).

## 3. Not yet retested

Nothing has been fixed in this campaign, so there is no fix to retest. When BUG-101…111 are
fixed, re-run the scenario(s) named in each defect entry plus the full `run-all.sh`; keep the
baseline FAIL here and add the PR and the retest result beside it.
