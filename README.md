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

|                                                                          |                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| [`CLAUDE.md`](CLAUDE.md)                                                 | How to work on this repository. Required reading.            |
| [`CONTEXT.md`](CONTEXT.md)                                               | Current state of the reconstruction, and why it is happening |
| [`docs/project/feature-map.md`](docs/project/feature-map.md)             | The 97 features, in order, with their exact files            |
| [`docs/project/component-map.md`](docs/project/component-map.md)         | All 65 UI components                                         |
| [`docs/project/component-sandbox.md`](docs/project/component-sandbox.md) | The component sandbox                                        |
| [`docs/project/git-strategy.md`](docs/project/git-strategy.md)           | Branching, risk register, verification gate                  |

## Stack

Turborepo + pnpm · Next.js 15 (App Router, RSC) · Express 5 · PostgreSQL 16 +
Prisma 6 · Zod 4 · Tailwind v4 · Node 24 · TypeScript 5.9

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm infra:up                 # Postgres, MinIO, Mailpit
pnpm typecheck && pnpm test && pnpm build
```

## Progress

[`docs/project/progress.md`](docs/project/progress.md) — 97 features across 14
tiers, plus the sandbox steps.

Tier order note: CI/CD is Tier 3 (F021–F025), immediately after the first
dealer-facing feature. Dockerfiles, workflows and `deploy/` arrive there.
