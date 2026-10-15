# F107 account controls and deletion requests — validation

Immediate parent: F106 `feat/f106-mobile-support`, draft [PR #319](https://github.com/shashikiran6sk/DealersDrive/pull/319), head `18245c5c77032d85babd69feb15371abc35ea998`. GitHub CI/security checks pass. Foundation PR #279 remains open/draft at `6180a4b52522493b884550448d0a84e7d95432df`; main remains `a969dc2c5223ddb04c23d720ded6a4daccfe33ab`. All ten immediate-parent bases are preserved.

## Approved scope and behavior

The owner approved the [two-control amendment](account-controls-amendment.md). Android Profile and the web account menu expose separate temporary deactivation and deletion-request controls. Deactivation requires an unticked affirmative choice and a CUSTOMER session established through OTP within ten minutes, measured from the actual proof time. Existing sessions with no authentication timestamp must reauthenticate. Deactivation locks the User, withdraws effective sharing through the existing immutable legal services (including legacy enquiries), records customer-only state, revokes CUSTOMER sessions and audits in one transaction. Saved cars, history and dealer/admin access are retained.

A fresh OTP for a deactivated identity produces a short-lived purpose-bound, one-use reactivation proof, without creating a session. An explicit confirmation reactivates the same User and creates a customer session; administrative suspension remains authoritative. Withdrawn permissions are never restored. Web proof remains in an HttpOnly cookie; Android keeps it in transient sign-in state. Cross-account confirmation, stale phone proofs and account merges cannot reopen withdrawn sharing. Customer mutations lock/recheck current access so a request authorized before deactivation cannot write afterward.

Deletion uses existing authenticated ACCOUNT_ISSUE support tickets, stable request UUIDs and a server-derived customer identity. The public `/account-deletion` page also provides configured contact instructions for people without an active account or app. Receipts describe request intake, never completed erasure. See the [unapproved fulfilment runbook](deletion-fulfilment-runbook.md): actual erasure/retention remains a release blocker.

## Executed evidence

- API: 181 files / 3,515 tests PASS; coverage statements 95.72%, branches 90.28%, functions 97.95%, lines 96.94%; all existing coverage gates pass.
- Contracts: 29 files / 599 tests PASS; statements 98.55%, branches 92.02%, functions 96.79%, lines 98.89%.
- Website: 146 files / 1,737 tests PASS, including action-bound owner checks, proof-cookie isolation and UI confirmation/reset states.
- Native: 20 suites / 92 tests PASS, including deactivation recency/refusal, deletion retry identity and explicit reactivation.
- Root lint, types and build PASS. Android Hermes JavaScript/assets export PASS; this is not a native APK/AAB build. Sandbox typecheck/static build PASS with mock actions and registered web controls.
- OpenAPI mount/operation and facade-boundary tests PASS within the full API run. Multi-role tests exercise existing dealer `/v1/auth/me`, workspace/invitation and admin access while customer access is disabled.

Local logs: `/private/tmp/f107-api-final.log`, `f107-contracts-final.log`, `f107-web-final.log`, `f107-mobile-final.log`, `f107-root-{lint,types,build}.log`, `f107-sandbox-build.log`. Logs are temporary local evidence, not durable CI artifacts; GitHub results are separately recorded in the next stack checkpoint.

## Compatibility, migration and rollback

Additive `20261015110000_customer_deactivation` adds nullable `users.customerDeactivatedAt` and `sessions.authenticatedAt`; it depends on the preceding stack migrations, including F106 support retry fields. Normal active-user login responses remain compatible; deactivated users receive the new explicit reactivation state, requiring the coordinated web/API rollout. No new policy/consent tables, policy publication, global role suspension, provider change or database erasure is introduced.

Apply migrations only after separate deployment authorization. Rollback must retain enforcement of recorded customer deactivation and legal withdrawals: an older backend that ignores the new state is unsafe. Keep the security-compatible backend while rolling back UI or disable customer entry points until a reviewed fix. Do not restore revoked sessions, reverse withdrawal events or drop evidence/columns.

## Evidence limitations and launch blockers

No real SMS/Google/provider delivery, production notification, physical Android validation, installed-native screenshot, performance benchmark or completed deletion is claimed. Browser visual review of local Storybook was attempted, but automatic approval review rejected selecting Chrome because its profile picker could reveal unrelated private account identifiers. No workaround was used; static build and component tests do not replace visual review. Account controls, responsive sizes, screen-reader behavior and Swagger UI visual inspection remain pending. Existing dependency advisories, approved legal publication, deletion fulfilment/retention, signing/package identity and store access remain release gates. No merge, production migration/deployment, legal activation or Play upload occurred.
