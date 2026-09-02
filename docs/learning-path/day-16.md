# Day 16 — Next.js: Server Components, Server Actions and the BFF

> **Track:** Week 4 · The surface, and running it
> **Time:** ~4 hours · **Prerequisite:** Week 3
> **Goal in one sentence:** choose correctly between the four data-fetching
> shapes this app uses, and explain the caching rule whose failure is a data breach.

---

## 1. Why today matters

If your React experience is Create React App or the Pages Router, the App Router
is a genuine shift: **React now runs on a server**, and the default component
never ships to the browser at all.

That is not a performance tweak. It changes what a component _is allowed to do_.
A Server Component can `await` a database call. A Client Component cannot, ever.

And there is one rule today whose failure mode is not a bug but an **incident**:

> Attaching a session to a **cached** fetch is how one dealer's console ends up
> in another dealer's browser.

`lib/api.ts` prevents it structurally. Understand why before you touch that file.

---

## 2. Read first

| Source                                                                             | Sections                                                    | ~min |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---- |
| `docs/ENGINEER-ONBOARDING.md`                                                      | **Part 18** — all of it (18.1 → 18.10)                      | 55   |
| `docs/ENGINEER-ONBOARDING.md`                                                      | **Rule 8, Rule 9** in `docs/CLAUDE.md`                      | 5    |
| [Next.js — App Router](https://nextjs.org/docs/app)                                | "Server and Client Components"                              | 25   |
| [Next.js — Caching](https://nextjs.org/docs/app/building-your-application/caching) | the whole page — **read this before touching `lib/api.ts`** | 25   |

---

## 3. Open these files, in this order

| #   | File                                                 | What to look for                                                                                           |
| --- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `apps/web/src/app/layout.tsx`                        | The root. Server Component. Config is read here and passed down as props                                   |
| 2   | `apps/web/src/lib/config.ts`                         | `'server-only'` at the top — an import guard that makes leaking this into a client bundle a build error    |
| 3   | `apps/web/src/app/(public)/cars/page.tsx`            | **Shape 1: RSC fetch.** Reads `searchParams`, `await`s data, renders. No hooks, no spinner                 |
| 4   | `apps/web/src/lib/api.ts`                            | **The core file.** `apiGet`, `apiSend`, and the `uncached` branch. Read the doc comment on the class first |
| 5   | `apps/web/src/features/auth/actions.ts`              | **Shape 2: Server Actions.** `'use server'`. The three writes that change who you are                      |
| 6   | `apps/web/src/app/api/dealer/media/presign/route.ts` | **Shape 3: BFF route handler.** Used only where the browser genuinely must fetch                           |
| 7   | `apps/web/src/features/vehicle/photo-uploader.tsx`   | **Shape 4: a real Client Component.** `'use client'`, `useState`, drag-and-drop, progress                  |
| 8   | `apps/web/src/lib/session.ts`                        | `currentSession()` vs `hasSession()` — and the redirect loop the distinction prevents                      |
| 9   | `apps/web/src/app/(dealer)/dealer/layout.tsx`        | The console's own guard                                                                                    |
| 10  | `apps/web/src/app/robots.ts`                         | Environment-dependent output. §31.5's smoke test checks this                                               |

---

## 4. Do

### 4.1 Prove a Server Component never reaches the browser

Open http://localhost:3000/cars, then **View Source** (not DevTools Elements —
actual source). The car titles and prices are in the HTML.

Now DevTools → Network → JS. The rendering logic for `cars/page.tsx` is not in
any bundle. **The component ran on the server and only its output was sent.**

Then read §18.4 for why public pages _must_ be server-rendered: SEO. A used-car
marketplace lives on Google indexing its listing pages, and a crawler does not
wait for `useEffect`.

### 4.2 Add a `console.log` and find out where it prints

In `cars/page.tsx`, add `console.log('SERVER?')`. Reload.

It prints in the **terminal running `pnpm dev`**, not the browser console. That
one experiment settles the mental model faster than any amount of reading.

Now add `'use client'` at the top of the same file and reload. It prints in the
browser — and the page probably breaks, because a Client Component cannot
`await` a server-side fetch. **Remove `'use client'`.**

### 4.3 The caching rule — read it, then reason about it

In `lib/api.ts`:

```ts
const uncached = options.revalidate === false || method !== 'GET';

if (uncached) {
  init.cache = 'no-store';
  const session = await sessionCookie();
  if (session) init.headers = { ...init.headers, Cookie: `${SESSION_COOKIE}=${session}` };
}
```

Answer in writing before reading further:

> **Why is the session cookie forwarded _only_ inside the `uncached` branch?**

Then read the class doc comment. The answer: Next's data cache is **shared across
requests and users**. If a session-bearing fetch were cached, the first dealer's
response would be served to the next visitor. Public pages stay anonymous and
cacheable; anything behind a session is `revalidate: false` and never shared.

Also note `sessionCookie()` swallows an error: `cookies()` _throws_ during static
generation, and that is legitimate — the sitemap and cached public pages are
rendered with no request at all and have no session to forward.

### 4.4 Choose the right shape, four times

For each, decide before checking §18.9:

| Requirement                                                | RSC fetch · Server Action · BFF route · Client Component |
| ---------------------------------------------------------- | -------------------------------------------------------- |
| Render the public search results page                      |                                                          |
| Submit the onboarding form and set a session cookie        |                                                          |
| Upload a photo directly to storage with a progress bar     |                                                          |
| Switch tabs in the enquiry inbox without a full navigation |                                                          |

Now find each in the repository and confirm.

### 4.5 Watch a Server Action

Sign in to the admin console through the UI with DevTools open. Note the request:
it is a `POST` to the **same URL as the page**, not to `/api/anything`. That is a
Server Action.

Then read `adminLoginAction` in `features/auth/actions.ts` and note _why_ it must
be a Server Action rather than a browser fetch:

> the session cookie has to be set server-side… **No token is ever handed to
> client JavaScript** — nothing in `localStorage`, nothing in a React state atom,
> nothing a script on the page could read.

Also read `apiSignIn` in `lib/api.ts`: the fetch happened on the Next server, so
the API's `Set-Cookie` never reached the browser. It must be _re-issued_ by this
origin. That is what `sessionFrom()` does.

### 4.6 Understand why the BFF exists at all

```bash
ls apps/web/src/app/api/
```

Eight handlers. Read the comment on the presign one:

> The upload itself goes **direct from the browser to object storage**… Only the
> signing call is proxied, because it needs the API base URL and the session.

The BFF exists to satisfy **Rule 9**: no `NEXT_PUBLIC_API_BASE_URL`. The browser
never learns the API's address; it calls its own origin, and the Next server
forwards. Confirm the rule holds:

```bash
grep -rn "NEXT_PUBLIC" apps/web/src ; echo "exit $?"
```

### 4.7 Break the redirect loop, then fix it

Read `lib/session.ts`. `hasSession()` says a cookie _exists_; `currentSession()`
asks the API whether it _works_.

Reason it out: if the sign-in page used `hasSession()` and you held a cookie that
had been revoked, what happens? (Sign-in redirects to console → console 401s →
redirects to sign-in → forever.) That is why the sign-in screens verify with the
API instead.

---

## 5. Prove you understood it

1. What changes when React runs on a server? → _§18.1_
2. When must a component be a Client Component? Give two genuine reasons. → _§18.2_
3. Why must public pages be server-rendered here? → _§18.4_
4. Why does `lib/api.ts` forward the session cookie only for uncached requests? → _`lib/api.ts`_ — **the data-breach question**
5. Why is sign-in a Server Action rather than a browser fetch? → _§18.7, `features/auth/actions.ts`_
6. Why do BFF route handlers exist when Server Actions also run on the server? → _§18.8_
7. Why is `NEXT_PUBLIC_*` banned? → _Rule 9, §18.6, §23.3_
8. What is the difference between `hasSession()` and `currentSession()`? → _`lib/session.ts`_
9. Why does `cookies()` throwing during static generation not indicate a bug? → _`lib/api.ts`_
10. Why must `next build` succeed with no API running? → _§23.3, `apps/web/Dockerfile`_

---

## 6. Traps

From `CONTEXT.md` §9 — each of these has already cost someone time:

- **`'use server'` modules may only export async functions.** Constants go in a
  sibling file (`features/enquiry/shared.ts` exists for exactly this).
- **`.strict()` rejects `undefined`.** An action with no input must send `{}`.
  `lib/api.ts` defaults non-DELETE bodies to `{}`; bypassing it silently 400s,
  and once made admin _Approve_ do nothing at all.
- **Tailwind v4 arbitrary values are `bg-(--var)`**, not the v3 `bg-[--var]`.
  The old form compiles silently and emits invalid CSS. 66 occurrences were
  fixed once — do not reintroduce it.
- **Reading a cookie makes a route dynamic.** That is intended for the console
  and would be a bug on a public page.

---

## 7. Deliverable

- [ ] I proved a Server Component's logic is absent from the client bundle
- [ ] I ran the `console.log` experiment and know where each one prints
- [ ] I explained the session/cache rule in writing before reading the answer
- [ ] I chose the right shape for all four requirements and verified each in code
- [ ] I watched a Server Action in the Network tab and read why sign-in must be one
- [ ] I confirmed `NEXT_PUBLIC_` appears nowhere in the web app
- [ ] I can explain the `hasSession()` / `currentSession()` distinction
- [ ] I have answered all ten questions in §5

---

## 8. Going deeper (optional)

- Read `apps/web/src/app/sitemap.ts` and `robots.ts`. Both are environment-aware,
  and `robots.ts` is specifically checked by `scripts/smoke.sh` — because a
  production image that shipped `Disallow: /` would silently delist the entire
  marketplace. Day 19 returns to it.
- Read **§18.10** — the two Next.js traps recorded in `CONTEXT.md`.
