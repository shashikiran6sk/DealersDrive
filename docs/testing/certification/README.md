# Pre-production certification — Dealers-Drive

This folder is the evidence trail for the launch certification of **one exact commit**. Nothing
here certifies any other SHA.

| Field                  | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| Release candidate SHA  | `d6ae115359c4d0ae7ab0fd5115336291666cbb08` (`origin/main`, R96, #230)   |
| Baseline audit started | 2026-10-02 00:37 UTC                                                    |
| Environment            | Isolated cloud container — local PostgreSQL 16.14, no shared/prod data  |
| Runtime                | Node 24.21.0 (repo pins 24; container default 22 not used), pnpm 9.15.9 |
| Browser runtime        | Playwright Chromium 1194 (pre-installed). WebKit / Firefox: not present |
| Storage / mail / OTP   | `STORAGE_DRIVER=local`, `MAIL_DRIVER=console`, `PHONE_OTP_DRIVER=fake`  |
| Phase                  | **Baseline audit** — no application behaviour has been modified         |

## Layout

| File                               | Purpose                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `CANONICAL-TEST-REGISTRY.md`       | The 556 mandatory scenarios with IDs (generated)        |
| `registry/canonical-scenarios.txt` | Verbatim source of the 556 scenarios                    |
| `registry/registry.mjs`            | `validate` (Part D) and `completeness` (Part X)         |
| `registry/results.json`            | One status per canonical ID — filled during execution   |
| `TEST-PLAN.md`                     | Repository audit, state machines, risks, execution plan |
| `BUG-REPORT.md`                    | `BUG-###` records (baseline: documented, never fixed)   |
| _remaining Part B files_           | Produced as each campaign phase executes                |

```bash
node docs/testing/pre-production/registry/registry.mjs validate
node docs/testing/pre-production/registry/registry.mjs completeness
```

Evidence never contains OTPs, session tokens, cookies, secrets, private documents or real PII.
All test identities are synthetic (`+91 9xxxx` numbers reserved for the test database).
