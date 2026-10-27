# Test execution guide

How to reproduce this campaign on a disposable machine. Everything below runs against local,
synthetic data. **Never point any of it at a shared, staging-with-real-users or production
system** — the campaigns suspend dealers, delete stored objects, cut the API off and restore
databases.

## 1. Prerequisites

- Node 24 (the repository pins `>=24`), pnpm 9.15.9, PostgreSQL 16 client and server
  (`psql`, `pg_dump`, `pg_restore`).
- A Chromium build that Playwright 1.56 can drive, and Playwright itself outside the
  repository (it is not a repository dependency):
  `npm i --prefix <dir> playwright@1.56.1` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`. The
  browser path is set in `harness/bkit.mjs` (`launch()`); change it for your machine.
- `pnpm install --frozen-lockfile && pnpm --filter @dealers-drive/api db:generate && pnpm build`
  from the repository root (the web instances serve this production build; c12 imports
  `apps/api/dist/config/env.js`).

## 2. Repository gate (CI-equivalent)

```bash
pnpm --filter @dealers-drive/api db:generate
pnpm format:check && pnpm lint && pnpm docs:check && pnpm typecheck && pnpm test && pnpm build
pnpm audit --audit-level=critical
```

`pnpm test` needs PostgreSQL at `dealersdrive:dealersdrive@localhost:5432` (the integration
suite creates and migrates `dealersdrive_test` itself).

## 3. Certification database

```bash
psql -U dealersdrive -d dealersdrive -c 'CREATE DATABASE dealersdrive_cert'
cd apps/api
export DATABASE_URL=postgresql://dealersdrive:dealersdrive@localhost:5432/dealersdrive_cert
export ADMIN_ALLOWLIST=cert-admin@example.test,cert-admin2@example.test
npx prisma migrate deploy
npx tsx prisma/seed/index.ts
npx tsx prisma/seed/dev-dealers.ts && npx tsx prisma/seed/dev-vehicles.ts && npx tsx prisma/seed/dev-sales.ts
```

## 4. Services

Common API environment (from `apps/api`): `NODE_ENV=development APP_ENV=local`,
`DATABASE_URL` as above, `ADMIN_ALLOWLIST` as above, `STORAGE_DRIVER=local`,
`STORAGE_LOCAL_DIR=<a scratch dir>`, `MAIL_DRIVER=console`, `PHONE_OTP_DRIVER=fake`,
`PHONE_OTP_DEV_CODE=123456`, `MSG91_WIDGET_ID= MSG91_WIDGET_TOKEN=`, `DOCS_ENABLED=true`,
`METRICS_ENABLED=true`, `METRICS_SCRAPE_TOKEN=<32+ chars>`, `GRAFANA_CLOUD_LOGS_ENABLED=false`,
`JOBS_ENABLED=true WORKER_INLINE=true CACHE_DRIVER=postgres`,
`WEB_ORIGIN=WEB_BASE_URL=http://localhost:3000`. Each instance also sets `PORT`,
`API_BASE_URL=http://localhost:<port>` and `MEDIA_BASE_URL=http://localhost:<port>/media`.

| Port | Extra environment                                                                                                                                                                                                        | Used by                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 4000 | `RATE_LIMIT_ENABLED=false`; log stdout to a file (`CERT_API_LOG`)                                                                                                                                                        | everything                       |
| 4001 | `RATE_LIMIT_ENABLED=true JOBS_ENABLED=false WORKER_INLINE=false`                                                                                                                                                         | rate-limit checks                |
| 4002 | `DATABASE_URL=…@localhost:5999/…` (nothing listening) `JOBS_ENABLED=false WORKER_INLINE=false CACHE_DRIVER=memory`                                                                                                       | database-outage checks           |
| 4005 | `STORAGE_DRIVER=minio S3_ENDPOINT=http://127.0.0.1:9909 S3_ACCESS_KEY_ID=k S3_SECRET_ACCESS_KEY=s JOBS_ENABLED=false WORKER_INLINE=false` and `node harness/fake-s3.mjs`                                                 | S3-driver surface (SEC-DISC-001) |
| 4007 | `PHONE_OTP_DRIVER=msg91 MSG91_AUTH_KEY=x MSG91_WIDGET_ID=x MSG91_WIDGET_TOKEN=x PHONE_OTP_TIMEOUT_MS=1500`, started as `npx tsx --import <repo>/docs/qa/production-release/harness/msg91-fault-preload.mjs src/index.ts` | d05                              |

Web (from `apps/web`, after `pnpm build`), each `npx next start --port <p>`:

| Port | Environment                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------ |
| 3000 | `API_BASE_URL=API_ORIGIN=http://localhost:4000 WEB_BASE_URL=http://localhost:3000 APP_ENV=local` |
| 3001 | as 3000 but `WEB_BASE_URL=https://www.dealers-drive.com APP_ENV=production` (indexing policy)    |
| 3002 | `API_BASE_URL=API_ORIGIN=http://localhost:4999` (unreachable)                                    |
| 3003 | `API_BASE_URL=API_ORIGIN=http://localhost:4010` — the cuttable proxy u04 runs                    |

## 5. Run

```bash
cp docs/qa/production-release/run-env.example.sh /tmp/run-env.sh   # edit paths
source /tmp/run-env.sh
export CERT_STORAGE=<STORAGE_LOCAL_DIR> CERT_WEB_PROXIED=http://localhost:3003 \
       CERT_WEB_PROD=http://localhost:3001 CERT_WEB_DOWN=http://localhost:3002
bash docs/qa/production-release/harness/run-all.sh      # ≈ 25 min on 4 vCPU
node docs/qa/production-release/harness/p01-performance.mjs
```

`run-all.sh` prints one line per script and ends with `finalize.mjs`, which writes
`registry/results.final.json`, `TEST-TRACEABILITY.csv`, `EVIDENCE/final-counts.json` and exits
non-zero unless all 556 canonical scenarios carry PASS, FAIL, BLOCKED or NOT_APPLICABLE.
`node registry/registry.mjs validate` re-checks the 556-scenario source on its own.

Each script records to `registry/results/<area>.json` (one verdict per scenario) and
`EVIDENCE/<area>/api-log.json` (sanitised: tokens, cookies, signatures and signed URLs are
redacted, phone numbers masked). Screenshots go to `EVIDENCE/screenshots/`. Reviewed
reclassifications live in `registry/triage.json`; the harness verdict is preserved beside them.

## 6. Provenance markers

`FAKE-OTP` — the real sign-in route with the fake OTP driver · `SIM-GOOGLE` — an
`oauth_identities` row inserted (Google unreachable) · `SIM-SESSION` — an ADMIN session row
inserted (admin sign-in is Google or a real handset) · `SIM-ADMIT` — an invited Admin Member
activated by UPDATE (first sign-in needs Google). Everything else goes through the API or the
browser.

## 7. Clean-up

Drop `dealersdrive_cert`, delete the storage directory and the `.run-logs/` directory (ignored by
git). The harness leaves nothing outside them; d04 drops its own restore database.

## 8. CI reproduction

Only the repository gate (§2) runs in CI today. The harness is not wired into CI: it needs the
nine processes above and a browser. A CI job would provision them as services, run
`run-all.sh`, upload `EVIDENCE/` and fail on `finalize.mjs`'s exit code.
