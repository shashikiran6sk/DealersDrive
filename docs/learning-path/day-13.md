# Day 13 — The listing state machine and public visibility

> **Track:** Week 3 · The domain
> **Time:** ~4 hours · **Prerequisite:** Day 12
> **Goal in one sentence:** explain why `listing.status = 'APPROVED'` is
> dangerous, and why suspending a dealer removes every one of their cars in one
> job.

---

## 1. Why today matters

Two rules meet today, and they are the two that keep the marketplace honest.

**Rule 5:** listing state changes go through `transition(listing, event, actor)`.
Never assign `.status` directly. A state machine is not ceremony — it is the only
way to guarantee that *every* path into `APPROVED` also set an expiry, consumed
the held credit, wrote an audit row and queued the indexing job.

**Rule 6:** a car is publicly visible if and only if
`listing.status === APPROVED && dealer.status === ACTIVE`. That rule is evaluated
in **one place** — membership in `listing_search` — which is why suspending a
dealer is one job rather than a change to nine queries.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 11** — the listing state machine (11.1 → 11.6) | 45 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 12** — public visibility (12.1 → 12.7) | 40 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-C4, 34-F5** — denormalization, and CQRS as used here | 15 |
| `docs/CLAUDE.md` | Rule 5, Rule 6, Rule 7 | 10 |

**§11.1 is a correction to the vocabulary** — a *vehicle* is not a *listing*.
Read it first; the rest of the part depends on the distinction.

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `apps/api/prisma/schema.prisma` | The `Vehicle` and `Listing` models side by side. **Two different things.** Note the partial unique index preventing two live listings for one vehicle |
| 2 | `apps/api/src/modules/listings/listing.state.ts` | **The core file.** The transition table: which events are legal from which states, and what each one does |
| 3 | `apps/api/src/modules/listings/listings.facade.ts` | What other modules are allowed to see of this one |
| 4 | `apps/api/src/modules/vehicles/vehicles.service.ts` | Find the submit path. `transition()` is called *inside* the transaction that also moves credits |
| 5 | `apps/api/src/modules/admin/admin.service.ts` | The approve/reject path. Same `transition()`, different actor |
| 6 | `apps/api/src/modules/search/search.repository.ts` | `index()` — rebuilds one row, **or removes it** if it no longer satisfies the rule. Idempotent by design |
| 7 | `apps/api/src/platform/jobs/handlers.ts` | Find `search.index-listing`, `search.remove-listing` and `search.reindex-dealer`. Three jobs, one rule |
| 8 | `apps/api/tests/listing-lifecycle.test.ts` | Every legal and illegal transition, asserted |
| 9 | `apps/api/tests/public-visibility.test.ts` | The truth table, asserted |

---

## 4. Do

### 4.1 Draw the state machine

From `listing.state.ts`, draw every state as a box and every event as a labelled
arrow. Include the states people forget: `DRAFT`, `PENDING_REVIEW`,
`CHANGES_REQUESTED`, `APPROVED`, `REJECTED`, `EXPIRED`, `WITHDRAWN`.

For each arrow, note three things:
- who may fire it (dealer? admin? the system?)
- what it does to credits
- whether it changes public visibility

**Then check your drawing against §11.2.** Anything you got wrong is today's
re-read.

### 4.2 Prove why direct assignment is dangerous

Read §11.3, then list — in writing — everything that `transition()` does on the
path to `APPROVED` besides setting the status:

```
□ set expiresAt          (a CHECK constraint requires it — try violating it)
□ consume the held credit
□ write an audit row
□ enqueue search.index-listing
□ …
```

Now: `listing.status = 'APPROVED'` does exactly one of those. **That is why
Rule 5 exists.** And note the database is the backstop:

```sql
UPDATE listings SET status = 'APPROVED', "expiresAt" = NULL
WHERE id = (SELECT id FROM listings LIMIT 1);
```

Refused. §11.4 calls this the two-part defence: the state machine in code, the
constraint in the database.

### 4.3 Walk a listing through its whole life

In the UI, as dealer then as admin, and watch the database after every step:

```sql
SELECT l.id, l.status, l."submittedAt", l."expiresAt", v.title
FROM listings l JOIN vehicles v ON v.id = l."vehicleId"
ORDER BY l."submittedAt" DESC NULLS LAST LIMIT 5;

SELECT count(*) FROM listing_search;
```

| Step | `listings.status` | in `listing_search`? |
|---|---|---|
| Create a vehicle | — (no listing yet) | |
| Submit for review | | |
| Admin requests changes | | |
| Resubmit | | |
| Admin approves | | |
| Dealer withdraws | | |

Fill that table in from what you observe. **The right-hand column is Rule 6 in
action.**

### 4.4 Watch a whole dealership disappear and come back

```sql
SELECT count(*) FROM listing_search;
```

Suspend the dealership from the admin console. Wait a few seconds (the job is
asynchronous — that is Day 14), then:

```sql
SELECT count(*) FROM listing_search;
```

The count dropped by exactly that dealer's approved listings. Reinstate them and
watch it come back — **without re-approving a single listing.**

Read §12.6. One job, `search.reindex-dealer`, did that. Now imagine the
alternative: `AND dealer.status = 'ACTIVE'` repeated in nine different queries,
one of which someone forgets. That is the argument for evaluating a rule once.

### 4.5 Prove the counts are derived

```bash
grep -rn "listing_search" apps/api/src/modules/search/search.repository.ts | head -20
```

Find the per-city counts, the body-type tiles, the facet counts and the "from ₹x"
figure. **All of them come from `listing_search`.** So a listing that should not
be public cannot leak into a *number* either — not just not into a list. That is
a subtler property than it first appears, and it is why Rule 6 says counts must
follow the same rule.

### 4.6 Check Rule 7 while you are here

```bash
curl -s http://localhost:4000/v1/vehicles | jq '.data[0]' | grep -i phone
```

Nothing. A dealer's phone number is never in an ordinary public response. It
comes only from `POST /v1/vehicles/:id/reveal-contact`, which is rate-limited per
IP and per dealer — because the phone number is the product, and it is what
competitors want to scrape.

```sql
SELECT ip, count(*) FROM phone_reveals GROUP BY ip ORDER BY count DESC LIMIT 5;
```

### 4.7 Run both suites

```bash
pnpm --filter @dealers-drive/api test -- listing-lifecycle
pnpm --filter @dealers-drive/api test -- public-visibility
```

Read them. `listing-lifecycle.test.ts` asserts every **illegal** transition is
refused, which is the half people forget to test.

---

## 5. Prove you understood it

1. What is the difference between a `Vehicle` and a `Listing`? → *§11.1*
2. Why is `listing.status = 'APPROVED'` dangerous? Name four things it skips. → *§11.3*
3. What are the two parts of the two-part defence? → *§11.4*
4. State the public visibility rule exactly. → *§12.1*
5. Why is that rule evaluated in one place rather than in every query? → *§12.3*
6. What is `listing_search`, and what keeps it correct? → *§12.4, §12.5*
7. Why does suspending a dealer take one job rather than nine query changes? → *§12.6*
8. Why must marketplace counts also come from `listing_search`? → *Rule 6, §12.4*
9. What is `displayStatus`, and why is it derived rather than stored? → *§11.6*
10. Where may a dealer's phone number appear, and what protects it? → *Rule 7, §12.7*

---

## 6. Traps

- **`listing_search` is eventually consistent.** Approval enqueues a job; the row
  appears a moment later. That is by design, and Day 20 shows it is also what
  makes a read replica safe here.
- **`index()` is idempotent** because delivery is at-least-once (Day 14). It
  rebuilds the row from scratch and assumes it will run twice.
- **Never hard-code a count.** Rule 6.
- **A withdrawn listing is not a deleted vehicle.** Withdrawing removes the
  listing from the market; the vehicle and its photos remain.

---

## 7. Deliverable

- [ ] I drew the full state machine and checked it against §11.2
- [ ] I listed everything `transition()` does besides setting the status
- [ ] I tried to set `APPROVED` with a null expiry and was refused by the database
- [ ] I filled in the six-step lifecycle table from live observation
- [ ] I suspended and reinstated a dealership and watched `listing_search` follow
- [ ] I confirmed every public count derives from `listing_search`
- [ ] I confirmed no phone number appears in a public response
- [ ] I have answered all ten questions in §5

---

## 8. Going deeper (optional)

- Read **Part 24, Journey 5 and Journey 6** — a dealer submits, an admin
  approves. They are the same flow you walked today, written as a trace.
- Read **Part 24, Journey 7** — a dealer is suspended. Then read §12.6 again.
  Together they are the clearest argument in the whole document for evaluating a
  rule once.
