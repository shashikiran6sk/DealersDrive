# Day 5 — Week 1 consolidation: trace a real buyer journey

> **Track:** Week 1 · Orientation
> **Time:** ~3.5 hours · **Prerequisite:** Days 1–4
> **Goal in one sentence:** follow one public request from the browser URL all
> the way to SQL and back to rendered HTML, unaided, and make your first change.

---

## 1. Why today matters

Today has no new architecture. It is the day the first four days become one
picture, and the day you write code for the first time.

There is also a specific thing to notice: the **public read path is completely
different from the write path**. A buyer's search does not join five tables — it
reads one denormalized table called `listing_search`. You are not expected to
understand *why* today (that is Day 13). You are expected to *see* it, so that
Day 13 lands on something you have already met.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 24, Journey 1** — A buyer searches for a car | 25 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 18.3, 18.4** — a public page in full, and why they are server-rendered | 25 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 12.1, 12.2** — the one visibility rule and its truth table | 15 |
| `docs/API-SPEC.md` | the `GET /v1/vehicles` section only | 15 |

---

## 3. Open these files, in this order

This is one request, top to bottom, across both applications.

| # | File | What to look for |
|---|---|---|
| 1 | `apps/web/src/app/(public)/cars/page.tsx` | A Server Component. It reads `searchParams` and `await`s data. **There is no `useEffect`, no loading spinner, no client fetch** |
| 2 | `apps/web/src/lib/api.ts` | `apiGet` — how the Next server calls the API. Note the caching logic and *why the session cookie is only forwarded on uncached requests* |
| 3 | `apps/api/src/modules/search/search.routes.ts` | The endpoint that answers |
| 4 | `packages/contracts/src/public.ts` | Find `VehicleQuery`. This is the shape both sides agree on |
| 5 | `apps/api/src/modules/search/search.service.ts` | The orchestration. Still no `req`/`res` |
| 6 | `apps/api/src/modules/search/search.repository.ts` | **The interesting one.** Read the file's opening comment about `listing_search` |
| 7 | `apps/api/src/modules/search/search.mapper.ts` | Database row → API DTO. The boundary where `BigInt` paise become numbers |
| 8 | `apps/web/src/components/vehicle/vehicle-card.tsx` | Where the DTO becomes pixels |
| 9 | `apps/api/src/platform/media/urls.ts` | How an image URL is built. Note it is by **media id and width**, never by storage key |

---

## 4. Do

### 4.1 Watch the same query at four layers

**Layer 1 — the browser.** Open http://localhost:3000/cars?city=vellore. Note
that the filters are in the URL.

**Layer 2 — the API.**
```bash
curl -s "http://localhost:4000/v1/vehicles?city=vellore&limit=3" | jq '.data[0]'
```

**Layer 3 — the SQL.** Set `LOG_LEVEL=debug` in `.env` and restart, or open a
`psql` session and run the query yourself:
```bash
docker compose exec postgres psql -U dealersdrive -d dealersdrive
```
```sql
SELECT listing_id, title, price_paise, city_slug, dealer_name
FROM listing_search
WHERE city_slug = 'vellore'
ORDER BY price_paise
LIMIT 3;
```

**Layer 4 — the plan.**
```sql
EXPLAIN ANALYZE
SELECT * FROM listing_search WHERE city_slug = 'vellore' ORDER BY price_paise LIMIT 3;
```
Look for `Index Scan using listing_search_city_price`. That index exists
*because* this query exists. Day 11 explains how to read the rest of the plan.

### 4.2 Prove the visibility rule with your own hands

```sql
-- how many cars are publicly visible?
SELECT count(*) FROM listing_search;

-- how many listings exist in total?
SELECT status, count(*) FROM listings GROUP BY status;
```

The second number is larger. **Only `APPROVED` listings belonging to `ACTIVE`
dealers are in `listing_search`** — that single rule is the entire public
visibility model, and it is why no count in the product is ever hard-coded.

### 4.3 Watch a car disappear

In the admin console (`AUTH_MODE=dev` gives you an admin too — see
`DEV_ADMIN_EMAIL`), suspend a dealership. Then re-run:

```sql
SELECT count(*) FROM listing_search;
```

The count dropped, and that dealer's cars are gone from the public site. **One
job did that.** Do not chase how yet — Day 13.

### 4.4 Make your first change

A small, real, reviewable change. Pick one:

**Option A — add a field to a public response.**
`listing_search` already carries `owner_number`. Surface it on the vehicle card.
You will touch: `packages/contracts/src/public.ts` (the DTO),
`search.mapper.ts` (the mapping), `vehicle-card.tsx` (the render). Run
`pnpm typecheck` after the contract change and watch TypeScript tell you exactly
which files still need updating. **That is the whole point of the contracts
package.**

**Option B — add a sort option.**
Add "newest first" to the search toolbar, wired through `VehicleQuery` and the
repository's `ORDER BY`.

Then:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### 4.5 Write the trace out

In your own words, on one page, write the full path of
`GET /cars?city=vellore&fuel=petrol`:

```
browser → Next server (RSC) → apiGet → Express → validate → service →
repository → SQL on listing_search → rows → mapper → DTO → JSON →
back to the Next server → React renders → HTML to the browser
```

Name the **file** at every arrow. If you cannot name one, that is today's
re-read.

---

## 5. Prove you understood it — Week 1 checkpoint

> **Say this out loud, to another person, without notes:**
> *"A buyer opens `/cars?city=vellore`. Describe everything that happens, from
> DNS to the rendered HTML."*

Supporting questions:

1. Why is the search page a Server Component rather than a client component with
   `useEffect`? → *Part 18.4*
2. Why are the filters in the URL rather than in React state? → *Part 18.4*
3. Why does the public read path query `listing_search` instead of joining
   `listings`, `vehicles`, `dealers` and `cities`? → *Part 12.5*
4. What are the exact conditions for a car to be publicly visible? → *Part 12.1*
5. Why does `lib/api.ts` refuse to attach the session cookie to a *cached*
   request? → *`lib/api.ts` doc comment* — **this one is a data-breach question,
   not a performance one**
6. Where does a price stop being `BigInt` paise and become a formatted string? → *`search.mapper.ts`*
7. Why is an image URL built from a media id and a width rather than a storage
   key? → *`platform/media/urls.ts`*

---

## 6. Traps

- **`.strict()` rejects `undefined`.** An action with no input must send `{}`,
  not nothing. `lib/api.ts` defaults non-DELETE bodies to `{}` for exactly this
  reason. Bypassing it silently 400s — and once made admin *Approve* do nothing.
- **Never hard-code a marketplace count.** Rule 6. Every count is derived from
  `listing_search`.
- **Tailwind v4 arbitrary values** are `bg-(--var)`, not the v3 `bg-[--var]`.
  The old form compiles silently and emits invalid CSS.

---

## 7. Deliverable

- [ ] I observed the same query at all four layers: URL, API, SQL, query plan
- [ ] I proved the visibility rule with two SQL counts
- [ ] I suspended a dealer and watched their cars leave `listing_search`
- [ ] I made a real change end to end and all four commands pass
- [ ] I wrote the full request trace naming a file at every arrow
- [ ] **I answered the Week 1 checkpoint question out loud**

---

## 8. Going deeper (optional)

- Read **Part 27 — Code reading guide**, the "Day 1" and "Day 2–3" sections. It
  is a second opinion on the same material and names the five files to know by
  heart.
- Open `apps/api/tests/public-visibility.test.ts`. Every claim you proved by hand
  in §4.2 is asserted there. Reading a test as documentation is a habit worth
  forming now.
