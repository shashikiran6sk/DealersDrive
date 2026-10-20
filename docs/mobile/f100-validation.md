# F100 native authentication backend — local validation complete

Base: F099 branch feat/f099-mobile-foundation at ba2f30c5633833dbece9a9c099a34004bb2e1a8d (draft PR #312). All reported F099 checks passed at that exact SHA. Legal foundation remains PR #279 / 6180a4b; main remains a969dc2. No branch history is rewritten and no PR is merged.

Scope: server-mediated native customer OTP request/resend/verify, existing customer signup/session introspection/logout JSON transport, customer-only bearer allowlist, authoritative current-policy adapter, lean schema exports, OpenAPI and compatibility/security tests. No database schema/migration, policy text/version/publication, website auth/UI or provider setting changes. The new native capability defaults off; production OTP/signup additionally requires approved publication.

Executed checks:

| Check                    | Result       | Evidence                                                                                                              |
| ------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Root lint/docs/typecheck | PASS         | Seven workspace tasks; no boundary/format/type failures                                                               |
| Root builds              | PASS         | API, contracts, web, Android Hermes export                                                                            |
| API full tests/coverage  | PASS         | 179 files, 3,498 tests; statements 95.70%, branches 90.26%, functions 97.93%, lines 96.95%                            |
| Contracts                | PASS         | 26 files / 581 tests, coverage gates pass                                                                             |
| Web regression           | PASS         | 144 files / 1,727 tests                                                                                               |
| Mobile foundation        | PASS         | Four suites / 26 tests plus exact asset checks                                                                        |
| New targeted tests       | PASS         | OTP controls/provider adapter, synthetic legal-publication evidence, native identity/authorization and OpenAPI parity |
| Database compatibility   | PASS locally | Existing 60 migrations deploy in the disposable integration database; no new/changed migration                        |
| Remote CI/security       | PENDING PR   | Local results are not GitHub checks                                                                                   |
| Live MSG91/DLT/captcha   | NOT VERIFIED | No real send or provider configuration change                                                                         |

The first full API run passed all 3,483 tests but branch coverage was 89.96%, below the unchanged 90% gate. Added meaningful policy publication tests cover missing, stale, draft, mismatched, future and unapproved evidence; the full rerun passes. The final adapter adjustment uses the vendor SDK's numeric SMS resend channel 11 and replaced provider request ID; subsequent targeted tests, API lint and types pass. The published SDK was read outside the repo and is not an app dependency.

Native integration includes web-to-native and native-to-web same-User identity, no Set-Cookie from native issuance, CUSTOMER-only scope, denied dealer/admin scopes, denied workspaces/invitations/privileged consoles, expired/revoked credentials, invalid-bearer refusal despite a valid cookie, challenge replay/tamper/strict inputs, foreign support ticket refusal and production draft withholding. Existing cookie regressions remain passing.

Provider/DLT/captcha compatibility is not live-verified. No SMS/API provider mutations were performed. Tests use explicitly synthetic OTP, policy and provider fixtures. See [native auth design](../code/api/modules/auth/native-auth.md) for limits, lost-response behavior, rollout gate and exact authorization boundary. No emulator screenshot is relevant to this server-only milestone.

Rollback: keep the unmerged child out of production; if later approved to deploy, leave NATIVE_CUSTOMER_AUTH_ENABLED=false to disable the new transport while preserving browser auth. No new migration needs reversing. Revert child commits through normal history if required; no force-push/protected-parent rewrite.
