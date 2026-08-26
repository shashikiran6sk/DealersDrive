# Day 17 — Contracts, OpenAPI and error handling

> **Track:** Week 4 · The surface, and running it
> **Time:** ~3.5 hours · **Prerequisite:** Day 16
> **Goal in one sentence:** explain why `.strict()` is a security control rather
> than a style choice, and why the API reference cannot drift from the code.

---

## 1. Why today matters

TypeScript types **vanish at runtime**. `req.body as CreateVehicleInput` is a
lie you tell the compiler; the actual bytes arriving over the network are
whatever the caller sent.

Zod is the bridge: one schema that is both a *runtime validator* and a *compile-
time type*. And because that schema lives in `packages/contracts`, the API and
the web app cannot disagree about a shape — Day 2's whole argument for the
monorepo.

Then two consequences:

- **`.strict()`** — four characters that turn "ignore unknown fields" into
  "reject them". You met this on Day 10 when it blocked a smuggled `dealerId`.
  It is Rule 2, and it defends Rule 1.
- **The OpenAPI document is generated from those same schemas**, so the published
  reference cannot drift from what the code accepts.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 16** — Zod contracts (16.1 → 16.7) | 40 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 17** — OpenAPI and Postman (17.1 → 17.7) | 25 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 20** — error handling (20.1 → 20.6) | 35 |
| `docs/CLAUDE.md` | Rule 2, §19 (error handling), §21 (API rules) | 10 |
| [RFC 9457](https://datatracker.ietf.org/doc/html/rfc9457) | §3 — the members of a problem object | 10 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `packages/contracts/src/index.ts` | The public surface. Six files feed it |
| 2 | `packages/contracts/src/common.ts` | The primitives — pagination, ids, money, phone. Reused everywhere |
| 3 | `packages/contracts/src/public.ts` | `VehicleQuery`, `VehicleDto`. Find `.strict()` |
| 4 | `packages/contracts/src/dealer.ts` | The write inputs. **Confirm no schema anywhere accepts a `dealerId`** |
| 5 | `apps/api/src/middleware/validate.ts` | Where a schema meets a request. How a Zod issue becomes a 422 with `body.fieldName` |
| 6 | `apps/api/src/platform/errors.ts` | The error vocabulary: `DomainError`, `ConflictError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `RateLimitError`, `ConfigurationError` |
| 7 | `apps/api/src/middleware/error-handler.ts` | Every error becomes `application/problem+json`. **Find what it refuses to leak** |
| 8 | `apps/api/src/docs/openapi.ts` | Zod schemas → an OpenAPI document, at runtime |
| 9 | `apps/api/src/docs/spec.ts` | The per-module docs structure |
| 10 | `apps/api/tests/openapi.test.ts` | **The test that makes it real** — every route must appear in the document |
| 11 | `apps/web/src/lib/api.ts` | `ApiError.fieldErrors()` — how `body.pricePaise` becomes a message under the right form field |

---

## 4. Do

### 4.1 Feel why TypeScript is not enough

```bash
curl -s -X POST http://localhost:4000/v1/enquiries \
  -H 'Content-Type: application/json' \
  -d '{"name": 12345, "phone": true}' | jq
```

TypeScript compiled fine. The *runtime* rejected it, with per-field errors,
because Zod actually inspected the bytes. Read §16.1 for the framing.

### 4.2 Prove `.strict()` is a security control

```bash
# an unknown field
curl -s -X POST http://localhost:4000/v1/enquiries \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","phone":"9876543210","vehicleId":"<id>","dealerId":"x"}' \
  | jq '.errors'
```

Rejected before any handler runs. Now read §16.5's two failure modes:

- **Failure mode A (security):** a mass-assignment style attack, where an extra
  field silently reaches a write.
- **Failure mode B (client bug):** a typo'd field name that is silently ignored,
  so the client thinks it saved something it did not.

`.strict()` catches both. **Four characters.**

### 4.3 Change a contract and let the compiler find the call sites

In `packages/contracts/src/public.ts`, rename a field on `VehicleDto`. Then:

```bash
pnpm typecheck
```

TypeScript names **every** file that must change, in both apps. That is the
monorepo argument (Day 2) paying off concretely. Revert:

```bash
git checkout packages/contracts/src/public.ts
```

### 4.4 Read a problem document properly

```bash
curl -s "http://localhost:4000/v1/vehicles?limit=99999" | jq
```

Identify every RFC 9457 member: `type`, `title`, `status`, `detail`, `code`,
`errors[]`, `traceId`. Then answer:

- Why does the client branch on `code` rather than on `detail`? (`detail` is
  English prose written for a human; `code` is a stable machine contract.)
- Why does every problem carry a `traceId`? (Day 3.)

### 4.5 Get the status codes right

Trigger each and predict the code first:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/vehicles/not-a-uuid
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4000/v1/vehicles?limit=abc"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/dealer/vehicles
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4000/v1/nothing-here
```

Read §20.2, especially **400 vs 422** — the one people get wrong. 400 is
"this is not parseable"; 422 is "this parsed and is semantically wrong".

And re-read **404 vs 403** (§7.5, Day 10). That one is a security decision.

### 4.6 Confirm nothing leaks

Force an unexpected error — temporarily throw a raw `Error('secret internal
detail')` inside a service. Hit the endpoint and read the response.

It is a generic 500 problem document with a `traceId`. The message and stack are
in the **logs**, not the response. Read §20.4 and restore the file.

> `res.status(500).send("error")` is forbidden (`docs/CLAUDE.md` §19). So is
> leaking a stack trace.

### 4.7 The document that cannot drift

```bash
open http://localhost:4000/api/docs
```

Browse it. Then:

```bash
pnpm --filter @dealers-drive/api test -- openapi
```

Open `apps/api/tests/openapi.test.ts`. **Every route mounted in `routes.ts` must
appear in the generated document.** Adding an endpoint without documenting it
fails CI. That is what makes the reference trustworthy rather than aspirational.

Then generate the Postman collection:

```bash
pnpm --filter @dealers-drive/api docs:postman
ls docs/postman/
```

Same source, second output. Read §17.4 — everything derivable is derived.

### 4.8 Note where docs are off

```bash
grep -n "DOCS_ENABLED" apps/api/src/config/env.ts
```

On outside production, **off inside it**. The document lists every endpoint,
every permission and every error code — a useful map for a developer and an
equally useful one for anybody probing the live API.

---

## 5. Prove you understood it

1. Why is TypeScript alone insufficient at an API boundary? → *§16.1*
2. What does `.strict()` do, and what are the two failure modes it prevents? → *§16.5*
3. Why does `packages/contracts` exist as a shared package? → *§16.2, §30.1*
4. Where does coercion happen, and why only at the boundary? → *§16.6*
5. Name every member of an RFC 9457 problem document. → *§20.1*
6. Why does a client branch on `code` rather than `detail`? → *§20.6*
7. What is the difference between 400 and 422? → *§20.2*
8. Why is the OpenAPI document generated rather than hand-written? → *§17.5, §17.7*
9. What does `openapi.test.ts` prevent? → *§17.5*
10. Why is `DOCS_ENABLED=false` in production? → *`env.ts`*

---

## 6. Traps

- **`.strict()` rejects `undefined`.** An action with no input must send `{}`.
  Several endpoints declare an all-optional body and `.strict()` correctly
  refuses nothing at all.
- **Do not invent endpoints.** `docs/CLAUDE.md` §21: every endpoint must exist in
  `docs/API-SPEC.md`. If functionality has no spec, report it rather than
  silently inventing an API.
- **Never `res.status(500).send("error")`.** Throw a typed error and let the
  handler shape it.
- **Express 5 compiles mount paths**, so the coverage test has to work around it
  (`router-probe.ts`).

---

## 7. Deliverable

- [ ] I sent a wrong-typed body and read the per-field validation errors
- [ ] I proved `.strict()` rejects an unknown field, and can state both failure modes
- [ ] I renamed a contract field and let `pnpm typecheck` find every call site
- [ ] I identified every member of a problem document
- [ ] I triggered 400, 401, 404 and 422 and predicted each correctly
- [ ] I confirmed an unexpected error leaks nothing to the client
- [ ] I browsed `/api/docs`, ran `openapi.test.ts`, and generated the Postman collection
- [ ] I have answered all ten questions in §5

---

## 8. Going deeper (optional)

- Read **§16.5's** "gotchas" — both recorded, both real.
- Read **Part 25.6** — "What happens if…" for the API: an unknown field, a
  malformed body, a body over 1 MB, an unexpected database error.
