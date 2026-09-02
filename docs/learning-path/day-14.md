# Day 14 — Background jobs, the transactional outbox and pg-boss

> **Track:** Week 3 · The domain
> **Time:** ~4 hours · **Prerequisite:** Day 13
> **Goal in one sentence:** explain why you cannot atomically write to a database
> and publish to a queue, and how the outbox pattern resolves it.

---

## 1. Why today matters

Yesterday you watched a car appear in `listing_search` "a moment after" approval.
Today you find out exactly what moved it, and why the delay is a feature rather
than sloppiness.

The problem, stated precisely:

> You cannot atomically write to your database **and** publish to an external
> queue. Either the row commits and the message is lost, or the message is sent
> and the transaction rolls back.

There is no clever ordering that fixes this — it is two systems with two commits.
The **transactional outbox** resolves it by writing the event _into the same
database, in the same transaction_, and having a poller move it out afterwards.

That gives **at-least-once** delivery, which is why every handler in this system
is idempotent. Exactly-once delivery does not exist; at-least-once plus
idempotent handlers is _effectively_ exactly-once processing, and that is the
best any distributed system gets.

---

## 2. Read first

| Source                                                                                                      | Sections                                                                      | ~min |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md`                                                                               | **Part 13** — all of it (13.1 → 13.8)                                         | 55   |
| `docs/ENGINEER-ONBOARDING.md`                                                                               | **Part 34-F1, F2, F4, F6** — idempotency, at-least-once, the outbox, priority | 20   |
| `docs/ENGINEER-ONBOARDING.md`                                                                               | **§33.8** — how the job system scales                                         | 15   |
| [microservices.io — Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) | the whole page                                                                | 10   |

---

## 3. Open these files, in this order

| #   | File                                               | What to look for                                                                                                                    |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/api/prisma/schema.prisma`                    | The `OutboxEvent` model. Note `publishedAt`, `attempts`, and the `@@index([publishedAt, id])`                                       |
| 2   | `apps/api/src/platform/events/bus.ts`              | The in-process event bus. Publishers do not know who subscribes                                                                     |
| 3   | `apps/api/src/platform/events/outbox-publisher.ts` | **The core file.** The 2-second poll, and `FOR UPDATE SKIP LOCKED` — read the comment about several workers draining the same table |
| 4   | `apps/api/src/platform/jobs/queue.ts`              | The `Queue` port. Eleven job names, and the `PRIORITIES` map — note which job is 100 and read the comment                           |
| 5   | `apps/api/src/platform/jobs/queue.ts`              | `createInlineQueue()` — runs handlers synchronously at send time. This is what the test suite uses, and why tests need no sleeps    |
| 6   | `apps/api/src/platform/jobs/handlers.ts`           | All eleven handlers, and the cron schedules. Note the `Asia/Kolkata` timezone                                                       |
| 7   | `apps/api/src/container.ts`                        | `startBackground()` — where the queue and outbox actually start, and the `WORKER_INLINE` branch                                     |
| 8   | `apps/api/src/modules/admin/admin.service.ts`      | Find where an approval writes an outbox row **in the same transaction** as the state change                                         |

---

## 4. Do

### 4.1 See the outbox in flight

Keep this query on hand and run it repeatedly, quickly, right after an approval:

```sql
SELECT id, payload->>'type' AS type, "publishedAt", attempts
FROM outbox_events ORDER BY id DESC LIMIT 5;
```

A shell loop works too:

```bash
while true; do
  docker compose exec -T postgres psql -U dealersdrive -d dealersdrive \
    -c 'SELECT id, "publishedAt", attempts FROM outbox_events ORDER BY id DESC LIMIT 3;'
  sleep 1
done
```

Approve a listing in the admin console. You should catch a row with
`publishedAt = NULL`, and see it filled in within ~2 seconds. **That gap is the
poll interval**, and it is the "moment" you observed yesterday.

### 4.2 Prove the atomicity claim

Read §13.3, then reason it through in writing:

> If the API crashed **after** committing the listing approval but **before** the
> publisher ran, what happens to the notification and the search index?

Answer: nothing is lost. The outbox row committed with the approval, and the
publisher picks it up on the next tick — possibly minutes later after a restart.
Now the opposite:

> If the API had instead called `queue.send()` directly inside the transaction,
> and the transaction then rolled back?

Answer: the job was already sent. A notification goes out for an approval that
never happened.

### 4.3 Watch pg-boss

```sql
\dn                                    -- note the `pgboss` schema
SELECT name, state, count(*) FROM pgboss.job GROUP BY name, state ORDER BY count DESC;
```

The queue is **in the same database as the data**. That is what makes
transactional enqueue possible, and it is the reason there is no Redis in this
system. Read §13.5's "Why pg-boss and not Redis/BullMQ".

### 4.4 Make a job fail, and watch it retry

Temporarily make one handler throw — for example, add `throw new Error('boom')`
at the top of the `search.index-listing` handler in `handlers.ts`. Restart,
approve a listing, then:

```sql
SELECT name, state, retrycount, output FROM pgboss.job
WHERE name = 'search.index-listing' ORDER BY createdon DESC LIMIT 5;
```

Watch `retrycount` climb. `queue.ts` sets `retryLimit: 3, retryBackoff: true`.
After the limit it is dead-lettered rather than lost.

**Remove the throw and restart.**

### 4.5 Prove a handler is idempotent

`search.index-listing` rebuilds one row from scratch. Run it twice by hand:

```sql
SELECT count(*) FROM listing_search WHERE listing_id = '<an approved listing id>';
```

Then re-enqueue the same job (approve/withdraw/approve, or call the handler
directly in a `tsx` script) and check the count again. **Still exactly one row.**

That is not luck. Read `search.repository.ts` `index()` again: it deletes and
re-inserts, so running it twice is the same as running it once. **Every handler
here is written that way, because at-least-once delivery means every handler
_will_ run twice eventually.**

### 4.6 Understand the two queue implementations

```bash
grep -n "JOBS_ENABLED" apps/api/src/platform/jobs/queue.ts apps/api/src/config/env.ts
```

|                 | `JOBS_ENABLED=true`    | `JOBS_ENABLED=false`            |
| --------------- | ---------------------- | ------------------------------- |
| Implementation  | pg-boss                | `createInlineQueue()`           |
| When a job runs | polled, asynchronously | **synchronously, at send time** |
| Used by         | dev, production        | the integration test suite      |

Read the comment on `createInlineQueue`: _"Deliberately not fire and forget: a
test that submits a listing must be able to assert on what the subscriber wrote,
on the next line, without a sleep."_ That is why this suite has no flaky waits.

### 4.7 Find the priority decision

```bash
grep -n -A6 "const PRIORITIES" apps/api/src/platform/jobs/queue.ts
```

`notification.enquiry-to-dealer` is **100** — the highest — with the comment
_"It is the product."_ A buyer's enquiry reaching a dealer fast is the thing
dealers pay for. Media processing can wait a few seconds; a lead cannot.

**That single line is a product decision expressed in code.** Look for more of
them as you read this repository.

---

## 5. Prove you understood it

1. Why is `await sendEmail()` inside a request handler not enough? → _§13.1_
2. State the dual-write problem precisely. → _§13.3, §34-F4_
3. How does the outbox pattern solve it? → _§13.3_
4. What does `FOR UPDATE SKIP LOCKED` do, and why does the publisher need it? → _`outbox-publisher.ts`_
5. What is at-least-once delivery, and what does it require of handlers? → _§13.3, §34-F2_
6. Why does exactly-once delivery not exist? → _§34-F2_
7. Give a concrete example of an idempotent handler in this codebase. → _`search.repository.ts` `index()`_
8. Why is the queue in PostgreSQL rather than Redis? → _§13.5_
9. What does `WORKER_INLINE=true` mean, and what does it cost? → _§13.7, §23.8_
10. Which job has the highest priority, and why? → _`queue.ts`_

---

## 6. Traps

- **Never enqueue inside a transaction that might roll back.** Write an outbox
  row instead. That is the whole pattern.
- **A handler that is not idempotent is a bug**, not a risk. It _will_ run twice.
- **Cron schedules are `Asia/Kolkata`.** The dealers are in Tamil Nadu; a sweep
  scheduled in UTC would run in the middle of their working day.
- **`WORKER_INLINE=true` means every API instance runs every scheduled job.**
  This is exactly why `dd-api-prod` is capped at one task (Day 19, Day 20).

---

## 7. Deliverable

- [ ] I caught an outbox row with `publishedAt = NULL` and watched it publish
- [ ] I wrote out both halves of the dual-write failure and why the outbox fixes it
- [ ] I inspected the `pgboss` schema and its job states
- [ ] I made a handler fail and watched `retrycount` climb, then restored it
- [ ] I proved a handler is idempotent by running it twice
- [ ] I can explain why the test suite uses an inline queue
- [ ] I found the priority decision and can explain it
- [ ] I have answered all ten questions in §5

---

## 8. Going deeper (optional)

- Read **§33.8** — how this scales, and note that when pg-boss stops keeping up,
  `outbox-publisher.ts` is _the only file that changes_. That is what the seam in
  `bus.ts` bought.
- Read **Part 25.5** — "What happens if…" for jobs: a notification fails, a job
  retries, a duplicate webhook arrives, the worker crashes mid-job.
