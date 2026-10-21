# Production release certification — Dealers-Drive `6e39a9a`

Pre-launch certification of **one exact commit**: `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`
(`main`, #330). Nothing here certifies any other commit. Testing ran in an isolated cloud
container against local, synthetic data; no production system, credential, provider or customer
was touched, and no application source was changed.

**Start with [RELEASE-READINESS-REPORT.md](RELEASE-READINESS-REPORT.md)** — the verdict, the
counts and what stands between this commit and launch.

## Reports

| Report                                                                                                                                                            | What it is                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [RELEASE-READINESS-REPORT.md](RELEASE-READINESS-REPORT.md)                                                                                                        | Executive report and the GO / NO-GO verdict                                                              |
| [FINAL-CERTIFICATION.md](FINAL-CERTIFICATION.md)                                                                                                                  | The certification summary in the 556-scenario brief's format                                             |
| [DEFECT-REGISTER.md](DEFECT-REGISTER.md)                                                                                                                          | BUG-101 … BUG-111 with reproduction and evidence ([BUG-REPORT.md](BUG-REPORT.md) points here)            |
| [MANUAL-UAT-CHECKLIST.md](MANUAL-UAT-CHECKLIST.md)                                                                                                                | The product owner's human tests and the operator checks ([HUMAN-UAT.md](HUMAN-UAT.md) points here)       |
| [TEST-PLAN.md](TEST-PLAN.md)                                                                                                                                      | Repository audit, state machines, undefined rules, the plan, and how the inherited harness was re-judged |
| [ACCEPTANCE-BASELINE-PR304.md](ACCEPTANCE-BASELINE-PR304.md)                                                                                                      | The scenario inventory: 556 canonical + discovered, and why there is no "676"                            |
| [CANONICAL-TEST-REGISTRY.md](CANONICAL-TEST-REGISTRY.md)                                                                                                          | The 556 canonical scenarios with their IDs (generated, validated)                                        |
| [TEST-RESULTS.md](TEST-RESULTS.md)                                                                                                                                | Every verdict, section by section                                                                        |
| [TEST-TRACEABILITY.csv](TEST-TRACEABILITY.csv)                                                                                                                    | Scenario → requirement → test file → result → evidence → defect                                          |
| [TEST-COVERAGE-MATRIX.md](TEST-COVERAGE-MATRIX.md)                                                                                                                | Layers exercised per section                                                                             |
| [AUTOMATED-TEST-REPORT.md](AUTOMATED-TEST-REPORT.md)                                                                                                              | The repository gate (5,754 tests) and the acceptance campaign runs                                       |
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) · [API-SECURITY.md](API-SECURITY.md) · [TENANT-ISOLATION.md](TENANT-ISOLATION.md)                                          | Security narrative and scenario records                                                                  |
| [RBAC-MATRIX.md](RBAC-MATRIX.md) · [IDENTITY-MATRIX.md](IDENTITY-MATRIX.md) · [LIFECYCLE-MATRIX.md](LIFECYCLE-MATRIX.md)                                          | Roles, identity, lifecycles                                                                              |
| [DATA-INTEGRITY.md](DATA-INTEGRITY.md) · [CONCURRENCY.md](CONCURRENCY.md) · [FAILURE-RECOVERY.md](FAILURE-RECOVERY.md)                                            | Integrity, races, faults                                                                                 |
| [BROWSER-COMPATIBILITY.md](BROWSER-COMPATIBILITY.md) · [RESPONSIVE-QA.md](RESPONSIVE-QA.md) · [ACCESSIBILITY-QA.md](ACCESSIBILITY-QA.md) · [SEO-QA.md](SEO-QA.md) | Front-end quality                                                                                        |
| [PRODUCTION-CONFIG-QA.md](PRODUCTION-CONFIG-QA.md)                                                                                                                | Production configuration guards and observability                                                        |
| [PERFORMANCE-REPORT.md](PERFORMANCE-REPORT.md)                                                                                                                    | Measured latency and capacity findings ([PERFORMANCE-SMOKE.md](PERFORMANCE-SMOKE.md) points here)        |
| [AGENT-UAT.md](AGENT-UAT.md)                                                                                                                                      | The human-style browser walk-through and what the screenshots show                                       |
| [RETEST-REPORT.md](RETEST-REPORT.md)                                                                                                                              | Earlier findings re-tested; every check changed during this campaign and why                             |
| [TEST-EXECUTION-GUIDE.md](TEST-EXECUTION-GUIDE.md)                                                                                                                | How to reproduce all of it                                                                               |

## Machine-readable records

| Path                                                        | Content                                                                             |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `registry/canonical-scenarios.txt`, `registry/registry.mjs` | the verbatim 556 scenarios; `validate` (count, duplicates, gaps) and `completeness` |
| `registry/results/<area>.json`                              | each harness script's verdicts                                                      |
| `registry/triage.json`                                      | reviewed reclassifications and bug links, each with its reason                      |
| `registry/results.final.json`                               | merged verdicts after triage (harness verdict kept as `harnessStatus`)              |
| `EVIDENCE/final-counts.json`                                | the counts every report quotes                                                      |
| `EVIDENCE/<area>/api-log.json`                              | sanitised request/response/DB evidence per area                                     |
| `EVIDENCE/screenshots/`                                     | browser evidence (synthetic accounts and data only)                                 |
| `EVIDENCE/ci/`                                              | the repository gate's logs                                                          |
| `harness/`                                                  | the campaign: `run-all.sh`, `finalize.mjs`, `write-reports.mjs` and every probe     |

Evidence never contains OTPs, session tokens, cookies, signed URLs, passwords, secrets or real
personal data. Phone numbers are harness-generated: masked to their last four digits in every
text record; screenshots show them as the app renders them (synthetic `+91 9…` fixtures that
received nothing — the OTP driver was fake).
