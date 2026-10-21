# Dealers-Drive Release Certification

**Release candidate SHA:** `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`
**Date:** 2026-10-21
**Environment:** isolated local pre-production simulation (Node 24.22.0, PostgreSQL 16.15, Chromium 141, fake/fault-injected providers). No production system was touched.

This is the **baseline** certification: no defect has been fixed, so there is no fix PR and
no retest yet ([RETEST-REPORT.md](RETEST-REPORT.md) §3). The executive report with every
justification is [RELEASE-READINESS-REPORT.md](RELEASE-READINESS-REPORT.md).

## CANONICAL TESTS

| Expected | Accounted | Missing | Unclassified |
| -------: | --------: | ------: | -----------: |
|      556 |       556 |       0 |            0 |

| PASS | FAIL | BLOCKED | NOT_APPLICABLE |
| ---: | ---: | ------: | -------------: |
|  542 |    3 |      11 |              0 |

## ADDITIONAL DISCOVERED TESTS

| Total | PASS | FAIL | BLOCKED | NOT_APPLICABLE |
| ----: | ---: | ---: | ------: | -------------: |
|    80 |   70 |    9 |       0 |              1 |

By origin: audit of features merged since `8436820` 20 · security 22 · regression of earlier findings 27 · exploratory/analysis 11.

## AREAS

| Area              | Result                                                        |
| ----------------- | ------------------------------------------------------------- |
| AUTOMATED SUITE   | PASS (5,754 / 5,754)                                          |
| AGENT BROWSER UAT | PASS                                                          |
| HUMAN UAT         | PENDING                                                       |
| SECURITY          | PASS                                                          |
| TENANT ISOLATION  | PASS                                                          |
| RBAC              | PASS                                                          |
| UNIFIED IDENTITY  | PASS                                                          |
| DEALER LIFECYCLE  | PASS                                                          |
| LISTING LIFECYCLE | PASS                                                          |
| ENQUIRY LIFECYCLE | PASS (state-machine decision UPD-2 pending)                   |
| ADMIN             | PASS                                                          |
| MIGRATION         | PASS on a fresh database; production copy unverified (OP-002) |
| DATA INTEGRITY    | PASS                                                          |
| PRODUCTION CONFIG | PASS for boot-time guards; live values unverified (OP-003)    |

## DEFECTS

| Open P0 | Open P1 | Open P2 | Open P3 |
| ------: | ------: | ------: | ------: |
|       0 |       0 |       1 |      10 |

## OUTSTANDING PRODUCT DECISIONS

UPD-1 logout-all (AUTH-012) · UPD-2 enquiry transitions (ENQ-LIFE-010) · UPD-3 signed-out
`/saved` (BUG-105) · UPD-4 credits while billing is deferred (BUG-110).

## LAUNCH GATE

**NO GO** — no product defect blocks launch (0 P0, 0 P1), but required evidence is missing:
the managed-database restore (DEPLOY-009), real-provider and non-Chromium checks (8 BLOCKED),
two product decisions and the human UAT. See RELEASE-READINESS-REPORT.md, "Required actions".
