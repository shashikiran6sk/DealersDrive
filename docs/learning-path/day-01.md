# Day 1 — The product, the repository, and getting it running

> **Track:** Week 1 · Orientation
> **Time:** ~4 hours · **Prerequisite:** the setup check in [README.md](README.md)
> **Goal in one sentence:** run the entire stack on your machine, and be able to
> name every top-level directory and say what lives in it.

---

## 1. Why today matters

You cannot reason about a system you have never seen move. Today is deliberately
weighted towards *doing* rather than reading: by this evening you should have
clicked through the marketplace, signed into the dealer console, and seen a car
you created appear in search.

The single most valuable habit this path is trying to build starts today:
**when something confuses you, open the file rather than guessing.** This
codebase is unusually well commented — most "why is it like this?" questions are
answered in a comment two lines above the code.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 1** — The big picture (1.1 → 1.13) | 45 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 2** — Repository structure (2.1 → 2.4) | 40 |
| `docs/CLAUDE.md` | §1, §5, §6, §11 (the nine rules) | 20 |
| `README.md` (repo root) | the Quick start and Commands sections | 10 |

**Do not** read Parts 3 onward today. The order matters.

While reading Part 1, keep one question in mind: *why PostgreSQL and not
MongoDB?* Section 1.6 answers it, and that answer is the reason for roughly a
third of the decisions you will meet in Week 3.

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `package.json` | The root scripts. Note that `dev`, `build`, `test` all delegate to `turbo run` |
| 2 | `pnpm-workspace.yaml` | Four lines. This is what makes `apps/*` and `packages/*` one workspace |
| 3 | `turbo.json` | Skim only. Day 2 explains it |
| 4 | `docker-compose.yml` | The three infrastructure services: `postgres`, `minio`, `mailpit`. Note the `profiles:` on the app services |
| 5 | `.env.example` | Every variable the system takes, with a comment explaining each. **Read the comments** — this file is a map of every external dependency |
| 6 | `apps/api/src/routes.ts` | The entire API surface in one file. Note the four mount points and their different guard chains |
| 7 | `apps/web/src/app/` | The route groups: `(public)`, `(dealer)`, `(admin)`, `(auth)`. Directory names in brackets do not appear in the URL |
| 8 | `apps/api/prisma/schema.prisma` | Skim the model names only. Do not try to understand it yet — Day 11 |
| 9 | `packages/contracts/src/` | Six files. These are the shapes both apps agree on |

> **How to read `routes.ts` today.** Ignore the handlers. Read only the comment
> block at the top and the four `v1.use(...)` groupings. That comment is the
> authorization model of the entire product in twelve lines.

---

## 4. Do

### 4.1 Start the infrastructure

```bash
pnpm infra:up          # postgres + minio + mailpit
docker compose ps      # all three should be healthy
```

### 4.2 Set up the database

```bash
pnpm --filter @dealers-drive/api db:generate   # generate the Prisma client
pnpm --filter @dealers-drive/api db:migrate    # apply migrations
pnpm --filter @dealers-drive/api db:seed       # 5 dealerships, 23 cars, images
```

> `db:seed` truncates every application table and rebuilds the world. That is
> correct on a laptop and catastrophic anywhere else. Day 20 covers why
> `db:bootstrap` is the deployed-environment command instead.

### 4.3 Run the apps

```bash
pnpm dev
```

Three processes start in one terminal: `contracts` in watch mode, the API on
`:4000`, the web app on `:3000`. Wait for the API's `dealers-drive api listening`
log line.

### 4.4 Click through the product — 45 minutes, unhurried

| Do this | Notice |
|---|---|
| Open http://localhost:3000 | Per-city counts, body-type tiles. **None of these are hard-coded** |
| Search a car, apply filters | The filters are in the **URL**, not in React state. Copy the URL into a new tab — same results |
| Open a car's detail page | The gallery. The dealer card. **The phone number is not shown** |
| Click to reveal the phone number | Rule 7. Note it took a separate request |
| Open http://localhost:4000/api/docs | The generated OpenAPI reference. Every endpoint, every error code |
| Open http://localhost:4000/health/ready | Note `version`, `appEnv`, `checks` |
| Open http://localhost:9001 (MinIO console) | The `dealers-drive` bucket. Find a seeded photo. `minioadmin` / `minioadmin` |

### 4.5 Sign in as a dealer

```bash
# In .env, set:
AUTH_MODE=dev
```

Restart `pnpm dev`. This bypasses Google sign-in and makes every request act as
the dealer named by `DEV_DEALER_SLUG`. It logs a loud warning on every boot, and
`env.ts` refuses it in production — that is deliberate.

Now visit http://localhost:3000/dealer and walk the console: inventory, add a
vehicle, upload a photo, look at billing.

> **You are not expected to understand *how* any of this works today.** You are
> building the mental picture that Weeks 2–4 attach detail to.

### 4.6 Prove the four commands pass

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

These are the four commands CI runs. Nothing you can pass CI with is something
you could not have run locally in one line. Expect `pnpm test` to take a few
minutes — it runs against a real database.

---

## 5. Prove you understood it

Answer without looking. Then check the named section.

1. What does Dealers-Drive sell, and who pays for it? → *Part 1.1, 1.2*
2. Name the three surfaces (the three kinds of user-facing application). → *Part 1.3*
3. Why PostgreSQL rather than MongoDB? Give two reasons that are about
   *correctness*, not preference. → *Part 1.6*
4. Why is the backend a modular monolith rather than microservices? → *Part 1.5, 1.9*
5. Why does a shared `contracts` package exist at all? → *Part 1.10*
6. What are the four mount points in `routes.ts`, and how do their guard chains
   differ? → *`apps/api/src/routes.ts`, top comment*
7. Why is there object storage instead of just storing images in Postgres? → *Part 1.12*

---

## 6. Traps

- **`Cannot find module '@dealers-drive/contracts'`** — you ran `next dev`
  directly instead of `pnpm dev` at the root, so `contracts/dist` was never
  built. Always start from the root.
- **`PrismaClient` has no models / `Cannot find module '@prisma/client'`** — the
  Prisma client is *generated*, not committed. Run `db:generate`.
- **Port already in use** — a stale process. Check with
  `lsof -nP -iTCP:3000 -sTCP:LISTEN` before concluding the build is broken.
- **The seed produced no images** — `STORAGE_DRIVER` in `.env` must match what
  is actually running. `local` writes to `apps/api/.storage/`; `minio` needs the
  container up.

---

## 7. Deliverable

- [ ] `pnpm infra:up` runs and all three containers are healthy
- [ ] The database is migrated and seeded
- [ ] `pnpm dev` runs all three processes
- [ ] I have browsed the public marketplace and revealed a dealer phone number
- [ ] I have signed into the dealer console with `AUTH_MODE=dev`
- [ ] I have created a vehicle and uploaded a photo
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` all pass
- [ ] I can name every top-level directory and say what is in it
- [ ] I have answered all seven questions in §5

---

## 8. Going deeper (optional)

- Read **Part 26** — "Why did we build it this way?" It is a list of every major
  decision with its justification. Skim it now; it will make more sense weekly.
- Run `pnpm app:up` instead of `pnpm dev`. This builds the **real production
  images** and runs everything in Docker. It is slower, and it is the only local
  command that exercises what CI builds. Day 19 returns to it.
