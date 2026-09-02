# Day 3 — The request lifecycle, end to end

> **Track:** Week 1 · Orientation
> **Time:** ~4 hours · **Prerequisite:** Day 2
> **Goal in one sentence:** trace any HTTP request through every stage from
> `app.use()` to the response, and explain what breaks if you reorder them.

---

## 1. Why today matters

There is one sentence in `apps/api/src/server.ts` that you should be able to
quote by the end of today:

> **The middleware order IS the security model.**

That is not a slogan. Move `cookieParser()` after the routes and the session
resolver reads nothing, so every authenticated request 401s. Move the body parser
before `helmet` and you do work on requests you were about to reject. Move the
error handler anywhere but last and it stops catching.

Everything in Weeks 2 and 3 attaches to the skeleton you build today.

---

## 2. Read first

| Source                        | Sections                                                     | ~min |
| ----------------------------- | ------------------------------------------------------------ | ---- |
| `docs/ENGINEER-ONBOARDING.md` | **Part 3** — all of it (3.1 → 3.4)                           | 60   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 20.1 → 20.3** — Problem Details and the error handler | 20   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-A4** — HTTP: method, status, header, body          | 10   |

Pay particular attention to **§3.3** — the table of _what breaks if you move
things_. Read it twice.

---

## 3. Open these files, in this order

Read them in exactly this sequence. It is the sequence a request travels.

| #   | File                                            | What to look for                                                                                                                    |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/api/src/index.ts`                         | The process. `buildContainer` → `startBackground` → `createApp` → `listen`. Also the `SIGTERM` handler — you return to it on Day 19 |
| 2   | `apps/api/src/server.ts`                        | **The core file of today.** The numbered comment block is the whole lesson. Nine `app.use()` calls, in a deliberate order           |
| 3   | `apps/api/src/middleware/request-context.ts`    | Stage 1. Where `traceId` is born, and how it reaches every later log line                                                           |
| 4   | `apps/api/src/middleware/request-logger.ts`     | One structured JSON line per request. Note what is redacted                                                                         |
| 5   | `apps/api/src/routes.ts`                        | Stage 5. The four mount points and three guard chains                                                                               |
| 6   | `apps/api/src/middleware/auth.ts`               | Stages 10–15. `requireDealer`, `requireSignedIn`, `requireAdmin`, `requirePermission`                                               |
| 7   | `apps/api/src/middleware/validate.ts`           | Stage 17. How a Zod schema becomes a 422 with per-field errors                                                                      |
| 8   | `apps/api/src/modules/search/search.routes.ts`  | A real route. Note how thin the handler is                                                                                          |
| 9   | `apps/api/src/modules/search/search.service.ts` | Stage 19. **No `req`, no `res` anywhere in this file**                                                                              |
| 10  | `apps/api/src/middleware/not-found.ts`          | Stage 6. Unmatched routes become a `NotFoundError`, not a raw 404                                                                   |
| 11  | `apps/api/src/middleware/error-handler.ts`      | Stage 7. Last, always. Every error becomes RFC 9457 `application/problem+json`                                                      |
| 12  | `apps/api/src/platform/errors.ts`               | The error vocabulary the whole system throws                                                                                        |

> **The boundary to internalise today.** A _route_ touches `req` and `res`. A
> _service_ takes plain arguments and returns plain data. A _repository_ takes
> `dealerId` first and talks to Prisma. Nothing below the route layer knows HTTP
> exists — which is why services are testable without a server.

---

## 4. Do

### 4.1 Watch a request move

With `pnpm dev` running, in a second terminal:

```bash
curl -i http://localhost:4000/v1/vehicles
```

Now look at the API terminal. Find the log line for that request. Note the
`traceId`, the method, the path, the status, the duration.

### 4.2 Follow the trace id through a failure

```bash
curl -i "http://localhost:4000/v1/vehicles?nonsense=1"
```

Read the response body. It is `application/problem+json`:

```json
{
  "type": "...",
  "title": "...",
  "status": 422,
  "code": "...",
  "errors": [{ "field": "query.nonsense", "code": "...", "message": "..." }],
  "traceId": "..."
}
```

Copy that `traceId` and grep the API terminal for it. **Every log line for that
request carries it.** That is what `request-context.ts` bought you, and it is why
it is the _first_ middleware — even an error thrown by the body parser has a
trace id.

### 4.3 Hit each status code deliberately

```bash
curl -i http://localhost:4000/v1/nope                     # 404 — not-found middleware
curl -i http://localhost:4000/v1/dealer/vehicles          # 401 — no session
curl -i "http://localhost:4000/v1/vehicles?limit=9999"    # 422 — validation
curl -i http://localhost:4000/health/ready                # 200 — with version + checks
```

For each one, **name the middleware that produced it** before you check.

### 4.4 Break the order on purpose

In `apps/api/src/server.ts`, move `app.use(errorHandler)` to _above_
`app.use(createRoutes(container))`. Restart, then trigger the 422 from §4.2 again
and watch it become an unhandled error page instead of `problem+json`.

Then try moving `app.use(cookieParser())` to _after_ the routes, and observe what
happens to an authenticated request.

```bash
git checkout apps/api/src/server.ts     # restore. Do not commit either change.
```

The point is to _feel_ why the comment block exists rather than take it on trust.

### 4.5 Trace one request by hand, in writing

Pick `GET /v1/vehicles?city=vellore`. In a scratch file, write the sequence:

```
1. express receives the request
2. requestContext        → traceId assigned, AsyncLocalStorage entered
3. helmet                → security headers set
4. cors                  → origin checked against env.webOrigins
5. express.json          → (no body on a GET)
6. cookieParser          → req.cookies populated
7. requestLogger         → start time recorded
8. routes.ts             → matches the public /v1 router
9. search.routes.ts      → validate({ query: VehicleQuery })
10. …
```

Continue to the response. **Then check it against Part 3.1's list of 19 stages.**
Anything you missed is the thing to re-read.

---

## 5. Prove you understood it

1. Why is `requestContext` the _first_ middleware and not the third? → _§3.2, Stage 4_
2. Why are `helmet` and `cors` before the body parsers? → _§3.2, Stage 6–7_
3. Why is the body parser given a `1mb` limit? → _§3.2, Stage 7_
4. What happens to a request that matches no route? → _`not-found.ts`_
5. Why must the error handler be registered **last**? → _§3.2, Stage 20–21_
6. What is `traceId` for, and where is it created? → _`request-context.ts`_
7. Why does no `*.service.ts` file import `express`? → _§3.2, Stage 19_
8. How does the guard chain on `/v1/dealer/*` differ from the one on
   `/v1/auth/*`? → _`routes.ts`, top comment_

---

## 6. Traps

- **Express 5 compiles mount paths** into matcher functions and does not keep the
  string, so the full path cannot be recovered from the router tree. The OpenAPI
  coverage test works around this — see `CONTEXT.md` §9.
- **Two routers on one prefix.** `/v1/auth` is mounted twice, in a specific
  order: the public router first (sign-in cannot require being signed in), then
  the guarded one. **Swapping those two lines would leave `/onboarding` open.**
- **`res.json()` after the response has started streaming** is an error the
  handler cannot fix. See Part 25.6.

---

## 7. Deliverable

- [ ] I can list the middleware in `server.ts` in order, from memory
- [ ] I triggered a 200, 401, 404 and 422 and named the middleware behind each
- [ ] I followed one `traceId` across every log line of one request
- [ ] I broke the middleware order, observed the failure, and restored it
- [ ] I wrote out the full trace of one request and checked it against Part 3.1
- [ ] I can state the route / service / repository boundary in one sentence each
- [ ] I have answered all eight questions in §5

---

## 8. Going deeper (optional)

- Read **Part 20** in full — the error vocabulary, and the 400-vs-422 and
  404-vs-403 distinctions. The 404-vs-403 one is a security decision and returns
  on Day 10.
- Open `apps/api/tests/unit/server.test.ts` and see the middleware order asserted
  as a test rather than trusted as a convention.
