# BUG-006 — refuse MinIO at production boot

Canonical PROD-002 retains its original baseline FAIL. At exact healthy parent `e80d124ff0d7cfdb7bc39a97757484eb7d6b931a` (#236), four unit regressions and the isolated real-validator probe reproduce production acceptance of MinIO before source edits. The separate original CONFIG-002 case again accepts MinIO; other production guards remain effective. [Reproduction/root trace](REPRODUCTION.md), original red logs and [baseline process probes](evidence/configuration-baseline.json) retain the failures.

Branch `fix/pre-production-06-production-storage` must target `fix/pre-production-05-membership-commit-guard` (#236). Product/test commit `1ab00270c3490977ca1d7a1b339d38896cd22851`. PR #237; actual final-head CI PENDING. No merges.

The production check previously refused only `local`, while its message promised R2. It now requires `r2`, rejecting both development adapters through the existing fatal configuration path. NODE_ENV remains the runtime production boundary, independent of APP_ENV labels. API and worker both validate before container/provider startup. ECS already selects R2; local/test enum choices, credential checks, storage factory, shared S3 adapter, infrastructure, schema and persistent state are unchanged. Config and storage code facades describe the policy.

## Verification

- Ten new env unit regressions: MinIO denied under production for all four APP_ENV labels, plus supported local/MinIO/R2 choices under development and test. Full env file61 PASS; affected configuration/container/storage/mail/phone suites177 PASS across10 files.
- Real process probes26 PASS with fresh generated inert credentials, isolated dotenv context and no provider/database operations: exact CONFIG-002/PROD-002 refusal; valid R2; four production labels; six supported development/test combinations; missing R2 keys, omitted/default and unknown drivers; existing fake OTP/SMTP/dev-auth/memory-cache/console-mail/local guards; actual API and worker entrypoints reject both MinIO and local storage before startup.
- Adjacent real API upload/onboarding/order integration143 PASS across three files. API typecheck PASS. Early green metadata records parent HEAD with uncommitted implementation; committed probe/full suite identify1ab0027.
- Full accumulated suite4516 PASS: API2750/132 files, web1346/99, contracts420/14. API coverage97.02/92.29/98.37/97.82; thresholds PASS. Root lint/typecheck/fresh build PASS (fresh build32.768s). First formatting failure retained and corrected before green lint. Committed-history scan PASS237 commits at045ca8d. Actual CI PENDING.

Browser screenshots are not applicable to an environment-import boot gate. Deterministic actual-process and entrypoint evidence covers its behavior. No existing database row is changed by validation; API upload/DB regressions verify the unaffected local runtime. Live R2/MSG91/Resend, deployment credentials, provider and human UAT are not certified by inert fixtures and remain PENDING. Production GO is not established.

Two early probe attempts failed before importing the validator because the tsx CLI tried to open an IPC socket forbidden by the execution sandbox. They are retained as harness failures, not product reproductions. The corrected probe uses Node’s tsx import loader directly, completes with network access disabled, and observes original MinIO acceptance before the fix. Its original22-case baseline has17 PASS/five MinIO FAILs; the expanded fixed26-case run includes four actual entrypoint checks. No credential values are logged or committed.

## Session scope and prior layer

The user directs BUG-006 followed by BUG-008 for this session, then a complete handoff. BUG-NEW-012 P1 queued-enquiry revocation and the other additional findings remain OPEN and are deferred to separate PRs in a later session. No enquiry implementation change is included. BUG-005 #236 final e80d124 actual CI372/Security521 PASS (all five jobs), remote4506 tests and fresh build; its final proof is carried into this layer’s reports without rewriting baseline results. Human UAT PENDING; no PR merged.
