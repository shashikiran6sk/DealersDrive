# Performance report

Audited commit `6e39a9a6af7a6aaa2806e9eaab9481634fb496d2`. Measured 2026-10-21 05:10 UTC with
`harness/p01-performance.mjs`; raw numbers in `EVIDENCE/performance/latency.json`.

## What was measured, and what this is not

- **Machine:** one 4-vCPU container (Intel Xeon @ 2.10 GHz, 16 GiB), shared by PostgreSQL 16,
  one API process (run with `tsx` in development mode — slower than the compiled
  `node dist/index.js` production runs), one `next start` process, and the browser.
- **Data:** the certification database at the time — about 500 dealerships and 800 listings.
- **Workload:** for each endpoint or page, one warm-up request, then 60 requests sequentially
  (one client) and 60 at 10 concurrent clients. Latency is client-observed wall time.
- **Not** a production capacity measurement: no network distance, no Vercel/ECS/RDS, no CDN, no
  realistic data volume, no sustained load. It cannot be extrapolated to production capacity; it
  finds regressions and gross bottlenecks.

## Budget

The repository defines its latency alerts in `docs/observability.md`: **p95 above 1 s or p99 above
2 s** on API request duration, and more than five slow DB operations (≥ 500 ms) in five minutes.
Those are used as the budget.

## Results (ms)

| Target                                   | p50 (1 client) | p95 | p99 | p50 (10 clients) | p95 | p99 | Throughput at 10 |
| ---------------------------------------- | -------------: | --: | --: | ---------------: | --: | --: | ---------------: |
| API `GET /v1/vehicles?limit=24`          |             18 |  25 |  37 |              134 | 176 | 199 |           74 rps |
| API `GET /v1/vehicles` filtered + sorted |             16 |  20 |  23 |              121 | 138 | 144 |           82 rps |
| API `GET /v1/vehicles/:slug`             |              3 |   4 |   4 |               12 |  19 |  21 |          787 rps |
| API `GET /v1/dealers?limit=24`           |             14 |  21 |  23 |              113 | 120 | 156 |           88 rps |
| API `GET /v1/dealers/:slug`              |              8 |  11 |  13 |               40 |  56 |  58 |          226 rps |
| API `GET /v1/enquiries` (signed in)      |              4 |   5 |   5 |               18 |  24 |  26 |          529 rps |
| Web `/`                                  |              6 |   8 |  11 |               41 |  58 |  62 |          241 rps |
| Web `/cars`                              |             24 |  31 |  39 |              196 | 219 | 221 |           51 rps |
| Web `/cars?q=Creta`                      |             24 |  33 |  36 |              212 | 363 | 469 |           44 rps |
| Web `/car/:slug`                         |             16 |  21 |  26 |              133 | 200 | 225 |           75 rps |
| Web `/dealers/:slug`                     |             13 |  17 |  21 |              102 | 149 | 185 |           98 rps |

Every request returned 200. **All cells are far inside the budget** (worst p95 363 ms, worst p99
469 ms, at ten concurrent clients on one shared 4-vCPU box).

## Findings

| ID                      | Finding                                                                                                                                                                                                                                                           | Severity    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| PERF-DISC-001 / BUG-104 | The `notification.email` queue drains at exactly **30 e-mails per minute per worker** (pg-boss `batchSize` 1, 2 s polling); median queue wait 1,054 s and p95 1,281 s while the campaign generated bursts. Admin e-mails fan out to every permitted Admin Member. | P3          |
| —                       | The list endpoints (`/v1/vehicles`, `/v1/dealers`) saturate first (~75–90 rps here, latency rising linearly with concurrency) — the place to look first under load.                                                                                               | Observation |
| BUG-111                 | Out-of-band suspension: dealer page cached up to ≈ 10 min (revalidate 600). A correctness-vs-cache trade-off, not a speed defect.                                                                                                                                 | P3          |
| —                       | Slow-operation warnings (≥ 500 ms) appeared only around process start and during the campaign's bulk writes (outbox `updateMany` while thousands of jobs were queued); none during the measurement.                                                               | Observation |

## UX timing regressions from the brief (section M)

| Concern                                        | Evidence                                                                                                                                                                                                                                         | Result                                      |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Slow initial load / delayed navigation         | Sequential page p95 ≤ 33 ms locally; `loading.tsx` skeletons on the console and public detail pages (R101)                                                                                                                                       | No regression found locally                 |
| Login button flash before session hydration    | R103 `dd_auth` hint; Agent UAT screenshots taken after sign-in show the avatar, never Login. First-paint timing was **not** measured frame by frame                                                                                              | Not observed; not measured                  |
| Stuck navigation after a click / long mutation | R102 navigation-safe actions; u04 shows a save against an unreachable API returning an error banner and the next click working                                                                                                                   | Not reproduced                              |
| Dealer console and admin page loads            | Agent UAT full loads to `networkidle` (which itself waits 500 ms of quiet) on an emulated phone: dealer console pages 797–1,084 ms, admin pages 766–930 ms (`EVIDENCE/agent-uat/steps.json`); client-side tab switches were not timed separately | No outlier; tab-switch latency not measured |
| Duplicate API calls / double submit            | UX-009, RECOVERY-011, UAT double-tap: one row each                                                                                                                                                                                               | None                                        |

Production-path timing (Vercel bom1 ↔ ECS ap-south-1 ↔ RDS) could not be measured here and is
in the manual checklist.
