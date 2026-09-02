# Dealers-Drive — 20-Day Structured Learning Path

**Audience.** An Associate Software Engineer comfortable with MERN/JavaScript, who
does not yet have strong knowledge of authentication, cloud infrastructure,
databases, DevOps, networking or distributed systems.

**Outcome.** After twenty working days you should be able to open any file in
this repository, explain what it does and why it exists, trace a request from a
browser click to a database row and back, and make a change that survives code
review and CI.

---

## How to use this

Every day follows the identical pattern. Do not improvise the order.

```
        ┌──────────────────────────────────────────────────────┐
        │  1. Open  docs/learning-path/day-NN.md               │
        │  2. READ      the named sections. Nothing else.      │
        │  3. OPEN      the named files, in the order given    │
        │  4. DO        the hands-on exercises                 │
        │  5. PROVE     answer the self-check questions        │
        │  6. TICK      the deliverable checklist              │
        └──────────────────────────────────────────────────────┘
                                  ↓
                    Only then move to day-NN+1.md
```

**The rule that makes this work:** never read a section without opening the file
it describes, and never open a file without reading the section that explains it.
Documentation alone produces confident people who cannot ship. Code alone
produces people who can ship one thing and cannot explain it.

### Time budget

Each day is sized at **3–4 focused hours**. If you have a full day, spend the
remainder on the _Going deeper_ section or on the previous day's traps. If you
have two hours, do sections 2, 3 and 5 and defer section 4 — but never skip
section 3.

### The two documents you will live in

|                   | Path                           | Role                                                                              |
| ----------------- | ------------------------------ | --------------------------------------------------------------------------------- |
| **The reference** | `docs/ENGINEER-ONBOARDING.md`  | 35 parts. The _explanation_. You are told exactly which sections to read each day |
| **The path**      | `docs/learning-path/day-NN.md` | 20 files. The _sequence_. One per day                                             |

Supporting sources you will be sent to occasionally:

```
docs/ARCHITECTURE.md    the system design and its numbered rules
docs/API-SPEC.md        every endpoint, request, response and error code
docs/DESIGN-SPEC.md     design tokens, components, states
docs/DEPLOYMENT.md      environments, CI/CD, rollback, cost, monitoring
docs/CLAUDE.md          the nine core rules, and the current scope decisions
deploy/aws/README.md    how dev and production were stood up on AWS
CONTEXT.md              working notes, known gaps, traps already paid for
```

---

## The map

### Week 1 — Orientation: get it running, and understand the path a request takes

| Day             | Title                                               | You will be able to…                                           |
| --------------- | --------------------------------------------------- | -------------------------------------------------------------- |
| [01](day-01.md) | The product, the repository, and getting it running | Run the whole stack locally and name every top-level directory |
| [02](day-02.md) | The monorepo — pnpm workspaces and Turborepo        | Explain why `contracts` builds first and what Turbo caches     |
| [03](day-03.md) | The request lifecycle, end to end                   | Trace any HTTP request through all 19 stages                   |
| [04](day-04.md) | Configuration, the composition root, and the seams  | Explain how one image runs in three environments               |
| [05](day-05.md) | Week 1 consolidation — trace a real buyer journey   | Follow a search from URL to SQL and back, unaided              |

### Week 2 — Identity: who you are, and what you may do

| Day             | Title                                                       | You will be able to…                                         |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| [06](day-06.md) | Networking first principles — DNS, TLS, HTTP, origins, CORS | Explain what happens before your code runs                   |
| [07](day-07.md) | Cookies, tokens and sessions — the three people confuse     | Explain `dd_session` on the wire and in the database         |
| [08](day-08.md) | OAuth 2.0 and OpenID Connect, from first principles         | Explain `state`, PKCE and `nonce` as three different attacks |
| [09](day-09.md) | Google sign-in as this codebase implements it               | Walk the full flow across six files without notes            |
| [10](day-10.md) | Authorization, permissions, multi-tenancy and TOCTOU        | Explain why `dealerId` never comes from a request            |

### Week 3 — The domain: data, money, state and asynchrony

| Day             | Title                                                             | You will be able to…                                           |
| --------------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| [11](day-11.md) | PostgreSQL from a MERN brain — constraints, transactions, indexes | Read the schema and defend every constraint in it              |
| [12](day-12.md) | Credits and the ledger                                            | Explain why a balance is never stored, only derived            |
| [13](day-13.md) | The listing state machine and public visibility                   | Explain why suspending a dealer hides every car, in one job    |
| [14](day-14.md) | Background jobs, the transactional outbox and pg-boss             | Explain at-least-once delivery and why handlers are idempotent |
| [15](day-15.md) | Media — upload, storage, processing, delivery                     | Explain a presigned PUT and why the API never sees image bytes |

### Week 4 — The surface, and running it in production

| Day             | Title                                                   | You will be able to…                                   |
| --------------- | ------------------------------------------------------- | ------------------------------------------------------ |
| [16](day-16.md) | Next.js — Server Components, Server Actions and the BFF | Choose the right one of the four data-fetching shapes  |
| [17](day-17.md) | Contracts, OpenAPI and error handling                   | Explain why `.strict()` is a security control          |
| [18](day-18.md) | Testing — and why the suite uses a real database        | Write an integration test that proves tenant isolation |
| [19](day-19.md) | Docker images and the CI/CD pipeline                    | Describe exactly what happens when you merge a PR      |
| [20](day-20.md) | Database operations, scaling and observability          | Name the first bottleneck and what to change           |

---

## Before Day 1 — a 30-minute setup check

Do this the evening before, so Day 1 is learning rather than troubleshooting.

```bash
node --version          # must satisfy .nvmrc (>= 22)
pnpm --version          # 9.15.9
docker --version        # Docker Desktop running
psql --version          # optional but strongly recommended
jq --version            # used by scripts/smoke.sh
git --version
```

If `pnpm` is missing:

```bash
corepack enable && corepack prepare pnpm@9.15.9 --activate
```

Then:

```bash
cd dealers-drive
cp .env.example .env    # do not edit anything yet — the defaults are all local
pnpm install
```

If `pnpm install` succeeds, you are ready. Everything else happens on Day 1.

---

## Progress tracker

Tick a day only when its deliverable checklist is complete.

```
Week 1   [ ] 01   [ ] 02   [ ] 03   [ ] 04   [ ] 05
Week 2   [ ] 06   [ ] 07   [ ] 08   [ ] 09   [ ] 10
Week 3   [ ] 11   [ ] 12   [ ] 13   [ ] 14   [ ] 15
Week 4   [ ] 16   [ ] 17   [ ] 18   [ ] 19   [ ] 20
```

### The four checkpoints

At the end of each week, you should be able to answer its checkpoint question
**out loud, to another person, without notes.** If you cannot, repeat the weakest
day of that week before continuing.

| End of | Checkpoint question                                                                                                                                    |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Week 1 | _"A buyer opens `/cars?city=vellore`. Describe everything that happens, from DNS to the rendered HTML."_                                               |
| Week 2 | _"A dealer clicks Continue with Google. Describe every redirect, every cookie, and every check — and name what each check defends against."_           |
| Week 3 | _"A dealer publishes a car. Describe every row written, every credit moved, every job queued, and the exact moment the car becomes publicly visible."_ |
| Week 4 | _"I merged a PR. Describe everything that happens until the change is live in production — and what would happen if it were bad."_                     |

---

## The nine rules you are being trained to never break

From `docs/CLAUDE.md` §11. Re-read this list at the end of every week; by Day 20
each line should feel obvious rather than arbitrary.

1. **`dealerId` always comes from the session.** Never a body, query or path.
2. **All API input uses `.strict()` Zod schemas.** Unknown fields are rejected.
3. **Money is `BigInt` paise.** Never floating point.
4. **Every credit movement creates a `CreditTransaction`**, in the same
   transaction as the thing it pays for, under a row lock.
5. **Listing state changes go through `transition()`.** Never assign `.status`.
6. **Public visibility is `APPROVED` + dealer `ACTIVE`**, evaluated in one place.
7. **A dealer's phone number is never in an ordinary public response.**
8. **Server Components by default.** Client components only where interaction
   requires them.
9. **No unnecessary `NEXT_PUBLIC_*`.** Configuration is read at runtime.

---

## If you get stuck

1. **Re-read the section, then re-open the file.** The answer is usually in a
   comment — this codebase explains itself unusually well.
2. **Check Part 25** of `ENGINEER-ONBOARDING.md` — "What happens if…" is a
   troubleshooting table covering forty concrete failure cases.
3. **Check Part 29** — the consolidated list of what is _not_ implemented. Some
   confusion is because the thing genuinely does not exist yet.
4. **Check `CONTEXT.md` §9** — traps that have already cost someone a day.
5. **Then ask.** A question after those four steps is a good question.

---

_This path was written against the repository as of 2026-08-24. Every file path
in it was verified to exist. If a path has moved, the day document is stale —
fix it here rather than working around it._
