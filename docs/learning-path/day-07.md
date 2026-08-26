# Day 7 — Cookies, tokens and sessions: the three people confuse

> **Track:** Week 2 · Identity
> **Time:** ~4 hours · **Prerequisite:** Day 6
> **Goal in one sentence:** explain what `dd_session` is on the wire, what it is
> in the database, and why it is not a JWT.

---

## 1. Why today matters

Ask five engineers the difference between a token, a session and a cookie and
you will get five answers, three of them wrong. Today you get one answer and you
get to verify every part of it against running code and real rows.

The sentence to carry away:

> **The cookie is the envelope. The token is the ticket inside it. The session
> is the row in our database that the ticket refers to.**

And the design decision to understand: this system uses an **opaque token backed
by a database row**, not a JWT. That choice costs one indexed lookup per request
and buys instant revocation. By the end of today you should be able to argue both
sides and say why this side won here.

---

## 2. Read first

| Source | Sections | ~min |
|---|---|---|
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-B2** — the four-way comparison table. Start here | 10 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-B3** — Cookie: what it is on the wire | 15 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-B4** — Opaque token vs JWT | 15 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 5** — all of it (5.1 → 5.10) | 60 |
| `docs/ENGINEER-ONBOARDING.md` | **Part 34-B5, B6** — hashing, and HMAC | 15 |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | skim | 15 |

---

## 3. Open these files, in this order

| # | File | What to look for |
|---|---|---|
| 1 | `apps/api/prisma/schema.prisma` | The `Session` model. Six fields and two indexes. Note `tokenHash` is `@unique`, and that `scope` exists |
| 2 | `apps/api/src/modules/auth/session.service.ts` | **The core file of today.** `issue`, `resolve`, `revoke`, `revokeAllForUser`. Read the doc comment first |
| 3 | `apps/api/src/modules/auth/session.service.ts` (again) | `hashToken()`. Only the SHA-256 is stored. **Why is fast hashing fine here but not for passwords?** |
| 4 | `apps/api/src/modules/auth/session.cookie.ts` | The cookie attributes, and the comment explaining `Lax` rather than `Strict` |
| 5 | `apps/api/src/modules/auth/session.port.ts` | The three principal shapes, and the resolver interface. Note it offers **no way to pass an identity in** |
| 6 | `apps/api/src/modules/auth/cookie-session.adapter.ts` | Cookie → row → principal. Read both properties named in its doc comment |
| 7 | `apps/api/src/modules/auth/password.ts` | Argon2id, and `verifyDecoy()`. A timing-attack defence in eight lines |
| 8 | `apps/web/src/lib/session.ts` | The web side. Note `hasSession()` is deliberately **not** an authorization check |
| 9 | `apps/web/src/lib/api.ts` | `sessionFrom()` and `apiSignIn` — how a `Set-Cookie` from the API is re-issued by the Next origin |

---

## 4. Do

### 4.1 See a real session, in three places at once

Sign in (admin sign-in is easiest — see `DEV_ADMIN_EMAIL` /
`DEV_ADMIN_PASSWORD` in `.env`):

```bash
curl -i -X POST http://localhost:4000/v1/auth/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ops@dealers-drive.in","password":"dealers-drive-local-admin"}'
```

**Place 1 — the wire.** Read the `Set-Cookie` header. Identify every attribute:
`HttpOnly`, `SameSite=Lax`, `Path=/`, `Expires`. Note `Secure` is *absent*
locally and present in production (`env.isProduction`).

**Place 2 — the database.**
```sql
SELECT id, "userId", scope, left("tokenHash", 16) AS hash_prefix,
       "expiresAt", "revokedAt", ip
FROM sessions ORDER BY "createdAt" DESC LIMIT 3;
```

**Place 3 — the browser.** Sign in through the UI, then DevTools →
Application → Cookies. Try to read it from the console:
```js
document.cookie      // dd_session is NOT here
```
That absence is `HttpOnly` working. **An XSS bug cannot steal this session.**

### 4.2 Prove the token is not in the database

Take the cookie value from §4.1 and search for it:

```sql
SELECT count(*) FROM sessions WHERE "tokenHash" = '<paste the raw cookie value>';
```

Zero rows. Only the SHA-256 is stored. Now compute the hash yourself:

```bash
printf '%s' '<the raw cookie value>' | shasum -a 256
```

That hex string **is** in the table. A leaked database dump does not hand anyone
a live session — that is the property this design buys.

### 4.3 Revoke a session and watch it die instantly

```bash
# with the cookie
curl -s -b "dd_session=<value>" http://localhost:4000/v1/admin/metrics/overview | head -c 120

# revoke it
curl -s -X POST -b "dd_session=<value>" \
  http://localhost:4000/v1/auth/admin/logout -i | head -1

# same cookie again
curl -s -b "dd_session=<value>" http://localhost:4000/v1/admin/metrics/overview | head -c 200
```

401, on the very next request. **This is the entire argument for the design.**
With a JWT you would need a denylist — which is a database, only slower to
consult and easier to forget to check.

Confirm in SQL:
```sql
SELECT "revokedAt" FROM sessions ORDER BY "createdAt" DESC LIMIT 1;
```

### 4.4 Watch the principal be rebuilt on every request

In `psql`, change something about the signed-in user while a session is live —
for example set a dealer's `status` to `SUSPENDED` — and immediately make
another request with the same cookie.

The behaviour changes **on the next request**, with no re-login. Read
`cookie-session.adapter.ts` again: nothing is cached in the token, so there is no
window in which a stale claim is still honoured.

### 4.5 Feel the difference between the two hashes

```bash
# fast
time (printf 'hello' | shasum -a 256)
```

Then read `password.ts`: Argon2id at 19 MiB and two passes, **deliberately
slow**. Write down, in one sentence each, why:

- SHA-256 is correct for a session token
- SHA-256 would be *negligent* for a password

(The answer is entropy. 32 random bytes have nothing to guess; a password does.)

### 4.6 See the timing defence

```bash
time curl -s -o /dev/null -X POST http://localhost:4000/v1/auth/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ops@dealers-drive.in","password":"wrong"}'

time curl -s -o /dev/null -X POST http://localhost:4000/v1/auth/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.com","password":"wrong"}'
```

Comparable durations, and identical responses. Without `verifyDecoy()` the second
would return much faster and the endpoint would be an account-enumeration
oracle.

---

## 5. Prove you understood it

1. Complete the sentence: "The cookie is the ___, the token is the ___, the
   session is the ___." → *§34-B2*
2. What does `HttpOnly` prevent, concretely? → *§34-B3*
3. Why `SameSite=Lax` and not `Strict`? Name the specific request that would
   break. → *§34-B3, §5.10* — **this is Day 9's whole flow**
4. Why is `SESSION_COOKIE_DOMAIN` empty in every environment? → *§34-B3, `env.ts`*
5. Why is only the hash of the token stored? → *`session.service.ts`*
6. Give one advantage of a JWT and one of an opaque token. Which won here, and
   why? → *§34-B4, §5.9*
7. Why does a dealer session with `scope = 'DEALER'` fail on an admin route even
   if the same human is an admin? → *`cookie-session.adapter.ts`*
8. Why is `hasSession()` in `lib/session.ts` explicitly *not* an authorization
   check? → *`lib/session.ts` doc comment*

---

## 6. Traps

- **Session expiry here is fixed, not sliding.** ARCHITECTURE says "sliding";
  the code sets `expiresAt` once at issue and never extends it. Part 29.3 records
  the conflict. Trust the code.
- **There is no session rotation on privilege change.** Also recorded in 29.3.
- **Nothing goes in `localStorage`.** No token is ever returned to client
  JavaScript. If you find yourself reaching for one, you have taken a wrong turn.

---

## 7. Deliverable

- [ ] I inspected one session on the wire, in the database, and in the browser
- [ ] I proved the raw token is not stored, by hashing it myself
- [ ] I revoked a session and got a 401 on the very next request
- [ ] I changed user state mid-session and saw the next request behave differently
- [ ] I can explain why SHA-256 suits a token and Argon2id suits a password
- [ ] I measured the login timing defence
- [ ] I have answered all eight questions in §5

---

## 8. Going deeper (optional)

- Open `apps/api/tests/auth.test.ts` and find the revocation and scope-isolation
  assertions. Everything you did by hand today is pinned there.
- Read **Part 5.9** carefully — the JWT-vs-session comparison table. You will be
  asked this in interviews for the rest of your career, and most people answer it
  badly.
