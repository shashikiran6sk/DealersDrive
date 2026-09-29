# Dealers-Drive

A B2B2C used-car marketplace for Tamil Nadu. Independent dealers list their
inventory; buyers browse publicly without an account.

> ### ⚠️ Read this before contributing
>
> This repository is a **structured reconstruction of a product that is already
> built**. The working implementation — ~38,000 lines, 97.74 % API test
> coverage — lives at the tag `baseline/pre-reorg-2026-09-02`, mirrored on the
> `legacy/pre-reorg` branch.
>
> Features are not being designed here. They are being **re-delivered from that
> baseline in 97 reviewable slices**, one pull request each, so the history
> becomes something a person can read.
>
> **[`CLAUDE.md`](CLAUDE.md) is the operating manual. Start there.**

## Where things are

|                                                                          |                                                               |
| ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                                                 | How to work on this repository. Required reading.             |
| [`CONTEXT.md`](CONTEXT.md)                                               | Current state of the reconstruction, and why it is happening  |
| [`docs/project/feature-map.md`](docs/project/feature-map.md)             | The 97 features, in order, with their exact files             |
| [`docs/project/component-map.md`](docs/project/component-map.md)         | All 65 UI components                                          |
| [`docs/project/component-sandbox.md`](docs/project/component-sandbox.md) | The component sandbox                                         |
| [`docs/project/git-strategy.md`](docs/project/git-strategy.md)           | Branching, risk register, verification gate                   |
| [`docs/observability.md`](docs/observability.md)                         | Grafana Cloud metrics, logs, dashboards and production alerts |

## Stack

Turborepo + pnpm · Next.js 15 (App Router, RSC) · Express 5 · PostgreSQL 16 +
Prisma 6 · Zod 4 · Tailwind v4 · Node 24 · TypeScript 5.9

## Environment setup

`APP_ENV` selects one of `local`, `development`, or `production`. Node and
Next.js retain their standard `NODE_ENV` values: development for local and
development, production for production. Provider choices are validated once at
startup. The API and web use the same environment name; no private value uses
`NEXT_PUBLIC_*`.

### Local

```bash
pnpm install
cp .env.example.local .env
pnpm infra:up
pnpm dev
```

No AWS, Google, MSG91, Resend, or external database credentials are needed.
`infra:up` starts PostgreSQL on `localhost:5432`, MinIO on `localhost:9000`
([console](http://localhost:9001), login `dealersdrive` / `dealersdrive`),
Mailpit on `localhost:1025` ([inbox](http://localhost:8025)), and the pg-boss
worker. It applies pending Prisma migrations and idempotently creates the local
dealer/admin accounts. The API and web run separately with `pnpm dev`. Dealer
login can use the seeded owner's number `+919840012345`; a new number enters
normal dealer onboarding. Phone sign-in and verification use code `123456`
through the existing fake OTP adapter. Mail goes to Mailpit, and
uploads use the same S3 storage adapter against MinIO. The bucket is created
by the API at startup. The local worker processes PostgreSQL jobs and the
notification outbox. To add a larger sample inventory, run `pnpm db:seed:dev`.
This optional seed is idempotent. `pnpm infra:down` stops containers without
removing their volumes; `pnpm infra:reset` removes volumes and data.

### Development

```bash
cp .env.example.development .env
# Fill in AWS_REGION, S3_BUCKET, Google OAuth, and MSG91 values.
APP_ENV=development pnpm infra:up
APP_ENV=development pnpm dev
```

Development retains local PostgreSQL, Mailpit, and the pg-boss worker. MinIO
is stopped. Storage uses real AWS S3 and the AWS SDK credential chain; use an
AWS profile, SSO session, IAM role, or (only if necessary) `AWS_ACCESS_KEY_ID`
and `AWS_SECRET_ACCESS_KEY`. The bucket must be dedicated to development.
The Docker worker reads the host `~/.aws` directory read-only and runs with
the host user's UID so an existing profile or SSO session also works there.
Google OAuth and MSG91 are real. Register
`http://localhost:4000/v1/auth/google/callback` with Google. Resend is unused.
`infra:up` applies existing migrations; create new ones with
`pnpm --filter @dealers-drive/api db:migrate:new` and review them before
applying. Real S3, Google, and MSG91 calls require valid credentials and were
not exercised by the offline test suite.

### Production

Supply the variables in `.env.example.production` through the deployment's
secret/configuration mechanism. `DATABASE_URL` must target a deployed
PostgreSQL instance. `WEB_ORIGIN`, `WEB_BASE_URL`, `API_BASE_URL`, and
`MEDIA_BASE_URL` identify public deployment origins. `SESSION_SECRET`,
`METRICS_SCRAPE_TOKEN`, Google/MSG91/Resend credentials, `ADMIN_ALLOWLIST`,
`AWS_REGION`, and a production `S3_BUCKET` are required. The AWS SDK uses an
IAM workload role when available; static keys are optional. A custom
`GOOGLE_CALLBACK_URL` is needed only if the callback does not follow
`API_BASE_URL/v1/auth/google/callback`. Optional Grafana Loki settings are
supported when log shipping is enabled. Set `NODE_ENV=production` in the
runtime; the production Dockerfile already does. Run
`pnpm --filter @dealers-drive/api db:migrate:deploy` explicitly during deploy.
Production enforces S3, Resend, MSG91, Google auth, metrics, and hidden API
docs. The application refuses local PostgreSQL, MinIO, Mailpit, dummy OTP,
and auth bypass.

| Environment | Storage | Email   | OTP        | Dealer authentication      | Local `infra:up`                             |
| ----------- | ------- | ------- | ---------- | -------------------------- | -------------------------------------------- |
| local       | MinIO   | Mailpit | fixed code | phone login and onboarding | PostgreSQL, MinIO, Mailpit, migrator, worker |
| development | AWS S3  | Mailpit | MSG91      | Google OAuth               | PostgreSQL, Mailpit, migrator, worker        |
| production  | AWS S3  | Resend  | MSG91      | Google OAuth               | not used                                     |

## Progress

[`docs/project/progress.md`](docs/project/progress.md) — 97 features across 14
tiers, plus the sandbox steps.

Tier order note: CI/CD is Tier 3 (F021–F025), immediately after the first
dealer-facing feature. Dockerfiles, workflows and `deploy/` arrive there.
