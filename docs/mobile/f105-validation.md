# F105 consent and enquiries — validation checkpoint

Immediate base: F104 feat/f104-mobile-saved-account at 1f0d258db5b84fe09981aba7ce04ef9af1be2694 / draft PR #317. Its reported GitHub CI/security/preview checks pass. Legal foundation #279 remains OPEN at 6180a4b; main remains a969dc2. No predecessor history was rewritten.

Native enquiry preparation/submission, authoritative sharing-notice reader, cursor enquiry history/own detail and dealership/legacy withdrawal controls are implemented. Existing legal/grant/enquiry services and strict DTOs are reused. Lean enquiry-client/legal-client exports exclude policy archives and privileged DTOs, preserving original web/API exports. No new endpoint, database migration, dependency, policy activation or website UI change.

Local evidence:

- Native: 16 suites / 77 tests PASS, typecheck/lint/platform boundaries and approved brand-asset checks PASS. Tests exercise fresh unticked consent, same-dealer reuse, changed receiver during preflight, repeated submits, uncertain delivery, account-switch state isolation, explicit withdrawal and stale-account confirmation denial.
- API: 179 files / 3,501 tests PASS before the final added transport case; existing coverage gates pass (statements 95.70%, branches 90.30%, functions 97.93%, lines 96.95%). The subsequent full legal integration file with the added native/browser case passes 25 tests, including native create, browser reuse, foreign denial, native withdrawal and fresh browser re-grant.
- Contracts: 28 files / 596 tests PASS, coverage gates unchanged. Website: 144 files / 1,727 tests PASS. Root lint/typecheck/build PASS; final Android Hermes export PASS (4MB bundle; not a measured performance claim).

External OTP/mail providers are fake in local integration runs; only the explicitly configured local test database is reset/migrated. Existing pg deprecation warnings and an intermittent inherited FilterDialog test act warning remain diagnostics; tests/builds succeed. No native Android installation, screenshot, performance, real dealer notification or live-provider evidence is claimed.

Release blockers remain approved policy publication/enforcement, installed Android/device/live-provider verification, signing/Play approvals and the unresolved verified account-deletion/retention procedure. Account sharing acknowledgment and dealership permission remain distinct. No automatic enquiry POST retry or restart replay is implemented: uncertain delivery requires checking history, and the existing server open-enquiry rule prevents a second open record.

Rollback: reject or normally revert this unmerged native integration; no new data migration. Keep grant/withdrawal-aware foundation services and immutable evidence. Never roll the backend behind PR #279's consent model after evidence exists. See [internals](../code/mobile/enquiries.md).
