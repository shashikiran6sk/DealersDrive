# Release readiness report

| Field                      | Value                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Audited commit             | `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2` (`main`, #330; tree = production commit `a969dc2c` + #332, #335, #330)                                                                                                        |
| Date                       | 2026-10-20 15:24 UTC → 2026-10-21 UTC                                                                                                                                                                                    |
| Environment                | isolated container: Node 24.22.0, PostgreSQL 16.15 (56 migrations), Chromium 141; fake/fault-injected OTP, console mail, local and fake-S3 storage                                                                       |
| Baseline                   | 556 canonical scenarios (validated: 556 parsed, 0 duplicate, 0 missing) + 80 discovered = 636. The "v2.0 / 676" baseline does not exist in the repository ([ACCEPTANCE-BASELINE-PR304.md](ACCEPTANCE-BASELINE-PR304.md)) |
| Database migration version | 56 applied, latest `20261012110000_dealer_portfolio_and_yard_visits`                                                                                                                                                     |

## Executive summary

Dealers-Drive at `6e39a9a` held up against everything this campaign could throw at it from
the inside: **no P0, no P1, no authorization or tenant-isolation failure, no data loss, no
lifecycle corruption, no secret exposure.** 5,754 repository tests pass; 542 of 556 canonical
scenarios pass on executed evidence; every race, revocation, suspension and role change was
judged on the authoritative database rows.

**The verdict is nevertheless NO-GO**, because the launch gates require evidence this
environment cannot produce and which has not yet been produced elsewhere:

1. the managed-database backup/restore procedure is unverified (DEPLOY-009 — infrastructure,
   not human UAT);
2. real-provider behaviour (MSG91 expiry/attempt/resend caps, Google OAuth, Resend
   deliverability, R2) and Safari/Firefox/Edge/iOS are unverified (BLOCKED, human checklist);
3. one product decision is open (the enquiry state machine, UPD-2); logout-all (UPD-1) was
   decided "not for V1" on 2026-10-21;
4. mandatory human UAT is pending.

None of these is a known product defect. Once OP-001 (restore drill) passes, the two decisions
are recorded and the P0/P1 human checks in [MANUAL-UAT-CHECKLIST.md](MANUAL-UAT-CHECKLIST.md)
pass, the evidence supports **GO**; fixing BUG-101 (P2) first is recommended but not a gate.

## Counts (from `EVIDENCE/final-counts.json`)

|            | PASS | FAIL | BLOCKED | NOT_RUN |               MANUAL_REQUIRED | NOT_APPLICABLE | Total |
| ---------- | ---: | ---: | ------: | ------: | ----------------------------: | -------------: | ----: |
| Canonical  |  542 |    3 |      10 |       0 | (8 of the BLOCKED, see below) |              1 |   556 |
| Discovered |   70 |    9 |       0 |       0 |                             0 |              1 |    80 |

Accounted 556 / 556 · missing 0 · unclassified 0. NOT_RUN is 0: every scenario was either
executed or is BLOCKED with its reason. Of the 10 BLOCKED canonical scenarios, 8 are waiting on
real providers or real browsers (manual), 1 on an owner decision and 1 (DEPLOY-009) on
infrastructure. The one NOT_APPLICABLE is AUTH-012 (logout-all), by owner decision UPD-1.

| Canonical FAIL                                                                 | Defect  | Severity |
| ------------------------------------------------------------------------------ | ------- | -------- |
| SEO-009 — invalid car URL is not a 404                                         | BUG-101 | P2       |
| SEO-010 — car page during an API outage is not an error status                 | BUG-101 | P2       |
| MEDIA-012 — vehicle card shows a broken image when its photo object is missing | BUG-109 | P3       |

| Canonical BLOCKED                      | Why                                                                                                                                          | Owner             |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| AUTH-004, AUTH-006, AUTH-007, AUTH-008 | OTP expiry, attempt/resend caps and outage UX are enforced by MSG91; the server's handling of MSG91's verdicts is proved (AUTH-DISC-003…005) | HUMAN-UAT-002/003 |
| BROWSER-002, -003, -004, -006          | Safari, Firefox, Edge, iOS Safari not available here                                                                                         | HUMAN-UAT-016/017 |
| AUTH-012                               | Logout-all: no route and no documented decision (UPD-1)                                                                                      | Product owner     |
| ENQ-LIFE-010                           | No invalid enquiry transition is defined (UPD-2)                                                                                             | Product owner     |
| DEPLOY-009                             | Managed-database snapshot/PITR restore not exercisable here; a logical restore drill passed (DEPLOY-010)                                     | Operator, OP-001  |

## Defects

| Severity | Open | IDs                                                        |
| -------- | ---: | ---------------------------------------------------------- |
| P0       |    0 | —                                                          |
| P1       |    0 | —                                                          |
| P2       |    1 | BUG-101 car pages answer HTTP 200 for not-found and outage |
| P3       |   10 | BUG-102 … BUG-111                                          |

Details: [DEFECT-REGISTER.md](DEFECT-REGISTER.md).

## Assessments

| Area                      | Result                                    | Basis                                                                                                        |
| ------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Automated suite           | **PASS**                                  | 5,754 / 5,754; coverage gate met; lint, types, build green                                                   |
| Authentication & sessions | **PASS** (provider-side BLOCKED)          | wrong/replayed/cross-number tokens refused; admin/person sessions isolated; revocation immediate             |
| Authorization & RBAC      | **PASS**                                  | every role × privileged action on the API; admin role matrix; disable/role change apply next request         |
| Tenant isolation          | **PASS**                                  | no cross-dealer, cross-customer or cross-rep success; 404 without existence leak                             |
| Unified identity          | **PASS**                                  | one person, one session across contexts; switching by membership                                             |
| Dealer lifecycle          | **PASS**                                  | suspension/reinstatement preserve everything; console path immediate; out-of-band window by design (BUG-111) |
| Listing lifecycle         | **PASS**                                  | transitions only via `transition()`; SOLD terminal; reactivation admin-only                                  |
| Enquiry lifecycle         | **PASS** with decision pending            | permissions enforced; state machine undefined (UPD-2)                                                        |
| Admin                     | **PASS**                                  | members, roles, Sales separation, verification badge rules, moderation, support desk                         |
| Data integrity            | **PASS**                                  | FKs, uniqueness, actor attribution, audit survival, restore drill identical                                  |
| Concurrency               | **PASS**                                  | every race resolved to one valid state                                                                       |
| Security                  | **PASS**                                  | [SECURITY-AUDIT.md](SECURITY-AUDIT.md): 0 P0/P1; stored XSS inert; storage and KYC locked                    |
| Migration                 | **PASS locally**, production unverified   | 56 migrations on a fresh PostgreSQL 16; OP-002 for the production copy                                       |
| Production configuration  | **PASS (guards)**; live values unverified | boot refuses every unsafe override; OP-003 for live values                                                   |
| SEO & accessibility       | **FAIL (BUG-101)** / PASS                 | soft-404/soft-5xx on car pages; keyboard, names, focus, labels pass                                          |
| Performance               | **PASS (local)**                          | every p95 ≤ 363 ms at 10 clients vs a 1 s budget; e-mail queue ceiling 30/min (BUG-104)                      |
| Agent UAT                 | **PASS**                                  | [AGENT-UAT.md](AGENT-UAT.md)                                                                                 |
| Human UAT                 | **PENDING**                               | [MANUAL-UAT-CHECKLIST.md](MANUAL-UAT-CHECKLIST.md)                                                           |

## DEALERS-DRIVE PRODUCTION LAUNCH VERDICT

**Audited Git SHA:** `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`

**Baseline:** PR #304 + newly discovered scenarios (556 canonical + 80 discovered; no "v2.0 / 676" file exists)

**Total Acceptance Scenarios:** 636

**Automated PASS:** 612 (canonical 542 · discovered 70)

**Automated FAIL:** 12 (canonical 3 · discovered 9) — all mapped to BUG-101…111

**BLOCKED:** 10

**NOT_RUN:** 0

**MANUAL_REQUIRED:** 8 of the BLOCKED (real providers and browsers) + 22 human checks pending

**NOT_APPLICABLE:** 2 (canonical 1 — AUTH-012, owner decision UPD-1 · discovered 1)

**Critical Journeys Passed:** 10 / 10 golden paths in the browser (GOLDEN-001…010); 3 / 3 mid-journey outage and refresh checks (u04); 47 / 47 Agent UAT steps

**P0 Open:** 0

**P1 Open:** 0

**P2 Open:** 1 (BUG-101)

**P3 Open:** 10 (BUG-102 … BUG-111)

**Security Assessment:** no authentication, authorization, admin or tenant bypass; no secret or KYC exposure; stored XSS inert; one P3 dependency-hygiene item.

**Performance Assessment:** within the repository's alert budget locally (worst p95 363 ms at 10 concurrent clients); notification e-mail capped at 30/min per worker; production-path timing unmeasured.

**Data Integrity Assessment:** no lifecycle change deleted or corrupted child history; restore drill identical on 17 counts and relationship hashes; 0 unvalidated FKs.

**Manual UAT Remaining:** all 22 human checks and 4 operator checks in MANUAL-UAT-CHECKLIST.md; P0 first.

**Final Recommendation: NO-GO**

**Top Launch Blockers:** (1) managed-database restore unverified — DEPLOY-009/OP-001; (2) real-provider OTP, OAuth, e-mail and storage unverified — HUMAN-UAT-001…005, 018, 019; (3) Safari/Firefox/Edge/iOS unverified — HUMAN-UAT-016/017; (4) product decision UPD-2 (enquiry transitions); (5) human UAT pending. No product defect blocks launch.

**Required Actions Before Launch:** run OP-001…OP-003 on staging/production copies; complete the P0 and P1 human checks on a staging deployment of exactly `6e39a9a`; record UPD-2…UPD-4 (UPD-1 recorded: logout-all not for V1); fix BUG-101 (recommended) and re-run SEO-009/010; re-run `harness/run-all.sh` on any later commit before calling it certified.

**Evidence and Report Locations:** `docs/qa/production-release/` — this report, [FINAL-CERTIFICATION.md](FINAL-CERTIFICATION.md), [TEST-TRACEABILITY.csv](TEST-TRACEABILITY.csv), `EVIDENCE/`, `registry/results.final.json`, `harness/`.
