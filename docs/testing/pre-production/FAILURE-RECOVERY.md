# Recovery evidence and unexecuted failures

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

Complete API, DB, storage, OTP, Google and mail outage injection was not performed through the browser. Production restart/drain, ambiguous network timeout retries, backup restore and failed migration rollback are BLOCKED. Adapter and UI failure tests passed in the repository suite but are not a substitute for these full recovery scenarios.

Exercised recovery interactions: filter refresh/back/forward; gallery close/reopen/Escape; OWNER invite cancellation/reopen; persisted STAFF draft refresh; customer history refresh after closure. Browser original-attempt logs and later harness limitations remain in evidence. Shared local sign-in bucket exhaustion blocked repeated login; no rate-limit setting was disabled to manufacture successful authentication.

Infrastructure setup failures were contained: Docker registry pull hit rate limits, so an isolated bundled PostgreSQL 16 binary was used; the first Turbo reporter invocation was rejected before tests; an Admin fixture helper initially lacked the allowlist env and was corrected before browser setup completed. These are test-environment incidents, not product recovery certification.

Evidence: [browser attempts](evidence/desktop/uat.json), [mobile journey](evidence/golden-browser.json), [suite CLI attempt](evidence/ci/tests-cli-attempt.json), TEST-PLAN.md. Real provider and production recovery verification is required before launch.
