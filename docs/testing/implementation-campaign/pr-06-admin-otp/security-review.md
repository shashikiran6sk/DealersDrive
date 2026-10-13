# Admin OTP security review — executed evidence

Final head: `38f1ccc38d89b539afe9f6c8af19217f1a3bbc82`. Every PASS below refers to executed
local API/unit/browser tests with synthetic data and controlled external providers. It is not
certification of live Google accounts, real SMS delivery or production MSG91 configuration.
The full local and GitHub suites each passed 5,167 cases. Dedicated post-creation browser evidence
records 22 checks; final targeted admin/session/migration rehearsal records 50 cases.

| Required case                        | Result | Executed boundary                                                                                          |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------- |
| 1. Existing Google admin sign-in     | PASS   | Real OAuth cookie integration and browser controlled callback                                              |
| 2. Initial verified phone enrollment | PASS   | Recent-Google admission, session binding and actual UI enrollment                                          |
| 3. Correct OTP/proof                 | PASS   | Real API credential/session persistence with controlled provider                                           |
| 4. Incorrect OTP/proof               | PASS   | Provider rejection, persisted attempt quota; fake adapter rejects wrong codes                              |
| 5. Expired OTP/proof                 | PASS   | Expired provider exp, stale iat and expired DB challenge refused                                           |
| 6. Reused OTP/proof                  | PASS   | Concurrent callback and durable redemption after cache clearing                                            |
| 7. Invalid purpose                   | PASS   | ENROLL challenge refused at LOGIN endpoint before provider call                                            |
| 8. Resend cooldown                   | PASS   | Persistent cross-browser cooldown; browser waits actual 60 seconds                                         |
| 9. Rate limits                       | PASS   | Phone window, IP quota and fail-closed limiter outage                                                      |
| 10. Unregistered number              | PASS   | Generic challenge, generic refusal; no admin session                                                       |
| 11. Customer-only number             | PASS   | Real API refusal despite verified person phone                                                             |
| 12. Dealer-only number               | PASS   | Real API refusal; no credential-created administrator                                                      |
| 13. Shared customer/admin number     | PASS   | Separate User identities and credentials; actual browser parallel sessions                                 |
| 14. Suspended administrator          | PASS   | Suspended User and ADMIN seat rejected; Google cannot reactivate seat                                      |
| 15. Disabled administrator           | PASS   | Member disabled after challenge; proof refused                                                             |
| 16. Removed administrator            | PASS   | Member deleted after challenge; proof refused                                                              |
| 17. Duplicate admin phone            | PASS   | Database unique constraint rejects another owner; no identity reassignment                                 |
| 18. Phone replacement                | PASS   | Direct overwrite refused; Google revoke and new enrollment required                                        |
| 19. Lost-phone recovery              | PASS   | Actual Google step-up, global admin revocation and new-number verification                                 |
| 20. Forged admin cookie              | PASS   | Actual protected API returns 401                                                                           |
| 21. Session fixation                 | PASS   | Actual OTP rotation invalidates the previous admin token                                                   |
| 22. CSRF                             | PASS   | Missing/foreign Origin, cross-site Fetch Metadata and form encoding refused; browser nonce/session binding |
| 23. Session replay                   | PASS   | Actual revoked-token requests return 401                                                                   |
| 24. Concurrent redemption            | PASS   | Two simultaneous requests produce exactly one successful session/redemption                                |
| 25. Parallel customer/admin sessions | PASS   | Actual browser same-number flows maintain isolated cookies                                                 |
| 26. Admin logout                     | PASS   | Actual browser and real-cookie integration preserve person session                                         |
| 27. Customer logout                  | PASS   | Actual browser HTTP logout preserves admin session                                                         |
| 28. Dealer logout                    | PASS   | Actual dealer Google session/logout preserves admin session                                                |
| 29. Browser refresh                  | PASS   | Actual OTP session survives refresh and security assurance remains correct                                 |
| 30. Multiple tabs                    | PASS   | Actual second tab sees the session and Google-step-up requirement                                          |
| 31. Dealer OTP regression            | PASS   | Full API and web phone suites execute in final local and GitHub gates                                      |
| 32. Google OAuth regression          | PASS   | Full OAuth/account-linking/parallel-state suites and actual controlled browser round trip                  |
| 33. OTP provider outage              | PASS   | Real API with UNAVAILABLE adapter returns 503; provider HTTP 429/5xx and timeout handled securely          |
| 34. Unauthorized admin APIs          | PASS   | Forged/absent cookies, invalid members, suspended role and wrong-purpose requests denied                   |
| 35. Account enumeration              | PASS   | Unknown/customer/dealer-only number challenge shape is generic; no raw identity in refusals                |

Additional checks cover wrong-scope logout cookies, durable replay protection after cache loss,
concurrent member disabling versus login, unknown legacy assurance, stale or mobile-only
credential changes, wrong browser/session binding, missing/future freshness, strict schemas,
private audit payloads, malformed DB data and historical migration preservation/rollback.

Database and provider behaviors are exercised separately. Real PostgreSQL persists and locks
application data; external-provider behavior is controlled through existing provider ports and
HTTP adapters. No admin is created by OTP, no person identity is merged, no verified credential
is overwritten and no frontend-only guard supplies authorization.

The security review found and repaired Google seat reactivation during step-up and the login
versus member-disable race. Local and GitHub Semgrep report 40 nonblocking findings, zero
blocking findings; gitleaks reports zero committed leaks. Existing dependency advisories remain.
No controls or coverage gates were disabled. The required CI checks passed at this final SHA.

Live MSG91 `iat`/`exp` compatibility, provider dashboard resend/attempt controls, CAPTCHA and
physical-device/native Safari UAT remain rollout prerequisites. Missing or stale proof claims
fail closed. The widget can contact the provider directly, so application challenge quota is
not represented as exclusive provider delivery control. Retention and recycled-number recovery
need reviewed operations. No production GO or production deployment is claimed.

See README.md for run links, command logs, migration evidence, screenshots and owner UAT.
DO NOT MERGE.
