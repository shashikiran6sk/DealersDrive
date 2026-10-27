---
name: verify-change
description: Run the same checks CI runs on a Dealers-Drive pull request — format, lint, docs references, typecheck, tests with the coverage gate, build and the dependency audit — locally, before pushing. Use before every push and whenever asked to verify, validate or check a change.
---

# Verify a change before pushing

CI (`.github/workflows/ci.yml`) runs these on every pull request. A push that
turns CI red costs a review cycle, so run them first, in this order — the cheap
ones fail fastest.

## 0. Once per checkout

```bash
pnpm install --frozen-lockfile
cp .env.example.local .env                    # if there is no .env yet
pnpm infra:up                                 # Postgres, MinIO, Mailpit
pnpm --filter @dealers-drive/api db:generate  # the Prisma client is generated, not committed
pnpm --filter @dealers-drive/contracts build  # both apps import the built contracts
```

The API's integration suite needs Postgres at
`dealersdrive:dealersdrive@localhost:5432/dealersdrive`; it creates and
migrates its own `dealersdrive_test` database. If the API tests report 0 %
coverage or connection errors, Postgres is not running.

## 1. The gate

```bash
pnpm format:check     # prettier — fix with `pnpm format`
pnpm lint             # format:check + ESLint (no comments in src, no `as`, no `any`) + docs:check
pnpm typecheck
pnpm test             # web, contracts and api, each with a 90 % coverage threshold
pnpm build
```

Narrow while iterating, then run the full gate once before pushing:

```bash
pnpm --filter @dealers-drive/web test
pnpm --filter @dealers-drive/api test
pnpm --filter @dealers-drive/contracts test
pnpm --filter @dealers-drive/web exec vitest run tests/unit/path/to/file.test.tsx
```

## 2. When the change touches these

| You changed                      | Also run                                                                 |
| -------------------------------- | ------------------------------------------------------------------------ |
| a dependency or `pnpm-lock.yaml` | `pnpm audit --audit-level=critical` (CI blocks on critical)              |
| a component or story             | `pnpm --filter @dealers-drive/sandbox build:sandbox`                     |
| a Prisma schema or migration     | `pnpm --filter @dealers-drive/api db:migrate` against a scratch database |
| `deploy/terraform/**`            | `terraform fmt -check -recursive` and `terraform validate`               |
| a route                          | open `/api/docs` with `pnpm dev` running and read the operation          |
| `README.md` or `AGENTS.md`       | `pnpm docs:check` — every backticked path and `pnpm` script must resolve |

## 3. Before you push

- Re-read your own diff as a reviewer would: what would make CI reject it?
- A refactor that needed a test edited changed behaviour — say which in the PR.
- Bring the branch up to date with `main` (merge, never rebase a shared branch)
  and run the gate again if `main` moved.

## Reporting

Put the numbers in the PR description — for example
`web 1,848 / 1,848 · contracts 591 / 591 · api 3,495 / 3,495 · lint · typecheck · build`
— and say plainly if anything was skipped or failed.
