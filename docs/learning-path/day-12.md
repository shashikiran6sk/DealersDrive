# Day 12 — Credits and the ledger

> **Track:** Week 3 · The domain
> **Time:** ~4 hours · **Prerequisite:** Day 11
> **Goal in one sentence:** explain why a balance is never stored but derived,
> and walk the hold → consume → release lifecycle without notes.

---

## 1. Why today matters

Credits are how Dealers-Drive makes money. A bug here is not a rendering
glitch — it is a dealer charged twice, or a car published for free, or a balance
that cannot be reconciled with what was paid.

The rule (Rule 4):

> **Never store a balance; store the movements.** The current value is a cache of
> the newest row.

`Dealer.creditBalance` exists, and it is explicitly a **mirror** of the newest
`CreditTransaction.balanceAfter`. It is never authoritative on its own. Every
write path re-reads the ledger under a row lock. If you take one accounting idea
from this path, take this one — it is how every real financial system works.

---

## 2. Read first

| Source                        | Sections                                                    | ~min |
| ----------------------------- | ----------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md` | **Part 10** — all of it (10.1 → 10.10)                      | 70   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 8.3, mechanism 2** — row locking for the balance     | 10   |
| `docs/CLAUDE.md`              | §7 (credit system) and Rule 3, Rule 4                       | 10   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 15.1** — what is real and what is mocked in payments | 10   |

Read **§10.1 twice**. It shows the naive approach and _exactly_ how it fails,
with two interleaved requests. Everything else follows from that failure.

---

## 3. Open these files, in this order

| #   | File                                                                             | What to look for                                                                                 |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `apps/api/prisma/schema.prisma`                                                  | The `CreditTransaction` model. Note `delta`, `balanceAfter`, `reason`, and `seq`                 |
| 2   | `apps/api/prisma/migrations/20260816200000_credit_ledger_sequence/migration.sql` | Why a `BIGSERIAL` was needed. **`createdAt` cannot order a ledger** — §10.7 explains the failure |
| 3   | `apps/api/src/modules/billing/credits.service.ts`                                | **The core file.** Find `moveCredits()` — the only function allowed to move a balance            |
| 4   | `apps/api/src/modules/billing/credits.service.ts`                                | The `FOR UPDATE` lock, and the order of operations inside the transaction                        |
| 5   | `apps/api/src/modules/billing/billing.service.ts`                                | The purchase flow. Note it goes through a `PaymentProvider` port                                 |
| 6   | `apps/api/src/platform/payments/payment.port.ts`                                 | The seam Razorpay will slot into                                                                 |
| 7   | `apps/api/src/platform/payments/development.provider.ts`                         | What is active today: settles inline, contacts no gateway                                        |
| 8   | `apps/api/src/modules/listings/listing.state.ts`                                 | Where credits are held and consumed. Tomorrow's file, previewed                                  |
| 9   | `apps/api/tests/credits.test.ts`                                                 | The concurrency assertions. Read them before running them                                        |

---

## 4. Do

### 4.1 Read a real ledger

```sql
SELECT seq, "createdAt", reason, delta, "balanceAfter", "listingId"
FROM credit_transactions
WHERE "dealerId" = (SELECT id FROM dealers WHERE slug = 'sri-lakshmi-motors')
ORDER BY seq;
```

Read it as a bank statement. Every row is a **movement**; `balanceAfter` is the
running total. Now prove the mirror is consistent:

```sql
SELECT d.slug, d."creditBalance" AS cached,
       (SELECT ct."balanceAfter" FROM credit_transactions ct
        WHERE ct."dealerId" = d.id ORDER BY ct.seq DESC LIMIT 1) AS truth
FROM dealers d;
```

**Those two columns must always match.** Any mismatch is `drift`, and it catches
a write path that bypassed `moveCredits()` — the single worst bug this system
could have. Day 20 returns to it as a metric.

### 4.2 Understand why `seq` exists

```sql
SELECT count(*) FROM (
  SELECT "createdAt", count(*) FROM credit_transactions
  GROUP BY "createdAt" HAVING count(*) > 1
) dupes;
```

Two transactions committed inside the same clock tick have the **same
`createdAt`**, so ordering by it is non-deterministic — and a ledger whose order
is non-deterministic cannot be reconciled. `seq BIGSERIAL` is monotonic by
construction. Read §10.7 for the concrete failure this caused.

### 4.3 Watch the hold → consume lifecycle

In the dealer console: buy credits, then submit a listing for review, then (as
admin) approve it. After each step:

```sql
SELECT seq, reason, delta, "balanceAfter" FROM credit_transactions
WHERE "dealerId" = (SELECT id FROM dealers WHERE slug = '<your dealer>')
ORDER BY seq DESC LIMIT 5;

SELECT "creditBalance", "creditsHeld" FROM dealers WHERE slug = '<your dealer>';
```

Watch `creditsHeld` rise on submit and fall on approve. Then answer two questions
from §10.5:

- **Why does `CONSUME_APPROVE` have `delta: 0`?**
- **Why does `CHANGES_REQUESTED` keep the hold rather than releasing it?**

Both answers are in the code's comments. Neither is obvious, and both are the
result of a real bug that was found and fixed (§10.5).

### 4.4 Reproduce the race, and watch the lock stop it

This is the exercise of the day.

**Without the lock (thought experiment first — write it out):**

```
Request A: SELECT balance → 1     Request B: SELECT balance → 1
Request A: 1 >= 1, ok             Request B: 1 >= 1, ok
Request A: UPDATE balance = 0     Request B: UPDATE balance = 0
→ two cars published, one credit spent
```

**Now watch the real thing.** Set a dealer to exactly 1 credit, then fire two
concurrent publishes:

```bash
API=http://localhost:4000/v1/dealer/listings
curl -s -b "dd_session=<value>" -X POST "$API/<id-a>/submit" &
curl -s -b "dd_session=<value>" -X POST "$API/<id-b>/submit" &
wait
```

One succeeds. One returns `INSUFFICIENT_CREDITS`. Check the ledger — exactly one
movement. **The second transaction blocked on `FOR UPDATE`, then read the true
post-commit balance.**

### 4.5 Prove the database is the final backstop

Even if the application logic were wrong:

```sql
UPDATE dealers SET "creditBalance" = -1 WHERE slug = 'sri-lakshmi-motors';
```

The `CHECK ("creditBalance" >= 0)` constraint refuses. **Two independent
defences**: the row lock makes the race impossible, and the constraint makes the
outcome impossible. That is defence in depth, and Part 8.3 lists all five
mechanisms.

### 4.6 Follow the mocked purchase

Buy credits in the console. Then:

```sql
SELECT o.id, o.status, p.status AS payment_status, p."capturedAt"
FROM orders o LEFT JOIN payments p ON p."orderId" = o.id
ORDER BY o."createdAt" DESC LIMIT 3;
```

There is a real `Order`, a real `Payment`, a real `CreditTransaction` and a real
`Invoice`. **Only the gateway is mocked** — `DevelopmentPaymentProvider` reports
success inline. Read Part 15.4 for why the _client_ saying "payment succeeded"
must never be what adds credits, even in the mock.

### 4.7 Run the credit suite

```bash
pnpm --filter @dealers-drive/api test -- credits
```

Open `apps/api/tests/credits.test.ts` and find the concurrency test. Note it runs
**serially** — one worker, one connection pool, one sequence of credit movements
(see `vitest.config.ts`). A parallel test suite could not assert on ordering.

---

## 5. Prove you understood it

1. Show, with two interleaved requests, exactly how `dealer.credits -= 1` fails. → _§10.1_
2. What is a ledger, and why is it append-only? → _§10.2_
3. What is `Dealer.creditBalance`, precisely? → _§10.3_
4. Why can `createdAt` not order the ledger? → _§10.7_
5. Why does `CONSUME_APPROVE` have `delta: 0`? → _§10.5_
6. Why does `CHANGES_REQUESTED` keep the hold? → _§10.5_
7. Walk the hold → consume → release lifecycle, naming the `reason` at each step. → _§10.5_
8. Name the two independent defences against a negative balance. → _§10.4, §9.3_
9. What is credit-ledger drift, what causes it, and what would it prove? → _§10.8_
10. In the mocked purchase, what is real and what is not? → _§15.1_

---

## 6. Traps

- **Never mutate a balance outside `moveCredits()`.** That function is the only
  place allowed to, and drift is the alarm that catches a violation.
- **Money is `BigInt` paise.** `₹6.45 Lakh` is a _formatting_ concern at the API
  boundary. Never a float, never rupees in the database.
- **The credit movement and the thing it pays for must be one transaction.**
  Rule 4. Otherwise you can charge for a publish that then fails.
- **A held credit is not a spent credit.** `creditsHeld` and `creditBalance` are
  different columns for a reason.

---

## 7. Deliverable

- [ ] I read a real ledger and proved the cached balance matches the newest row
- [ ] I explained why `seq` exists rather than ordering by `createdAt`
- [ ] I walked hold → consume and answered both "why" questions from §10.5
- [ ] I reproduced the concurrent-spend race and watched exactly one succeed
- [ ] I proved the `CHECK` constraint refuses a negative balance directly in SQL
- [ ] I followed a mocked purchase through orders, payments, ledger and invoice
- [ ] I ran and read `credits.test.ts`
- [ ] I have answered all ten questions in §5

---

## 8. Going deeper (optional)

- Read **Part 10.8** — the nightly reconciliation job. It computes drift and
  proves the invariant every night. Then find `counters.reconcile` in
  `platform/jobs/handlers.ts` (Day 14).
- Read **Part 15** in full — payments, webhooks and idempotency — and note
  exactly what remains to be built for Razorpay (§15.7). It is a checklist, and
  it is short _because_ the port was shaped for it.
