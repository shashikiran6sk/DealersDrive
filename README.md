<p align="center">
  <a href="https://www.dealers-drive.com">
    <img src="apps/web/public/brand/dealers-drive-light.svg" alt="Dealers-Drive" width="320">
  </a>
</p>

<h3 align="center">The used-car marketplace for Tamil Nadu's independent dealers.</h3>

<p align="center">
  Dealers list their stock. Buyers browse every car in their district, without an account.
</p>

<p align="center">
  <a href="https://www.dealers-drive.com"><strong>dealers-drive.com</strong></a> ·
  <a href="#introduction"><strong>Introduction</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#tech-stack"><strong>Tech Stack</strong></a> ·
  <a href="#local-development"><strong>Local Development</strong></a> ·
  <a href="#contributing"><strong>Contributing</strong></a> ·
  <a href="#license"><strong>License</strong></a>
</p>

<br/>

## Introduction

Dealers-Drive is a B2B2C used-car marketplace. Independent dealerships in Tamil
Nadu put their inventory online with verified photographs and details; buyers
search by district, compare, save cars and send an enquiry straight to the
dealer; an admin console approves every dealership and every listing before it
goes public.

## Features

- **Public marketplace** — server-rendered search with district, make, price,
  fuel and body filters; a page for every car and every dealership; sitemaps
  and structured data for search engines.
- **Enquiries** — a buyer reaches the dealer in one form; the dealer works
  them from an inbox (New → Contacted → Closed or Spam).
- **Dealer console** — inventory, listing submission with photographs,
  documents and verification, enquiries, team members with roles
  (Owner, Manager, Staff), and the dealership's public profile.
- **Admin console** — dealership onboarding and approval, listing
  moderation, enquiries, support tickets, platform configuration and
  administrator management, signed in by mobile OTP.
- **Sales console** — assisted onboarding of dealerships by the field team.
- **Accounts** — buyers and dealers sign in with Google or a mobile OTP; one
  person can belong to several dealerships.

## Tech Stack

- [Next.js 15](https://nextjs.org/) — App Router, React Server Components
- [React 19](https://react.dev/)
- [Tailwind CSS v4](https://tailwindcss.com/) + [CVA](https://cva.style/) +
  [Radix UI](https://www.radix-ui.com/) — styling and accessible primitives
- [Express 5](https://expressjs.com/) — the API, as a modular monolith
- [PostgreSQL 16](https://www.postgresql.org/) + [Prisma 7](https://www.prisma.io/) — database and ORM
- [pg-boss](https://github.com/timgit/pg-boss) — background jobs on the same database
- [Zod 4](https://zod.dev/) — one contract package validating every request and typing every response
- [Storybook 10](https://storybook.js.org/) — the component sandbox
- [Vitest](https://vitest.dev/) + [Testing Library](https://testing-library.com/) — tests
- [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/) — monorepo
- [Vercel](https://vercel.com/) (web) · [AWS](https://aws.amazon.com/) ECS, S3 and RDS with [Terraform](https://www.terraform.io/) (API)
- [Resend](https://resend.com/) (email) · [MSG91](https://msg91.com/) (SMS OTP) · [Grafana Cloud](https://grafana.com/) (observability)

## Repository

```
apps/
  api/          Express API — modules, platform adapters, Prisma schema, jobs
  web/          Next.js app — marketplace, dealer, admin and sales consoles
  sandbox/      Storybook — every UI component, with its states
packages/
  contracts/    Zod schemas shared by the API and the web app
  config/       ESLint, TypeScript and Tailwind configuration
deploy/         AWS (Terraform, ECS task definitions) and the single-box demo
observability/  Grafana dashboards and alert rules
docs/
  code/         why each source file is the way it is
```

## Local Development

Requires Node 24, pnpm 9.15.9 and Docker.

```bash
pnpm install
cp .env.example.local .env
pnpm infra:up                 # Postgres, MinIO, Mailpit
pnpm --filter @dealers-drive/api db:migrate
pnpm db:seed:dev              # 120 dealerships across four states, then their cars
pnpm dev                      # web on :3000, API on :4000
```

`pnpm db:seed:vehicles:dev` reseeds only the cars once the dealerships exist,
and `pnpm sandbox` opens the component sandbox on :6006.

Before pushing, run what CI runs:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`.env.example.dev` and `.env.example.production` are the deployment
templates; `deploy/README.md` and `deploy/aws/README.md` describe the
environments.

## Contributing

**[`AGENTS.md`](AGENTS.md) is the operating manual — for people and coding
agents alike. Read it first.** It covers the workflow, the engineering
invariants, where code goes, and what "done" means. Step-by-step guides for the
common tasks are in [`.claude/skills/`](.claude/skills).

| Where                                                                     | What                                                                             |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                                  | How to work on this repository                                                   |
| [`docs/code/`](docs/code/README.md)                                       | Why the code is the way it is, page by source path                               |
| [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md)                              | What the product looks like                                                      |
| [`docs/observability.md`](docs/observability.md)                          | Metrics, logs, dashboards and alerts                                             |
| [`docs` branch](https://github.com/shashikiran6sk/DealersDrive/tree/docs) | History and process: engineering log, feature map, certification, original specs |

## License

Copyright © 2026 Shashikiran Lakshminarayanan, trading as Dealers-Drive. All
rights reserved. See [`LICENSE`](LICENSE). This repository is not open source;
no licence to use, copy, modify or distribute it is granted.
