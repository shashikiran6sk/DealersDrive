# Final baseline decision — NO GO

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

**NO GO.** Baseline assessment is complete as a dossier; launch certification is blocked by three OPEN P1 defects, the failed repository suite, 305 unverified canonical scenarios and pending independent human verification.

Tested exact `origin/main` SHA: `d6ae115359c4d0ae7ab0fd5115336291666cbb08`. Branch: `test/pre-production-baseline-d6ae115`. All runtime tests and browser observations used this unchanged application. Only certification documentation, harnesses and synthetic local data were added; no fixes, commits, PRs, merges or production writes were performed.

| Required accounting                |          Result |
| ---------------------------------- | --------------: |
| Expected / parsed / accounted      | 556 / 556 / 556 |
| PASS                               |             244 |
| FAIL                               |               7 |
| BLOCKED                            |             305 |
| NOT_APPLICABLE                     |               0 |
| Missing / duplicate / unclassified |       0 / 0 / 0 |
| Human results PENDING              |             556 |

The supplied headings understated ENQ-CREATE by one and ADMIN-DEALER by one. The preserved numbered scenarios include ENQ-CREATE-018 and ADMIN-DEALER-010; none was dropped. [Completeness evidence](evidence/final-counts.json) and [registry validation](evidence/registry-validation.json) preserve this correction.

OPEN P1 blockers:

1. **BUG-002:** incomplete DRAFT dealership becomes ACTIVE through Admin approval API.
2. **BUG-005:** revoked manager’s blocked submission commits after removal.
3. **BUG-006:** production validator accepts MinIO despite the explicit production requirement.

OPEN P2 findings: invitation race HTTP 500, omitted timestamp-tied saved/enquiry records, publicly available images after suspension, unbranded 404, Admin mobile overflow, and untriaged dependency advisories. P0: 0. Total bugs: 9; P1: 3; P2: 6. [BUG-REPORT.md](BUG-REPORT.md) gives reproducible steps and evidence.

Fresh typecheck, build and all 39 migrations passed. The final uncached lint/format/docs run also passed after dossier generation ([log](evidence/ci/final-lint.log)). The full test command **failed**: API 2,585/2,586, web 1,284/1,284, contracts 420/420; total 4,289 passed and one failed assertion. Fresh API coverage was not verified. Direct DB-backed probes and actual mobile/desktop/tablet Chromium journeys supplemented the suite, including mobile enquiry contact/closure with authoritative actor/timestamp checks.

Outstanding release checks include real Google/MSG91/email/object storage, intended production DB/origins/cookies, other browser engines and real devices/keyboards, comprehensive outage recovery, production backup restore/deployment/Terraform, all blocked exact canonical scenarios and every independent human sign-off. Local performance and successful mocked-provider assertions are limited evidence; no success percentage is used as a release decision.

Proceed to [HUMAN-UAT.md](HUMAN-UAT.md) only in an authorized isolated environment with accessible URL and disposable fixtures. Product owner results remain PENDING. Fix proposals require a separate authorized fix phase; the baseline stops here without changing application behavior.

Review entry points: [test results](TEST-RESULTS.md), [556-row registry](CANONICAL-TEST-REGISTRY.md), [layer/evidence matrix](TEST-COVERAGE-MATRIX.md), [bug report](BUG-REPORT.md), [browser UAT](AGENT-UAT.md), [retest status](RETEST-REPORT.md).
