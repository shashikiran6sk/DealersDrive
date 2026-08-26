# Day 20 — Database operations, scaling and observability

> **Track:** Week 4 · The surface, and running it
> **Time:** ~4 hours · **Prerequisite:** Day 19
> **Goal in one sentence:** name the first bottleneck this system will hit, say
> exactly what to change, and explain where AWS's responsibility ends and yours
> begins.

---

## 1. Why today matters

This is the last day, and it is the one that changes how you think rather than
what you know.

Three ideas, and everything else follows:

1. **AWS keeps the database running. You keep the data correct.** A managed
   service removes the *operational* failure modes and **none** of the
   *application* ones.
2. **Find the bottleneck before adding capacity.** Adding API tasks when the
   database is saturated makes it *worse*, because each task brings its own
   connection pool.
3. **Stateless scales; stateful does not.** Two pieces of per-instance state are
   the entire reason `dd-api-prod` runs one task, and removing them is the whole
   near-term scaling story.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 32** — all of it (32.1 → 32.10) | 50 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 33** — all of it (33.1 → 33.11) | 65 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 21** — observability (21.1 → 21.8) | 25 |
| `docs/DEPLOYMENT.md` | §K (Rollback), §L (Cost), Monitoring, Security | 25 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `deploy/aws/README.md` | §4 (Databases). Every `create-db-instance` flag is a decision — especially `--backup-retention-period 7`, which is what **enables PITR at all** |
| 2 | `deploy/aws/README.md` | §9 (ECS). Read the note on `desired-count`: 1 for the API, **capped by `WORKER_INLINE=true`** |
| 3 | `apps/api/src/config/env.ts` | `WORKER_INLINE`, `WORKER`, `JOBS_ENABLED`, `RATE_LIMIT_ENABLED` |
| 4 | `apps/api/src/container.ts` | `startBackground()` — the `WORKER_INLINE` branch, and what would move to a worker entrypoint |
| 5 | `apps/api/src/middleware/rate-limit.ts` | **A process-local `Map`.** The second piece of per-instance state |
| 6 | `apps/api/src/platform/db/prisma.ts` | One client, one pool, per process |
| 7 | `apps/api/src/platform/media/urls.ts` + `deploy/aws/env.production.example` | `MEDIA_BASE_URL`. **The bottleneck you found on Day 15** |
| 8 | `apps/api/src/modules/health/health.routes.ts` | `/health/ready` — what it checks and what it reports |
| 9 | `apps/api/src/platform/telemetry/logger.ts` | Structured JSON, and what is redacted |
| 10 | `apps/api/src/modules/search/search.repository.ts` | The read model — already a separate read path, which is why a replica is a routing change |

---

## 4. Do

### 4.1 Fill in the shared-responsibility table from memory

Then check against §32.1.

| Concern | AWS | You |
|---|---|---|
| Host OS patching | | |
| PostgreSQL minor version patching | | |
| Daily snapshots + WAL archiving | | |
| **Backup retention period** | | |
| **Deciding when to restore** | | |
| Multi-AZ failover | | |
| **Schema and migrations** | | |
| **Indexes and query performance** | | |
| **Connection budget** | | |
| **Testing that a backup actually restores** | | |

The last row is the one people get wrong. **An untested backup is a hope, not a
backup.**

### 4.2 Practise expand/contract on paper

You must ship a rename: `vehicles.price_paise` → `vehicles.asking_price_paise`.

Write the three releases:

```
EXPAND    release N     …
MIGRATE   release N     …
CONTRACT  release N+2   …
```

Now answer: **why can this not be one migration?** (During a rolling deploy both
versions are live, and `_deploy.yml` runs migrations *before* the new tasks take
traffic — so the old code runs against the new schema for a minute or two.)

Then: **why is expand/contract the precondition for "redeploy the old image"
being a complete rollback?** (§32.5, §31.7.)

### 4.3 Learn the two Prisma commands cold

| | `migrate dev` | `migrate deploy` |
|---|---|---|
| Where | | |
| Generates a migration? | | |
| Can it drop data? | | |
| Runs as | | |

Then the seeding pair, which is the more dangerous confusion:

```bash
grep -n -A12 "Production bootstrap" apps/api/prisma/seed/bootstrap.ts | head -20
```

> **`db:seed` truncates every application table.** Correct on a laptop,
> catastrophic anywhere a dealer has signed in. `db:bootstrap` is
> create-if-missing and never overwrites.

### 4.4 Do the connection arithmetic

From §32.8 and §33.5:

```
total = (API tasks × pool) + (worker tasks × pool) + pg-boss + migrations + humans
        must stay under max_connections
```

Check it locally:

```sql
SHOW max_connections;
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
```

Now compute: at Prisma's default pool on a 4-vCPU task, **how many API tasks
before you exhaust a `db.t4g.small`?** (§33.5 has the table.) Then answer: what
does that failure look like, and why is it especially nasty? (It arrives under
load, on *new* connections, while existing ones keep working — so the error rate
climbs but the health check may still pass.)

Finally, note the caveat you must know *before* you need it: transaction-mode
pooling breaks session-level state. `withTenant()` uses `SET LOCAL`, which is
transaction-scoped and therefore compatible — but plain `SET`, session advisory
locks and `LISTEN`/`NOTIFY` are not, and pg-boss wants a direct connection.

### 4.5 Find the bottleneck yourself

Do not read §33.3 first. Work it out:

```bash
grep -n "MEDIA_BASE_URL" deploy/aws/env.production.example
```

`https://www.dealers-drive.com/media` — that is **the API**. Now trace what a
single search page costs:

- 24 result cards
- each with a `srcset` of 4 widths
- each image request → ALB → Node process → `storage.get()` → R2 → back through
  the Node process → back through the ALB

**Uploads already go direct to R2.** Reads do not. Now read §33.3 and confirm,
and note that the DNS record is already reserved (`deploy/aws/README.md` §10) and
that `urls.ts` builds every image URL from that one variable.

**One environment variable. It is item 1 of the roadmap for a reason.**

### 4.6 Find the two pieces of per-instance state

```bash
grep -n "const buckets" apps/api/src/middleware/rate-limit.ts
grep -n -A8 "if (!env.JOBS_ENABLED) return" apps/api/src/container.ts
```

For each, answer: **what breaks if we run two API tasks?**

- The rate limiter: N tasks = N× the effective limit, and a restart clears it.
  These limits are a *spend control* — every phone-reveal SMS costs money — so
  N× is not a rounding error.
- `WORKER_INLINE=true`: every scheduled job runs N times. The expiry sweep twice,
  `counters.reconcile` twice, orphan-media GC twice.

Then write the fix for each (§33.2 items 1 and 2).

### 4.7 Walk the growth stages

Without looking, sketch what changes at each stage. Then check §33.2.

| Users | What is the constraint? | What changes? |
|---|---|---|
| 10 | | |
| 1,000 | | |
| 10,000 | | |
| 100,000+ | | |

### 4.8 Reason about the read replica

`listing_search` is queried by a **separate repository**. So routing it to a
replica is a second Prisma client injected at the composition root — not a
rewrite. That is Day 13's CQRS separation paying off.

Now the important half: **what must never go to a replica?**

- anything inside a write transaction
- anything using `SELECT … FOR UPDATE` (the credit ledger)
- **the session lookup** — a session revoked a moment ago must stop working
  *now*, not after replication catches up

And the reason lag is tolerable for search: the public read path is *already*
asynchronously decoupled — a listing becomes visible via a background job after
approval (Day 14). Milliseconds of replica lag are invisible against a job
latency measured in seconds. **The product's own semantics absorb it.**

### 4.9 Observability — what exists, and what does not

```bash
curl -s http://localhost:4000/health/ready | jq
```

Then be honest about the gaps. From Part 21 and Part 29.1:

| | Status |
|---|---|
| Structured logs with `traceId` | |
| `/health/live` + `/health/ready` | |
| Sentry | |
| Metrics / `/metrics` | |
| Log shipping | |
| Alerting | |

Then find the one **application-level** metric worth more than any infrastructure
dashboard here:

```sql
SELECT d.slug, d."creditBalance" AS cached,
       (SELECT ct."balanceAfter" FROM credit_transactions ct
        WHERE ct."dealerId" = d.id ORDER BY ct.seq DESC LIMIT 1) AS truth
FROM dealers d
WHERE d."creditBalance" <> COALESCE((SELECT ct."balanceAfter" FROM credit_transactions ct
        WHERE ct."dealerId" = d.id ORDER BY ct.seq DESC LIMIT 1), 0);
```

**Credit-ledger drift. Always zero.** Any non-zero row catches a write path that
bypassed `moveCredits()` — the single worst bug this system could have. The
nightly job computes it; nothing yet alerts on it.

### 4.10 Read a query plan one last time

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM listing_search
WHERE city_slug = 'vellore' AND price_paise BETWEEN 300000000 AND 800000000
ORDER BY price_paise LIMIT 24;
```

Confirm `Index Scan`. Then add a filter with no index and watch the plan change.
**This is the skill that stays useful for the rest of your career.**

---

## 5. Prove you understood it — Week 4 checkpoint (part 2)

1. State the shared-responsibility split in one sentence. → *§32.1*
2. Which single RDS flag enables point-in-time recovery? → *§32.2*
3. Describe the correct PITR procedure, and the wrong one people reach for. → *§32.7*
4. What is *not* covered by an RDS snapshot? → *§32.6*
5. What is expand/contract, and why is it the precondition for application
   rollback? → *§32.5*
6. Why is `db:seed` forbidden on any deployed environment? → *§32.4*
7. Why does adding API tasks make a database problem worse? → *§33.5*
8. Vertical vs horizontal scaling — and why does Node's event loop make the
   distinction sharper? → *§33.4*
9. What is the first bottleneck this system will hit, and what is the fix? → *§33.3*
10. Name the two pieces of per-instance state and their fixes. → *§33.2*
11. When is a read replica safe here, and what must never use one? → *§33.6*
12. What is credit-ledger drift, and what would a non-zero value prove? → *§32.9*
13. What is the accepted RTO for region loss, and why is that acceptable? → *§32.7*

---

## 6. Traps

- **`CREATE INDEX` without `CONCURRENTLY`** blocks every write to that table for
  the duration.
- **A migration without `lock_timeout`** can queue behind a long query and then
  block everything behind *itself* — the site goes down while the migration is
  still "waiting".
- **`DROP COLUMN` is irreversible without a restore**, and a restore means losing
  every write since the restore point. On a marketplace those are enquiries a
  dealer has already been called about.
- **PITR rewinds only the database.** R2 objects, sent emails and SMS, and
  anything a dealer already acted on do not rewind with it.
- **Burstable instance classes (`t4g`) throttle hard when CPU credits run out.**
  Sustained high CPU on a `t4g` is a different problem from high CPU on an `m7g`.

---

## 7. Deliverable

- [ ] I filled in the shared-responsibility table before checking it
- [ ] I wrote the three releases for a column rename and explained why not one
- [ ] I can state the difference between `migrate dev`/`migrate deploy` and
      `db:seed`/`db:bootstrap`
- [ ] I did the connection arithmetic and know what exhaustion looks like
- [ ] **I found the `MEDIA_BASE_URL` bottleneck by reasoning, then confirmed it**
- [ ] I located both pieces of per-instance state and wrote the fix for each
- [ ] I sketched all four growth stages
- [ ] I ran the credit-ledger drift query
- [ ] I read one `EXPLAIN (ANALYZE, BUFFERS)` plan
- [ ] I have answered all thirteen questions in §5

---

## 8. You are done. Now what?

### The four checkpoint questions — answer all four, out loud, in one sitting

1. *"A buyer opens `/cars?city=vellore`. Describe everything that happens, from
   DNS to the rendered HTML."*
2. *"A dealer clicks Continue with Google. Describe every redirect, every cookie,
   and every check — and name what each check defends against."*
3. *"A dealer publishes a car. Describe every row written, every credit moved,
   every job queued, and the exact moment the car becomes publicly visible."*
4. *"I merged a PR. Describe everything that happens until the change is live in
   production — and what would happen if it were bad."*

### Then read the closing of the reference

`docs/ENGINEER-ONBOARDING.md` → **Closing**. Forty-odd questions with the section
named for each, and the eight sentences that carry the most weight. If any
question there is uncertain, that section is your next hour.

### Your first real contributions, in order of value

1. **`MEDIA_BASE_URL` → an R2 public domain or a CDN.** One variable, and it is
   the highest-leverage change available (§33.3).
2. **Wire the six CloudWatch alarms** specified in `docs/DEPLOYMENT.md`. Nothing
   watches anything today.
3. **The worker entrypoint** (§33.2 item 1). It unblocks horizontal scaling of
   the API, and it is roughly a day of work.
4. **Rehearse a PITR restore on dev.** Nobody has. An untested backup is a hope.
5. Pick something from **Part 29.1** and close it. Everything in that list is
   documented honestly, which means it is ready to be worked on.

### Keep going

- **Part 35** of the reference is a curated reading list with a suggested order.
  Start with *The Twelve-Factor App* (30 minutes) and *Use The Index, Luke*.
- **Designing Data-Intensive Applications** — chapters 5, 7 and 11 map directly
  onto this system. Over months, not this week.

---

*You now know this system better than most people know the one they work on.
The habit that got you here — never read a section without opening the file, and
never open a file without reading the section — is the habit worth keeping.*
