# Day 6 — Networking first principles: DNS, TLS, HTTP, origins, CORS

> **Track:** Week 2 · Identity
> **Time:** ~3.5 hours · **Prerequisite:** Week 1
> **Goal in one sentence:** explain everything that happens _before_ your code
> runs, and why this system serves the API and the web app on one hostname.

---

## 1. Why today matters

You cannot understand cookies without understanding **origins**. You cannot
understand `SameSite=Lax` without understanding **cross-site navigation**. You
cannot understand why the OAuth callback works without understanding both.

Week 2 is the hardest week in this path, and it is hard mostly because people
try to learn OAuth without this foundation. Today is that foundation. It is
deliberately light on repository code and heavy on the substrate.

There is also one design decision to carry away: **this system serves
`www.dealers-drive.com` and its API on the _same origin_, split by path at the
load balancer.** By the end of today you should be able to say why that is a
security decision rather than a convenience.

---

## 2. Read first

| Source                                                                                               | Sections                                                              | ~min |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md`                                                                        | **Part 34, section A** — A1 through A7, all of it                     | 45   |
| `docs/ENGINEER-ONBOARDING.md`                                                                        | **§23.2** — "Why one hostname per environment, not `api.` and `www.`" | 15   |
| `docs/ENGINEER-ONBOARDING.md`                                                                        | **Part 19.5, 19.6** — CORS and CSRF as this system handles them       | 20   |
| [MDN — Same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy) | the whole page                                                        | 15   |
| [MDN — CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)                                 | up to and including "Preflighted requests"                            | 25   |

---

## 3. Open these files, in this order

| #   | File                                         | What to look for                                                                                                   |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | `apps/api/src/server.ts`                     | The `cors()` call. `origin: env.webOrigins` — an allow-list, **never `*`** — and `credentials: true`               |
| 2   | `apps/api/src/config/env.ts`                 | `WEB_ORIGIN`, and the `webOrigins` getter that splits it on commas                                                 |
| 3   | `apps/api/src/server.ts`                     | `app.set('trust proxy', 1)`. One line, and every per-IP rate limit depends on it                                   |
| 4   | `apps/api/src/middleware/rate-limit.ts`      | See `req.ip` being used as the bucket key. Now the line above matters                                              |
| 5   | `deploy/aws/README.md`                       | §8 (Load balancer) — the listener rule table. **Read the note about `/api/docs*` vs `/api/*`**                     |
| 6   | `deploy/aws/README.md`                       | §10 (DNS) — and the warning about proxying breaking `trust proxy 1`                                                |
| 7   | `apps/api/src/modules/media/media.routes.ts` | Find `Cross-Origin-Resource-Policy: cross-origin` and read the comment. A real CORS-adjacent bug, already paid for |

---

## 4. Do

### 4.1 Watch DNS and TLS on a real host

```bash
dig +short github.com
curl -sv https://github.com -o /dev/null 2>&1 | grep -E "SSL|subject|issuer|ALPN"
```

You are looking at: a name resolving to addresses, a TLS handshake, and a
certificate chain the browser already trusts.

### 4.2 See the headers your own API sets

```bash
curl -sI http://localhost:4000/v1/vehicles
```

Identify which header came from `helmet` and which from your handlers. Then read
[helmet's docs](https://helmetjs.github.io/) for two of them.

### 4.3 Trigger a CORS preflight and watch it fail

```bash
# An allowed origin
curl -si -X OPTIONS http://localhost:4000/v1/vehicles \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"

# A forbidden origin
curl -si -X OPTIONS http://localhost:4000/v1/vehicles \
  -H "Origin: http://evil.example.com" \
  -H "Access-Control-Request-Method: GET" | grep -i "access-control"
```

The second returns no `Access-Control-Allow-Origin`. **The browser is what
enforces this** — `curl` still received a response. That distinction matters:
CORS protects _users of browsers_, not your server. Your server is protected by
authentication.

### 4.4 Prove `*` and credentials are incompatible

Temporarily set `origin: '*'` in `server.ts`'s `cors()` call while keeping
`credentials: true`. Restart, retry the preflight, and read the browser console
on a real page. The browser refuses. Restore the file.

That refusal is a _specification rule_, not a bug: a wildcard plus credentials
would let any site on the internet make authenticated requests as you.

### 4.5 Reason about the hostname layout on paper

Answer these before reading §23.2 again:

> Suppose the API moved to `api.dealers-drive.com` and the site stayed at
> `www.dealers-drive.com`.
>
> 1. What would `SESSION_COOKIE_DOMAIN` have to be set to?
> 2. Which **other** hostnames would then receive that cookie?
> 3. What does that mean for `dev.dealers-drive.com`?

Now read §23.2 and check yourself. The answer to (3) is the reason the split
does not exist.

### 4.6 Find the listener-rule trap

In `deploy/aws/README.md` §8, find why the API rule names `/api/docs*` and
**must not** name `/api/*`. Then confirm the conflict is real:

```bash
ls apps/web/src/app/api/
```

Those are the web app's own BFF routes. Routing `/api/*` to Express would break
photo upload and the enquiry inbox with a 404 that looks like an application bug.

---

## 5. Prove you understood it

1. What exactly is an _origin_? Are `http://a.com` and `https://a.com` the same
   one? → _§34-A5_
2. What does the same-origin policy prevent, and who enforces it? → _§34-A5_
3. When does a browser send a CORS preflight, and what is it asking? → _§34-A6_
4. Why can `Access-Control-Allow-Origin: *` not be combined with credentials? → _§34-A6_
5. Where does TLS terminate in production, and what protects the traffic after
   that point? → _§34-A3, §23.2_
6. What does `trust proxy 1` do, and what breaks without it? → _§34-A7_
7. Why is one hostname per environment a _security_ decision? → _§23.2_
8. Why is a TCP connection expensive enough to justify pooling? → _§34-A2_

---

## 6. Traps

- **CORS is not authentication.** A tool that is not a browser ignores it
  entirely. Never treat a CORS allow-list as an access control.
- **helmet's `Cross-Origin-Resource-Policy: same-origin`** blocks cross-origin
  image embedding. The media route deliberately sends `cross-origin`; the JSON
  API keeps the strict default. This has already cost someone time — see
  `CONTEXT.md` §9.
- **Proxying DNS through Cloudflare's orange cloud** adds a hop and makes
  `trust proxy 1` read the Cloudflare edge as the client, silently breaking every
  per-IP limit that protects dealer phone numbers.

---

## 7. Deliverable

- [ ] I inspected a real DNS resolution and TLS certificate chain
- [ ] I triggered an allowed and a blocked CORS preflight and read both responses
- [ ] I proved `*` plus credentials is refused by the browser, then restored the file
- [ ] I answered the three hostname-layout questions before re-reading §23.2
- [ ] I found the `/api/docs*` listener-rule trap and confirmed the conflict
- [ ] I can define "origin" precisely
- [ ] I have answered all eight questions in §5

---

## 8. Going deeper (optional)

- Read [web.dev — HTTP caching](https://web.dev/articles/http-cache). It is 20
  minutes and it makes Day 15's `Cache-Control: immutable` and Day 16's Next.js
  caching both obvious.
- Watch one of Hussein Nasser's TLS-handshake explainers
  ([channel](https://www.youtube.com/@hnasr)). Packet-level, and it makes
  connection pooling intuitive rather than abstract.
