# Day 10 — Authorization, permissions, multi-tenancy and TOCTOU

> **Track:** Week 2 · Identity
> **Time:** ~4 hours · **Prerequisite:** Day 9
> **Goal in one sentence:** explain why `dealerId` never comes from a request,
> why cross-tenant access returns 404 rather than 403, and why every check runs
> twice.

---

## 1. Why today matters

Day 9 answered *who are you*. Today answers *what may you do*, and it is the
single most consequential area of the codebase: **broken access control is #1 in
the OWASP Top 10**, and multi-tenancy is where it usually breaks.

The rule you are being trained to never break is Rule 1:

> **`dealerId` always comes from the session. Never from a request body, query
> parameter or path.**

`GET /vehicles?dealerId=123` is not a feature with a bug in it. It is an
architecture that cannot be made safe, because the moment the identifier is
client-supplied, every single call site has to remember to validate it — and one
forgotten call site is a data breach.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 6** — authentication vs authorization (6.1 → 6.5) | 35 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 7** — multi-tenancy (7.1 → 7.8) | 45 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 8** — TOCTOU and double authorization | 30 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-B10, 34-F3** — multi-tenancy and race conditions, briefly | 10 |
| `docs/CLAUDE.md` | Rule 1, Rule 7, §23 (Security) | 10 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `apps/api/src/modules/auth/session.port.ts` | The `PERMISSIONS` and `ADMIN_PERMISSIONS` tables. Thirteen dealer permissions, ten admin ones, mapped to roles |
| 2 | `apps/api/src/middleware/auth.ts` | **The core file.** Read the opening comment: *the middleware order IS the security model*, then all four guards |
| 3 | `apps/api/src/middleware/auth.ts` | `dealerPrincipal()` — it **throws** if a route forgot its guard. A programmer error must never degrade into "no tenant filter" |
| 4 | `apps/api/src/routes.ts` | The three guard chains again, now with meaning |
| 5 | `apps/api/src/modules/vehicles/vehicles.routes.ts` | A real guarded route: `requirePermission('vehicle:write')`, then the handler reads `dealerPrincipal(req)` |
| 6 | `apps/api/src/modules/vehicles/vehicles.repository.ts` | **Every function takes `dealerId` first.** That signature convention is what makes an unscoped query hard to write by accident |
| 7 | `apps/api/src/platform/db/tenant-tx.ts` | `withTenant()` — `SET LOCAL app.dealer_id`, and `assertUuid()` guarding the one line in the codebase that concatenates SQL |
| 8 | `apps/api/src/modules/vehicles/vehicles.service.ts` | Find a write. Note the tenant predicate is **inside the `WHERE` clause of the write itself**, not a separate check before it |
| 9 | `apps/api/tests/tenant-isolation.test.ts` | The proof. Read what it asserts before running it |

---

## 4. Do

### 4.1 Prove `dealerId` cannot be supplied

```bash
# There is no dealerId parameter anywhere in the API. Confirm it:
grep -rn "dealerId" packages/contracts/src | grep -iE "input|query|param"
```

Now try to smuggle one in — with a valid dealer session:

```bash
curl -s -b "dd_session=<value>" \
  -X POST http://localhost:4000/v1/dealer/vehicles \
  -H 'Content-Type: application/json' \
  -d '{"dealerId":"00000000-0000-0000-0000-000000000000", "makeSlug":"maruti-suzuki"}' | jq
```

Rejected — and note **why**: `.strict()` on the Zod schema refuses the unknown
field before any handler runs. Rule 2 and Rule 1 defend each other.

### 4.2 Attempt a cross-tenant read

```sql
-- pick a vehicle belonging to a DIFFERENT dealer than the one you are signed in as
SELECT v.id, d.slug FROM vehicles v JOIN dealers d ON d.id = v."dealerId" LIMIT 10;
```

```bash
curl -s -b "dd_session=<value>" \
  http://localhost:4000/v1/dealer/vehicles/<another-dealers-vehicle-id> -i | head -3
```

**404, not 403.** Read Part 7.5 for why. A 403 says *"this exists and is not
yours"* — which turns the endpoint into an enumeration oracle. A 404 says
nothing at all.

Then try a random UUID. Same 404, indistinguishable. That is the property.

### 4.3 Find the tenant predicate in the write

Open a `delete` or `update` in `vehicles.service.ts` and find the shape:

```ts
await tx.vehicle.updateMany({ where: { id, dealerId, deletedAt: null }, data: { … } })
```

Note `dealerId` is in the `WHERE` of the write itself, not checked beforehand.
**Write down why that matters.** (If you check first and write second, something
can change in between — that is TOCTOU. Putting the predicate in the write makes
the check and the use the same operation.)

### 4.4 See both authorization checks fire

Pick an endpoint and trace which check happens where:

```
requireDealer          → is there a valid dealer session?           (401 if not)
requireDealerActive    → is the dealership ACTIVE?                  (403 DEALER_NOT_ACTIVE)
requirePermission(…)   → does this ROLE carry this capability?      (403)
… then, inside the transaction:
   the repository's WHERE clause                                    (404 if not yours)
```

Trigger each one:

```bash
# no session
curl -s -i http://localhost:4000/v1/dealer/vehicles | head -1

# valid session, suspended dealer  (suspend one in psql first)
UPDATE dealers SET status = 'SUSPENDED' WHERE slug = 'sri-lakshmi-motors';
```

Then attempt to publish a listing as that dealer and read the error code. Restore
the status afterwards.

### 4.5 Read the permission table as a matrix

From `session.port.ts`, fill this in for the four dealer roles:

| Permission | OWNER | MANAGER | SALES |
|---|---|---|---|
| `vehicle:read` | | | |
| `vehicle:write` | | | |
| `listing:submit` | | | |
| `billing:purchase` | | | |
| `dealer:update` | | | |
| `member:manage` | | | |

Then answer: **why is `billing:purchase` OWNER-only while `billing:read` is not?**

### 4.6 Run the isolation suite and read it as documentation

```bash
pnpm --filter @dealers-drive/api test -- tenant-isolation
```

Open `apps/api/tests/tenant-isolation.test.ts`. Every dealer-scoped operation
proves *Dealer A cannot reach Dealer B's data*. This file is the executable form
of Rule 1 — and adding a new dealer-scoped endpoint means adding a case here.

### 4.7 Understand the four-layer model, and where you actually are

Part 7.6 describes four layers of tenant defence. Establish which are live:

| Layer | Status | Evidence |
|---|---|---|
| 1. Session-derived context | | `middleware/auth.ts` |
| 2. Repository signatures | | `*.repository.ts` |
| 3. PostgreSQL row-level security | | look for `prisma/rls.sql` |
| 4. Tests | | `tenant-isolation.test.ts` |

```bash
ls apps/api/prisma/*.sql 2>/dev/null || echo "no rls.sql — layer 3 is NOT implemented"
```

`withTenant()` issues the `SET LOCAL` unconditionally so that turning RLS on
later is a *database* change rather than a code change. Part 29.1 records the
gap honestly.

---

## 5. Prove you understood it

1. State Rule 1 exactly, and give the concrete failure it prevents. → *§7.2, §7.3*
2. Where does `dealerId` enter a request, and can a client influence it? → *`middleware/auth.ts`*
3. Why 404 and not 403 across tenants? → *§7.5*
4. What is TOCTOU? Give the two-request example. → *§8.1, §8.2*
5. Name the five mechanisms that close the TOCTOU gap here. → *§8.3*
6. Why does `dealerPrincipal()` throw rather than return null? → *`middleware/auth.ts`*
7. Why can a non-`ACTIVE` dealer still read their console but not publish? → *`requireDealerActive`*
8. Which of the four tenancy layers is not implemented, and what stands in for
   it? → *§7.6, Part 29.1*
9. Why is the permission check never the *only* check? → *§8.4*

---

## 6. Traps

- **A DTO containing a client-provided `dealerId` is a bug**, even if the handler
  validates it. The correct fix is deleting the field, not adding a check.
- **`SET LOCAL` cannot be parameterised**, which is why `assertUuid()` exists.
  That is the one line in the codebase that concatenates SQL, and it is guarded.
- **The admin exception is real but narrow.** Admins legitimately cross tenants;
  read Part 7.7 for how that is scoped, and note every admin action is
  audit-logged.
- **"Check twice" is not redundancy.** Part 8.4 explains why. The guard answers
  *may you*; the write answers *is this yours*. They are different questions.

---

## 7. Deliverable

- [ ] I tried to smuggle a `dealerId` into a request and saw `.strict()` reject it
- [ ] I attempted a cross-tenant read and got a 404 indistinguishable from a random UUID
- [ ] I found a tenant predicate inside the `WHERE` clause of a write
- [ ] I triggered 401, 403 `DEALER_NOT_ACTIVE`, 403 permission, and 404 cross-tenant
- [ ] I filled in the role/permission matrix
- [ ] I ran and read `tenant-isolation.test.ts`
- [ ] I established which of the four tenancy layers is missing
- [ ] I have answered all nine questions in §5

---

## 8. Going deeper (optional)

- Read **Part 19** in full — the security architecture, thirteen sections. You
  now have the vocabulary for all of it.
- Read **Part 25.2** — "What happens if…" for authorization. Four concrete
  attacks and exactly what the system does with each.
- Read the [OWASP Top 10](https://owasp.org/www-project-top-ten/) entry for
  Broken Access Control and map each sub-case to a defence you saw today.
