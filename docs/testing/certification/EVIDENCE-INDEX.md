# Evidence index — original auditor's certification dossier

All evidence is sanitized: session cookies, OTP tokens, upload signatures and signed URLs
are scrubbed by the harness (`compact`/`scrub` in `harness/lib.mjs`); the owner's address
is redacted to `<owner-admin-email>`; Admin browser evidence uses the inert operator
`cert-admin@example.test`; all customers, dealers, phones and documents are generated
fixtures (the KYC PDF reads "NOT A REAL DOCUMENT").

| Path                                         | What it is                                                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `FINAL-CERTIFICATION.md`                     | Decision (NO GO), totals, launch blockers, external gates, fix order                                                 |
| `BUG-REPORT.md`                              | Original checklist, Agent 2 findings re-verified, new findings                                                       |
| `RETEST-REPORT.md`                           | Merge ledger, per-layer retests, harness corrections, totals and transitions                                         |
| `HUMAN-UAT.md`                               | Everything an agent could not certify, with sign-off table                                                           |
| `README.md`, `TEST-PLAN.md`                  | Baseline audit plan and environment (baseline d6ae115)                                                               |
| `CANONICAL-TEST-REGISTRY.md`, `registry/`    | The 556 scenarios, validator and completeness check                                                                  |
| `registry/results.json`, `registry/results/` | **Baseline** results (d6ae115) — kept unmodified                                                                     |
| `retest/final/*.json`                        | **Final** results on main f74401a (12 API campaigns + 3 browser campaigns + findings)                                |
| `retest/final/results.final.json`            | Final accounting: every record carries its `baseline` status                                                         |
| `retest/final/screenshots/`                  | Browser campaign screenshots (desktop/tablet/mobile, 404, outage, golden journeys)                                   |
| `retest/final/evidence/<area>/api-log.json`  | Sanitized request/response/DB evidence per campaign                                                                  |
| `retest/pr232` … `retest/pr238`              | Per-PR independent retests (red on parent where applicable, then green)                                              |
| `harness/`                                   | Reproducible harness: `c01`–`c12` API campaigns, `b01`–`b03` browser campaigns, `retest-*` probes, `final-merge.mjs` |
| `../fixes/`                                  | Agent 2's per-fix evidence, archived verbatim from each PR before removal                                            |
| `../fixes/STACK-REVIEW-CHECKPOINT.json`      | Machine-readable, restartable state of the stack review                                                              |
| `../pre-production/`                         | Agent 2's original 556-case dossier (archived verbatim)                                                              |

Re-running: Postgres with `dealersdrive_cert`, API on 4000 (rate limit off), 4001 (rate
limit on), 4002 (DB unreachable); web on 3000 (local), 3001 (`APP_ENV=production`,
public origin), 3002 (API unreachable). Set `CERT_STORAGE`, `CERT_RESULTS_DIR` and
`CERT_ADMIN_EMAIL` (an allowlisted Admin), then `node harness/<campaign>.mjs`,
`node harness/final-merge.mjs` and
`CERT_RESULTS_JSON=retest/final/results.final.json node registry/registry.mjs completeness`.
