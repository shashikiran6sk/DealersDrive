# Day 9 — Google sign-in as this codebase implements it

> **Track:** Week 2 · Identity
> **Time:** ~4 hours · **Prerequisite:** Day 8
> **Goal in one sentence:** walk the complete sign-in flow across six files and
> two redirects, and explain what happens at every failure branch.

---

## 1. Why today matters

Yesterday was the protocol. Today is **this repository's implementation of it**,
and the two together are the thing your team needs you to understand.

By the end of today you should be able to answer, without notes:

> _"A dealer clicks Continue with Google. Describe every redirect, every cookie,
> and every check — and name what each check defends against."_

That is the Week 2 checkpoint, and it is the single most valuable thing in this
path.

---

## 2. Read first

| Source                        | Sections                                                  | ~min |
| ----------------------------- | --------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md` | **Part 4.4** — the full Google sign-in flow (the diagram) | 20   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 4.5** — every step, and what it defends against    | 45   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 4.6** — admin sign-in, a completely separate world | 15   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 4.7** — the `SessionResolver` seam                 | 15   |
| `docs/ENGINEER-ONBOARDING.md` | **Part 24, Journey 2** — a dealer signs in with Google    | 15   |
| `docs/CLAUDE.md`              | §5 — Authentication, as currently scoped                  | 10   |

---

## 3. Open these files, in this order

**This is the flow. Read them in this sequence and the whole thing assembles.**

| #   | File                                               | The step it implements                                                                                            |
| --- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1   | `apps/web/src/components/auth/google-button.tsx`   | **Step 0.** It is an `<a>`, not a `<button>` — read the comment saying why a `fetch` could not carry the redirect |
| 2   | `apps/web/src/app/(auth)/dealer/login/page.tsx`    | The sign-in screen. It asks the API which providers work, so a dead button is never rendered                      |
| 3   | `apps/api/src/modules/auth/auth.routes.ts`         | `GET /google/start`. Mints the transaction, sets `dd_oauth`, 302s to Google                                       |
| 4   | `apps/api/src/modules/auth/auth.service.ts`        | `startGoogle()`. Note: _nothing about the request influences_ `state`, `nonce` or the verifier                    |
| 5   | `apps/api/src/modules/auth/oauth-transaction.ts`   | The sealed cookie. `<base64url(json)>.<hmac>`. Also `safeReturnTo()` — the open-redirect defence                  |
| 6   | `apps/api/src/modules/auth/google.provider.ts`     | `authorizationUrl()`, then `exchange()`, then `claimsFrom()`                                                      |
| 7   | `apps/api/src/modules/auth/auth.routes.ts`         | `GET /google/callback`. **Read every error branch.** Note the cookie is cleared _first_, whatever happens next    |
| 8   | `apps/api/src/modules/auth/auth.service.ts`        | `completeGoogle()`. State check → exchange → find-or-create → issue session                                       |
| 9   | `apps/api/src/modules/auth/auth.service.ts`        | `createIdentity()`. The `ACCOUNT_LINK_REQUIRED` refusal and its comment                                           |
| 10  | `apps/api/src/modules/auth/session.service.ts`     | `issue()`. Yesterday's file, now in context                                                                       |
| 11  | `apps/api/src/modules/auth/auth.service.ts`        | `onboard()`. One transaction turns a verified person into a tenant                                                |
| 12  | `apps/web/src/features/auth/onboarding-wizard.tsx` | Where they land afterwards                                                                                        |

---

## 4. Do

### 4.1 Draw the flow before you run it

On one page, draw the two redirects and label every arrow with **what travels on
it**:

```
browser ──GET /v1/auth/google/start?returnTo=/dealer──▶ API
        ◀──302 to accounts.google.com  +  Set-Cookie: dd_oauth──
        ──────────────────────────────────────────────▶ Google
                                    (the dealer authenticates WITH GOOGLE)
        ◀──302 to /v1/auth/google/callback?code=…&state=…──
        ──GET /callback  +  Cookie: dd_oauth──────────▶ API
                                    API ──POST token endpoint──▶ Google  (server to server)
                                    API ◀──id_token───────────────
        ◀──302 to the web app  +  Set-Cookie: dd_session──
```

For each arrow: **which of `state`, `nonce`, `code_verifier` is on it, and which
is not?** (The verifier is never on a browser hop. That is the point of PKCE.)

### 4.2 Trace it live

With a real Google client configured (Day 8 §4.4):

1. Open DevTools → Network, tick **Preserve log**.
2. Click _Continue with Google_.
3. Walk the network log and find, in order:
   - the `302` from `/v1/auth/google/start`
   - the `Set-Cookie: dd_oauth=...` on it — note `HttpOnly` and `Max-Age=600`
   - the `state`, `nonce`, `code_challenge`, `code_challenge_method=S256`,
     `access_type=online` and `prompt=select_account` in the Google URL
   - the redirect back with `?code=...&state=...`
   - the `Set-Cookie: dd_session=...` on the callback's `302`
4. Confirm the `dd_oauth` cookie is **gone** afterwards. Single-use.

### 4.3 Break it deliberately — five ways

Each of these maps to one branch in the callback handler. Do them in a private
window.

| Break it                                                          | Expected                                           | Which defence fired                             |
| ----------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Start sign-in, then delete the `dd_oauth` cookie before finishing | redirected to `/dealer/login?error=sign_in_failed` | `state` — no transaction to compare against     |
| Tamper with one character of the `dd_oauth` cookie value          | same                                               | the **HMAC** — `openTransaction()` returns null |
| Hit `/v1/auth/google/callback?code=x&state=y` directly            | same                                               | `state` mismatch                                |
| Hit `/v1/auth/google/callback?error=access_denied`                | `?error=google_declined`                           | Google's own refusal, handled explicitly        |
| Wait 11 minutes at Google's account chooser, then continue        | `sign_in_failed`                                   | the 10-minute `OAUTH_TRANSACTION_TTL_SECONDS`   |

**For each one, find the exact line in `auth.routes.ts` or `auth.service.ts` that
produced it.** That is the exercise; the redirect is just the evidence.

### 4.4 Try the open-redirect attack

```
http://localhost:4000/v1/auth/google/start?returnTo=https://evil.example.com
http://localhost:4000/v1/auth/google/start?returnTo=//evil.example.com
```

Both land on `/dealer` instead. Read `safeReturnTo()` and note it checks the
**second** character too — `//evil.com` is a protocol-relative URL and would
otherwise escape. An open redirect on an OAuth callback is the classic way a
session leaks.

### 4.5 Watch the two states a signed-in person can be in

```sql
-- a Google identity, but no dealership yet
SELECT u.id, u.email, oi."providerSubject", dm.id AS membership
FROM users u
LEFT JOIN oauth_identities oi ON oi."userId" = u.id
LEFT JOIN dealer_members dm ON dm."userId" = u.id AND dm.status = 'ACTIVE'
ORDER BY u."createdAt" DESC LIMIT 5;
```

A row with an identity and **no membership** is a `PendingPrincipal`: a real
session that can reach exactly three endpoints — `/auth/me`,
`/auth/onboarding`, `/auth/logout`. Confirm in `session.port.ts` and
`middleware/auth.ts`.

Then call it:

```bash
curl -s -b "dd_session=<value>" http://localhost:4000/v1/auth/me | jq '.next'
```

`"ONBOARDING"` for a pending account, `"DASHBOARD"` once approved.

### 4.6 Compare the two sign-in worlds

Read `adminLogin()` in `auth.service.ts` beside `completeGoogle()`. Fill in:

|                                   | Dealer | Admin |
| --------------------------------- | ------ | ----- |
| Credential                        |        |       |
| Session scope                     |        |       |
| Session lifetime                  |        |       |
| Rate limited by                   |        |       |
| Can one reach the other's routes? |        |       |

---

## 5. Prove you understood it — Week 2 checkpoint

> **Say this out loud, to another person, without notes:**
> _"A dealer clicks Continue with Google. Describe every redirect, every cookie,
> and every check — and name what each check defends against."_

Supporting questions:

1. Why is the sign-in control an `<a>` rather than a `<button>`? → _`google-button.tsx`_
2. Why is there no `oauth_states` table? → _`oauth-transaction.ts` doc comment_
3. Why is `dd_oauth` cleared as the _first_ action of the callback, before any
   validation? → _`auth.routes.ts`_
4. Why does the callback redirect to a screen on failure instead of returning
   JSON? → _`auth.routes.ts` doc comment_
5. What is a `PendingPrincipal`, and exactly which endpoints can it reach? → _`session.port.ts`_
6. Why does onboarding create the dealership in `DRAFT` and never `ACTIVE`? → _Rule 5, `auth.service.ts`_
7. Why is `ACCOUNT_LINK_REQUIRED` a refusal rather than an automatic merge? → _`createIdentity()`_
8. Where does `dealerId` first enter a request, and what could a client do to
   influence it? → _`middleware/auth.ts`_ — the answer to the second half is
   _nothing_
9. Why can an admin session never satisfy `requireDealer`? → _`cookie-session.adapter.ts`_

---

## 6. Traps

- **`redirect_uri` must match Google's registration exactly.** `https` vs
  `http`, trailing slash, port. Most sign-in failures are this.
- **`AUTH_MODE=dev` bypasses only the _identity verification mechanism_.**
  Everything downstream — permissions, tenant isolation, dealer status — behaves
  identically. Do not conclude that authorization is mocked.
- **The production consent screen must be published**, not left in Testing. A
  real dealer is not on anybody's test-user list.
- **One OAuth client per environment.** A client is only as trustworthy as the
  least protected host on its redirect list.

---

## 7. Deliverable

- [ ] I drew the two-redirect flow and labelled what travels on every arrow
- [ ] I traced a real sign-in in DevTools and found both `Set-Cookie` headers
- [ ] I broke the flow five ways and located the line that handled each
- [ ] I tried the open-redirect attack and read `safeReturnTo()`
- [ ] I found a `PendingPrincipal` in the database and called `/auth/me` as one
- [ ] I filled in the dealer-vs-admin comparison table
- [ ] **I answered the Week 2 checkpoint question out loud**

---

## 8. Going deeper (optional)

- Open `apps/api/tests/auth.test.ts` and `apps/api/tests/auth-harness.ts`. Note
  the tests inject a **fake `OAuthProvider`** through `ContainerOverrides` — no
  test ever talks to Google. That is what the port in `oauth.port.ts` bought.
- Read **Part 25.1** — "What happens if…" for authentication. Nine concrete
  failure cases, several of which you triggered today.
