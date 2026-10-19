# Pre-production baseline dossier

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

**Decision: NO GO.** Read [FINAL-CERTIFICATION.md](FINAL-CERTIFICATION.md) and [BUG-REPORT.md](BUG-REPORT.md) first.

- [CANONICAL-TEST-REGISTRY.md](CANONICAL-TEST-REGISTRY.md)
- [TEST-PLAN.md](TEST-PLAN.md)
- [TEST-RESULTS.md](TEST-RESULTS.md)
- [TEST-COVERAGE-MATRIX.md](TEST-COVERAGE-MATRIX.md)
- [LIFECYCLE-MATRIX.md](LIFECYCLE-MATRIX.md)
- [RBAC-MATRIX.md](RBAC-MATRIX.md)
- [IDENTITY-MATRIX.md](IDENTITY-MATRIX.md)
- [API-SECURITY.md](API-SECURITY.md)
- [TENANT-ISOLATION.md](TENANT-ISOLATION.md)
- [DATA-INTEGRITY.md](DATA-INTEGRITY.md)
- [CONCURRENCY.md](CONCURRENCY.md)
- [FAILURE-RECOVERY.md](FAILURE-RECOVERY.md)
- [BROWSER-COMPATIBILITY.md](BROWSER-COMPATIBILITY.md)
- [RESPONSIVE-QA.md](RESPONSIVE-QA.md)
- [ACCESSIBILITY-QA.md](ACCESSIBILITY-QA.md)
- [SEO-QA.md](SEO-QA.md)
- [PRODUCTION-CONFIG-QA.md](PRODUCTION-CONFIG-QA.md)
- [PERFORMANCE-SMOKE.md](PERFORMANCE-SMOKE.md)
- [AGENT-UAT.md](AGENT-UAT.md)
- [HUMAN-UAT.md](HUMAN-UAT.md)
- [BUG-REPORT.md](BUG-REPORT.md)
- [RETEST-REPORT.md](RETEST-REPORT.md)
- [FINAL-CERTIFICATION.md](FINAL-CERTIFICATION.md)

Machine records: registry.json, bugs.json, additional-tests.json, evidence/final-counts.json and verify-dossier.py. Run `python3 docs/testing/pre-production/verify-dossier.py` from the repository root. Each canonical scenario has a status, method, reason, evidence/limitation, bug link if failed, no fix PR, NOT_RUN retest and PENDING human result.

Harness scripts are optional replay tools for disposable isolated databases; they mutate synthetic fixtures and are not idempotent general production utilities. Never replay them against shared/production resources. Private session fixtures and browser storage state remain outside this directory under /tmp; do not commit or share them. Evidence images show fictional accounts/numbers and deliberately synthetic JPEGs. Logs are sanitized.

Status semantics: PASS is scoped executed behavior; FAIL is a confirmed deviation; BLOCKED is missing execution, unavailable environment/provider or unestablished product expectation; NOT_APPLICABLE is reserved for proven inapplicability and unused here. Empty evidence directory READMEs are placeholders, never PASS. Original harness mistakes are preserved, not product failures. No source fix or repeat-until-green suite run occurred.
