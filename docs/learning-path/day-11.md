# Day 11 — PostgreSQL from a MERN brain

> **Track:** Week 3 · The domain
> **Time:** ~4 hours · **Prerequisite:** Week 2
> **Goal in one sentence:** read `schema.prisma` and defend every constraint in
> it, and explain why an application-level check is a suggestion under concurrency.

---

## 1. Why today matters

If your database experience is MongoDB, today is a genuine mindset shift, and it
is the one that unlocks Weeks 3 and 4.

The sentence to carry away:

> **The database is where invariants live; the application is where policy
> lives.**

An invariant is something that must be true of the data no matter what code runs
— *a credit balance is never negative*, *a vehicle never has two live listings*.
If that lives only in a `if (balance < 0) throw` in your service, then two
concurrent requests can both pass the check and both write. **An application
check is a suggestion under concurrency.** A `CHECK` constraint is not.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 9** — all of it (9.1 → 9.5) | 60 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-C1 → C4** — ACID, row locking, indexes, denormalization | 25 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 1.6** — why PostgreSQL, and why not MongoDB (re-read now) | 15 |
| [PostgreSQL — MVCC](https://www.postgresql.org/docs/current/mvcc.html) | §13.1–13.3 | 20 |
| [Use The Index, Luke](https://use-the-index-luke.com/) | Chapter 1 and 2 | 30 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `apps/api/prisma/schema.prisma` | Read it **top to bottom**, slowly. ~830 lines. Note the comment at the top: money is `BigInt` paise everywhere, and every dealer-owned table carries `dealerId` as a first-class column |
| 2 | `apps/api/prisma/migrations/20260816183407_init/migration.sql` | The generated SQL. Compare it to the Prisma model you just read |
| 3 | `apps/api/prisma/migrations/20260816183500_search_and_invariants/migration.sql` | **The most interesting file today.** The `listing_search` table, ten indexes, and five `CHECK` constraints |
| 4 | `apps/api/prisma/migrations/20260816200000_credit_ledger_sequence/migration.sql` | A `BIGSERIAL` added for ordering. Day 12 explains why `createdAt` was not enough |
| 5 | `apps/api/src/platform/db/prisma.ts` | One client per process. Rule 2: only `*.repository.ts` imports this |
| 6 | `apps/api/src/platform/db/tenant-tx.ts` | `withTransaction` and `withTenant` |

---

## 4. Do

Open a `psql` session and keep it open all day:

```bash
docker compose exec postgres psql -U dealersdrive -d dealersdrive
```

### 4.1 Look at the actual schema, not the model

```sql
\dt                       -- every table
\d+ dealers               -- columns, indexes, constraints, defaults
\d+ credit_transactions
\d+ listing_search
\di                       -- every index in the database
```

`\d+` on a table shows you what Prisma *produced*, which is what actually runs.
Get comfortable reading it.

### 4.2 Try to violate every invariant

This is the exercise that makes the lesson stick. Each of these **must fail**.

```sql
-- 1. a negative credit balance
UPDATE dealers SET "creditBalance" = -1 WHERE slug = 'sri-lakshmi-motors';

-- 2. a password hash on a non-admin
UPDATE users SET "passwordHash" = 'x' WHERE "isPlatformAdmin" = false LIMIT 1;

-- 3. an approved listing with no expiry
UPDATE listings SET status = 'APPROVED', "expiresAt" = NULL
WHERE id = (SELECT id FROM listings LIMIT 1);

-- 4. a foreign key that does not exist
INSERT INTO vehicles (id, "dealerId") VALUES (gen_random_uuid(), gen_random_uuid());

-- 5. a duplicate OAuth identity
INSERT INTO oauth_identities (id, "userId", provider, "providerSubject", email, "updatedAt")
SELECT gen_random_uuid(), "userId", provider, "providerSubject", email, now()
FROM oauth_identities LIMIT 1;
```

**Read each error message.** Then find the constraint that produced it:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conrelid = 'dealers'::regclass;
```

Write down, for each: *which of the nine rules does this constraint enforce?*

### 4.3 Feel a transaction

Open **two** `psql` sessions side by side.

**Session A:**
```sql
BEGIN;
UPDATE dealers SET "creditBalance" = "creditBalance" + 10 WHERE slug = 'sri-lakshmi-motors';
SELECT "creditBalance" FROM dealers WHERE slug = 'sri-lakshmi-motors';   -- sees +10
```

**Session B (do not commit A yet):**
```sql
-- sees the OLD value:
SELECT "creditBalance" FROM dealers WHERE slug = 'sri-lakshmi-motors';
```

That is **isolation**, implemented by MVCC: session B is reading a different row
*version*. Readers never block writers.

**Session A:**
```sql
ROLLBACK;
```

Gone entirely. That is **atomicity**.

### 4.4 Feel a row lock

**Session A:**
```sql
BEGIN;
SELECT "creditBalance" FROM dealers WHERE slug = 'sri-lakshmi-motors' FOR UPDATE;
```

**Session B:**
```sql
BEGIN;
SELECT "creditBalance" FROM dealers WHERE slug = 'sri-lakshmi-motors' FOR UPDATE;
-- ⟵ THIS HANGS
```

Session B is blocked until A commits or rolls back. **That hang is the feature.**
It is what makes "read the balance, decide, write the balance" safe under
concurrency. Day 12 is entirely about this.

```sql
-- Session A
COMMIT;      -- B now returns, with the post-commit value
```

### 4.5 Read a query plan

```sql
EXPLAIN ANALYZE
SELECT * FROM listing_search WHERE city_slug = 'vellore' ORDER BY price_paise LIMIT 24;
```

Look for `Index Scan using listing_search_city_price`.

Now defeat the index deliberately:

```sql
EXPLAIN ANALYZE
SELECT * FROM listing_search WHERE lower(city_slug) = 'vellore';
```

`Seq Scan` — because the index is on `city_slug`, not on `lower(city_slug)`.
**Wrapping an indexed column in a function throws away the index.** That single
mistake causes more production slowdowns than any other.

Then prove the leading-column rule:

```sql
EXPLAIN ANALYZE SELECT * FROM listing_search WHERE price_paise < 500000000;
```

The composite `(city_slug, price_paise)` index does not serve this — the leading
column is unconstrained.

### 4.6 See the full-text and trigram indexes

```sql
SELECT title, ts_rank(search_doc, plainto_tsquery('simple', 'swift')) AS rank
FROM listing_search
WHERE search_doc @@ plainto_tsquery('simple', 'swift')
ORDER BY rank DESC LIMIT 5;
```

Then read the `search_doc` definition in the migration: a **generated column**,
maintained by Postgres itself, with `setweight` giving make and model more weight
than dealer name. Nothing in the application maintains it.

### 4.7 Write a migration, read it, throw it away

```bash
# edit apps/api/prisma/schema.prisma — add an optional field to Vehicle, e.g. `notes String?`
pnpm --filter @dealers-drive/api db:migrate
```

**Read the generated SQL before anything else.** It is what will run in
production one day. Note that it is `ADD COLUMN … NULL` — additive, and safe
against currently-running code. That is *expand*, and Day 20 explains why it
matters.

Then throw it away:
```bash
git checkout apps/api/prisma/schema.prisma
rm -rf apps/api/prisma/migrations/*_<your_migration_name>
pnpm --filter @dealers-drive/api db:reset
```

---

## 5. Prove you understood it

1. What is an invariant, and why must it live in the database? → *§9.2*
2. Name the four ACID properties and give a concrete example of each from this
   schema. → *§34-C1*
3. What does MVCC give you that locking every read would not? → *§34-C1*
4. What does `SELECT … FOR UPDATE` do, and what does it protect? → *§9.3, §34-C2*
5. Why is money `BigInt` paise and never a float? → *§9.5, Rule 3*
6. Why does `(city_slug, price_paise)` not serve a query filtering only on price? → *§34-C3*
7. What is a partial unique index, and where is one used here? → *§9.3*
8. What is a denormalized read model, and what maintains `listing_search`? → *§9.3, §34-C4*
9. Name three constraints in this schema and say which of the nine rules each
   enforces.

---

## 6. Traps

- **A function on an indexed column discards the index.** `lower(col) = …`,
  `col::text = …`, `date(col) = …`. Use an expression index or restructure.
- **`prisma migrate dev` is for laptops only.** It can offer to reset the
  database. `migrate deploy` is what runs anywhere else — Day 20.
- **Migrations are immutable once merged.** Prisma checksums them; editing one
  that has already run makes that environment un-migratable.
- **`BigInt` has no JSON representation.** `installBigIntJson()` exists so an
  accidental serialisation produces a clear error path rather than a cryptic
  throw from inside Express. Mappers convert explicitly with `Number()`.

---

## 7. Deliverable

- [ ] I read `schema.prisma` end to end
- [ ] I tried to violate five invariants and read every error
- [ ] I ran two `psql` sessions and observed isolation, rollback and a row lock hanging
- [ ] I read a query plan, then defeated an index deliberately and saw `Seq Scan`
- [ ] I ran a full-text search and found the generated `search_doc` column
- [ ] I generated a migration, read its SQL, and reverted it
- [ ] I have answered all nine questions in §5

---

## 8. Going deeper (optional)

- Finish [Use The Index, Luke](https://use-the-index-luke.com/) chapters 3 and 4.
  Indexing stops being mysterious after about four hours of this, permanently.
- `\d+ listing_search` and count its indexes. For each one, find the search
  filter in the UI that it serves. Every index in that table exists for a
  specific screen.
