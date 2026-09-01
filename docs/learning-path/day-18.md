# Day 18 — Testing, and why the suite uses a real database

> **Track:** Week 4 · The surface, and running it
> **Time:** ~3.5 hours · **Prerequisite:** Day 17
> **Goal in one sentence:** write an integration test that proves tenant
> isolation, and explain why mocking the database here would prove nothing.

---

## 1. Why today matters

Most of the invariants you learned in Week 3 **only exist in the database**:

- `creditBalance >= 0` is a `CHECK` constraint.
- "no two live listings for one vehicle" is a partial unique index.
- "the second concurrent spend blocks" is `SELECT … FOR UPDATE`.
- "only admins have passwords" is a `CHECK` constraint.

A mocked Prisma client cannot fail any of those, **which means a mocked Prisma
client cannot prove any of them.** That is why this suite runs against a real
PostgreSQL — in CI too, as a service container.

Today you also learn to read a test as documentation. Several of the trickiest
behaviours in this system are most clearly explained by the test that pins them.

---

## 2. Read first

| Source                        | Sections                                                      | ~min |
| ----------------------------- | ------------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md` | **Part 22** — all of it (22.1 → 22.9)                         | 45   |
| `docs/CLAUDE.md`              | §26 (testing) and §27 (definition of done)                    | 10   |
| `docs/ENGINEER-ONBOARDING.md` | **§31.3** — the `verify` job, and why CI runs a real Postgres | 10   |

---

## 3. Open these files, in this order

| #   | File                                              | What to look for                                                                                              |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/api/vitest.config.ts`                       | Two projects: `unit` and `integration`. Note `maxWorkers: 1` and read the comment                             |
| 2   | `apps/api/tests/global-setup.ts`                  | **The suite creates and migrates its own `dealersdrive_test` database.** Not the workflow's job — this file's |
| 3   | `apps/api/tests/harness.ts`                       | How a test gets an app instance with fakes injected                                                           |
| 4   | `apps/api/tests/auth-harness.ts`                  | The **fake `OAuthProvider`**. No test ever talks to Google — this is what `oauth.port.ts` bought              |
| 5   | `apps/api/tests/fixtures.ts`                      | Building a dealer, a vehicle, a listing                                                                       |
| 6   | `apps/api/tests/tenant-isolation.test.ts`         | Day 10's file. Now read it as a _pattern to copy_                                                             |
| 7   | `apps/api/tests/credits.test.ts`                  | The concurrency assertions. Note they need serial execution                                                   |
| 8   | `apps/api/tests/public-visibility.test.ts`        | The truth table, executable                                                                                   |
| 9   | `apps/api/tests/listing-lifecycle.test.ts`        | Every **illegal** transition refused — the half people forget                                                 |
| 10  | `apps/api/tests/contracts.test.ts`                | Responses must satisfy the published Zod schemas                                                              |
| 11  | `apps/web/vitest.config.ts` and `apps/web/tests/` | The web side: jsdom, Testing Library, stubs                                                                   |

---

## 4. Do

### 4.1 Run each layer separately

```bash
pnpm --filter @dealers-drive/api test
pnpm --filter @dealers-drive/web test
pnpm --filter @dealers-drive/contracts test
pnpm test                                  # all of it, via turbo
```

Note the coverage gate. Read `vitest.config.ts` for the threshold and what is
excluded.

### 4.2 Find out where the test database comes from

```bash
docker compose exec postgres psql -U dealersdrive -d dealersdrive -c '\l'
```

`dealersdrive_test` exists. Read `global-setup.ts`: the suite creates it and
migrates it itself. That is why CI needs only a plain Postgres service container
with the credentials from `ci.yml` — and why changing those credentials breaks
the suite.

### 4.3 Understand `maxWorkers: 1`

Read the comment in `apps/api/vitest.config.ts`:

> One worker, one connection pool, one sequence of credit movements.

Reason it through: the credit tests assert on **ledger ordering** and on
concurrent behaviour against shared rows. Parallel workers hitting one database
would interleave unpredictably, and the assertions would be meaningless.

This is a real trade — the suite is slower — made deliberately, and written down.

### 4.4 Read a test as documentation

Open `apps/api/tests/credits.test.ts` and find the concurrent-spend test. It is
the clearest explanation of Day 12 in the repository: the setup states the
precondition, the two concurrent calls state the race, the assertion states the
invariant.

Do the same with `public-visibility.test.ts`. **Every claim you proved by hand on
Day 13 is asserted there.**

### 4.5 Make a test fail on purpose

Weaken an invariant and watch the suite catch it. For example, in a service,
remove a `dealerId` from a repository call's `where` clause. Then:

```bash
pnpm --filter @dealers-drive/api test -- tenant-isolation
```

It fails, and it names the leak. **Restore the file.**

> This is the exercise that tells you whether the tests are load-bearing or
> decorative. These are load-bearing.

### 4.6 Write a test — today's real work

Pick one and write it properly:

**Option A — tenant isolation for a new surface.**
Choose a dealer-scoped endpoint and add a case to `tenant-isolation.test.ts`
proving Dealer A gets a **404** (not 403) for Dealer B's resource.

**Option B — an illegal state transition.**
Add a case to `listing-lifecycle.test.ts` proving some event is refused from some
state — for example approving an already-`WITHDRAWN` listing.

**Option C — a contract assertion.**
Add a case to `contracts.test.ts` proving a response satisfies its published Zod
schema.

Then:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### 4.7 The four commands, and what each catches

| Command          | Catches                                                                     |
| ---------------- | --------------------------------------------------------------------------- |
| `pnpm lint`      | style, and the **module-boundary rules** (Day 2 §8)                         |
| `pnpm typecheck` | contract drift across both apps                                             |
| `pnpm test`      | behaviour, invariants, tenant isolation, contracts, OpenAPI coverage        |
| `pnpm build`     | that both apps actually compile and the web app builds with nothing running |

None is redundant. Read §22.7 and note what each one catches that the others
cannot.

---

## 5. Prove you understood it

1. Why does the integration suite use a real database rather than a mock? → _§22.2_
2. Name four invariants that only exist in the database. → _§22.2, Day 11_
3. Who creates `dealersdrive_test`, and when? → _`global-setup.ts`_
4. Why `maxWorkers: 1`? What breaks with parallel workers? → _§22.4_
5. How does a test sign in without contacting Google? → _`auth-harness.ts`, `ContainerOverrides`_
6. What does `tenant-isolation.test.ts` prove, and why must it grow with every
   new dealer-scoped endpoint? → _§22.6_
7. Why test **illegal** transitions and not only legal ones? → _`listing-lifecycle.test.ts`_
8. What does `contracts.test.ts` catch that `typecheck` cannot? → _§22.6_
9. What does each of the four commands catch that the others do not? → _§22.7_

---

## 6. Traps

- **Never weaken a test to make it pass.** `docs/CLAUDE.md` §30. If a test is
  wrong, fix the test deliberately and say why in the commit.
- **`JOBS_ENABLED=false` in tests** swaps in the inline queue, so a job's effects
  are assertable on the next line without a sleep (Day 14). Do not add sleeps.
- **One flake is recorded rather than buried** — a 401 on a public GET, seen
  twice in ~30 runs and not reproduced since. `CONTEXT.md` §11 and Part 29.5
  document what was ruled out. **If you see it, capture the response body and the
  `x-trace-id` before doing anything else.**
- **Coverage gates are on.** A new file with no tests can fail the suite.

---

## 7. Deliverable

- [ ] I ran all three test suites separately and together
- [ ] I found `dealersdrive_test` and know what creates it
- [ ] I can explain `maxWorkers: 1` in terms of the credit ledger
- [ ] I read the concurrent-spend test as an explanation of Day 12
- [ ] I broke tenant isolation deliberately, watched the suite catch it, and restored it
- [ ] **I wrote a new test and all four commands pass**
- [ ] I have answered all nine questions in §5

---

## 8. Going deeper (optional)

- Read **§22.9** — the one recorded flake, and what was ruled out. Recording a
  flake honestly rather than re-running until green is a professional habit worth
  copying.
- Read `apps/api/tests/router-probe.ts` and find out how the OpenAPI coverage
  test enumerates routes despite Express 5 compiling mount paths away.
