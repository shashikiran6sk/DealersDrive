# Production configuration baseline

Baseline `d6ae115359c4d0ae7ab0fd5115336291666cbb08` · 2026-10-02 (Asia/Calcutta, UTC+05:30). Local isolated pre-production simulation; no production connection or application fix.

| Guard probe                                                 | Observed                                                                               |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Complete generated inert production fixture                 | Accepted; proves validator fixture is valid, not that production resources are correct |
| MinIO                                                       | **Accepted — FAIL, BUG-006**                                                           |
| Fake/dummy OTP                                              | Rejected — PASS for guard                                                              |
| SMTP/Mailpit adapter                                        | Rejected — PASS for guard                                                              |
| Development auth / local disk / memory cache / console mail | Rejected                                                                               |

No real credentials were printed or used. Config probes imported the unchanged env validator only; they made no provider requests. The production DB, R2/S3 object policies, OAuth redirect domains, MSG91/WhatsApp delivery, Resend sender, deployed docs/metrics/internal endpoints and bundle secret analysis are not certified.

Source-only concern requiring a future isolated reproduction: generic db:seed has no visible production guard, and dev seed’s explicit ALLOW_REMOTE_DEV_SEED override returns before its production guard. This is not registered as a confirmed bug or PASS; PROD-005/DEPLOY-007 remain BLOCKED. Do not invoke either against production to investigate.

Local .env audit found APP_ENV local, development mode, local DB/storage, fake OTP and console mail; runtime jobs/inline worker/docs/metrics were disabled for exploratory isolation. Production can only be checked after an intended environment and authorized credentials are supplied.

Evidence: [config probe outcomes](evidence/security/config-probes.json), [audit environment](evidence/environment.json), TEST-PLAN.md. Terraform was unavailable, and backups were not restored.
