# Day 4 — Configuration, the composition root, and the seams

> **Track:** Week 1 · Orientation
> **Time:** ~3.5 hours · **Prerequisite:** Day 3
> **Goal in one sentence:** explain how one built artifact runs unchanged on a
> laptop, in Docker, on dev and in production — and where every provider choice
> is made.

---

## 1. Why today matters

Two ideas today, and both are load-bearing for Week 4.

**Configuration is injected, never baked.** The same image runs in every
environment. That is why `NEXT_PUBLIC_*` is banned, why `env.ts` validates at
boot, and why a production deploy is a *promotion* rather than a rebuild.

**Every provider choice is made in exactly one file.** `container.ts` is the
composition root: storage, sessions, OAuth, payments, SMS, the queue — all
constructed there, by hand, and passed down as plain arguments. There is no DI
framework and no magic. When you want to know *"what actually runs when
`STORAGE_DRIVER=r2`?"*, there is one file to read.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 2.2** — `config/` and `container.ts` — the composition root | 20 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-E7** — Environment variables, secrets, configuration | 15 |
| `docs/ENGINEER-ONBOARDING.md` | **§23.7** — Configuration: three layers | 15 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 19.10** — Secrets and configuration | 10 |
| [The Twelve-Factor App](https://12factor.net/) | Config, Backing services, Dev/prod parity, Disposability | 25 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `.env.example` | Every variable, with a comment saying what it is for. This is the *interface* to every external system |
| 2 | `apps/api/src/config/env.ts` | **The core file of today.** Read it end to end. Note `required()`, `optional()`, and especially `checkedEnvSchema` |
| 3 | `apps/api/src/config/env.ts` (again) | The `superRefine` block. Find every rule that fires **only in production** |
| 4 | `apps/api/src/container.ts` | The composition root. Read the doc comment listing the five seams |
| 5 | `apps/api/src/platform/storage/factory.ts` | One variable chooses one of three adapters |
| 6 | `apps/api/src/platform/storage/storage.port.ts` | A *port*: an interface with no S3 concept in it. No bucket, no region, no SigV4 |
| 7 | `apps/api/src/modules/auth/session.port.ts` | Another port. Note it offers **no way to pass an identity in** |
| 8 | `apps/api/src/modules/auth/dev-session.adapter.ts` | The `AUTH_MODE=dev` escape hatch, and why it is safe |
| 9 | `apps/web/src/lib/config.ts` | The web side. `serverConfig()` reads `process.env` at **runtime**, on the server |
| 10 | `deploy/aws/env.production.example` | The same variables, with production values. Compare against `.env.example` |

> **The pattern to name today: *ports and adapters*.** A **port** is an interface
> the application defines in terms of its own needs (`StoragePort`,
> `SessionResolver`, `PaymentProvider`, `OAuthProvider`). An **adapter**
> implements it against a real system. The application depends on the port; the
> container picks the adapter. That is what makes MinIO and R2 the *same code*,
> and what lets tests inject a fake Google.

---

## 4. Do

### 4.1 Make the API refuse to start

In `.env`, delete `DATABASE_URL` entirely and restart the API.

Read the output carefully. It lists **every** problem, not just the first, and
tells you to copy `.env.example`. That is `loadEnv()` doing its job: fail at boot,
loudly, rather than at the first request that needs the value.

Restore it.

### 4.2 Trigger a production-only guard

```bash
cd apps/api
NODE_ENV=production AUTH_MODE=dev pnpm start
```

It refuses:

> `AUTH_MODE: must be 'cookie' in production — 'dev' bypasses identity verification.`

Try the same with `STORAGE_DRIVER=local`, and with the default `SESSION_SECRET`.
Each is a separate rule in `checkedEnvSchema`. **These rules are why a
misconfigured production task fails its health check and is rolled back rather
than serving.**

### 4.3 Swap a provider with one variable

```bash
# .env
STORAGE_DRIVER=local
```
Restart, upload a photo in the dealer console, then:
```bash
ls apps/api/.storage/vehicles/
```

```bash
# .env
STORAGE_DRIVER=minio
```
Restart, upload another photo, then look in the MinIO console at
http://localhost:9001.

**No application code changed.** Read `factory.ts` again and confirm there is no
`if (isR2)` anywhere in `s3.adapter.ts` — MinIO and R2 are one adapter because
they are one protocol.

### 4.4 Read the container as a dependency graph

Open `container.ts` and draw the construction order on paper:

```
prisma ──┬──▶ sessionStore ──▶ sessions (resolver) ──▶ guards
         ├──▶ repositories ──▶ services ──▶ (returned in Container)
         ├──▶ outbox
storage ─┘
queue
```

Then answer: **why must `sessionStore` be constructed before `guards`?** And:
**what would you pass to `buildContainer()` in a test that must not talk to
Google?** (The answer is in `ContainerOverrides`.)

### 4.5 Prove no file reads `process.env` except `env.ts`

```bash
grep -rn "process.env" apps/api/src | grep -v "config/env.ts"
```

Anything that appears here is a bug by convention (`env.ts`'s closing comment
says so). Note the web app is different — `lib/config.ts` is its equivalent
single entry point.

### 4.6 Confirm `NEXT_PUBLIC_` is genuinely absent

```bash
grep -rn "NEXT_PUBLIC" apps/web/src ; echo "exit: $?"
```

Nothing. That absence is what makes build-once-promote-many possible (Day 19).

---

## 5. Prove you understood it

1. Why does `env.ts` `process.exit(1)` rather than throw? → *`env.ts`, `loadEnv()`*
2. Why does `required()` provide a local default outside production but not
   inside it? → *`env.ts`, top of file*
3. Why does `optional()` treat `""` as absent? → *`env.ts` comment*
4. Name four production-only rules in `checkedEnvSchema` and say what each
   prevents.
5. What is a *port*, what is an *adapter*, and where is the choice between
   adapters made? → *§Part 2.2, `container.ts`*
6. Why is `AUTH_MODE=dev` safe to have in the codebase at all? → *`dev-session.adapter.ts` doc comment*
7. Why is `NEXT_PUBLIC_*` banned? → *`lib/config.ts`, §23.3*
8. Where do production secrets actually live, and who resolves them? → *§23.7*

---

## 6. Traps

- **dotenv never overwrites an already-set variable.** Real environment
  variables (Docker `-e`, ECS task definition, GitHub Actions) always win over
  `.env` files. That ordering is deliberate — see the comment at the top of
  `env.ts`.
- **`env` is frozen.** Mutating it at runtime silently does nothing in
  non-strict contexts. Configuration is read once, at boot.
- **A blank value is not an unset value to `.min(1)`.** `GOOGLE_CLIENT_ID=` in a
  `.env` file is the empty string. That is why `optional()` exists.

---

## 7. Deliverable

- [ ] I made the API refuse to boot on a missing variable and read the full report
- [ ] I triggered at least three production-only configuration guards
- [ ] I swapped `STORAGE_DRIVER` between `local` and `minio` and saw both work
- [ ] I drew the `container.ts` construction graph
- [ ] I confirmed `process.env` appears nowhere but `env.ts` in the API
- [ ] I confirmed `NEXT_PUBLIC_` appears nowhere in the web app
- [ ] I can explain "port" and "adapter" with two examples from this repo
- [ ] I have answered all eight questions in §5

---

## 8. Going deeper (optional)

- Open `apps/api/tests/unit/config/` and see the environment rules asserted as
  tests. A configuration guard that is not tested is a guard that quietly stops
  guarding.
- Read `deploy/aws/taskdef/api.example.json` and find the split between
  `environment` (plain values) and `secrets` (SSM ARNs). Day 19 and Day 20
  return to it.
