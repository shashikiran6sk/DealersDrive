# R98 — production performance audit (evidence)

Evidence for the R98 change on `claude/production-performance-audit-7i0a6z`
(commit `3d6aee6`): no Login flash, immediate feedback on every click, and no
frozen navigation while a request is in flight. The product branch carries
none of these files; the reasoning lives in `docs/code/**` and `CONTEXT.md`
§7p there.

## 1. The recording (2026-10-05, 6 min 35 s, production)

Contact sheets of the frames, two seconds apart, timestamps burned in:

| Sheet                                | Time      | What it shows                                                                                   |
| ------------------------------------ | --------- | ----------------------------------------------------------------------------------------------- |
| [frames-01](recording/frames-01.jpg) | 0:00–0:10 | First load, signed out — the baseline header                                                    |
| [frames-06](recording/frames-06.jpg) | 1:00–1:10 | OTP verified → car page renders with **Login** and a spinning Enquire button                    |
| [frames-07](recording/frames-07.jpg) | 1:12–1:22 | …then the avatar appears (auth flash)                                                           |
| [frames-15](recording/frames-15.jpg) | 2:48–2:58 | Logged out on `/dealers`; on `/cars` the hearts are still filled; clicks on the logo do nothing |
| [frames-16](recording/frames-16.jpg) | 3:00–3:10 | Still stuck on `/cars`                                                                          |
| [frames-17](recording/frames-17.jpg) | 3:12–3:22 | `/dealers` finally at 3:20, then a manual reload                                                |
| [frames-22](recording/frames-22.jpg) | 4:12–4:22 | Add vehicle → **Continue** spinner starts                                                       |
| [frames-24](recording/frames-24.jpg) | 4:36–4:46 | Spinner still going; Enquiries clicked — nothing                                                |
| [frames-25](recording/frames-25.jpg) | 4:48–4:58 | Inventory clicked — nothing; reload at 4:56                                                     |
| [frames-26](recording/frames-26.jpg) | 5:00–5:10 | Logo → home shows **Login**, then the avatar                                                    |

## 2. Method

- Local production build (`next build && next start`), API built and run with
  `node dist/index.js`, PostgreSQL 16 seeded with `db:seed` + `db:seed:dev`.
- [`harness/latency-proxy.mjs`](harness/latency-proxy.mjs) sits between the
  web tier and the API and adds a fixed delay to every API call (150 ms unless
  stated, to stand in for the Vercel → AWS hop), plus per-route rules
  (`POST /v1/dealer/vehicles` +12 s for the frozen-navigation case).
- [`harness/measure.mjs`](harness/measure.mjs) drives Chromium through the
  recording's flows and polls the DOM every 10–20 ms. The **same script** ran
  against the original web code (`git stash`) and the R98 code, against the same
  API and database.
- "Feedback" is the first moment anything shows the click was heard: the
  skeleton, the pending spinner, or the URL changing. "Content" is the new page's
  own content, skeleton gone.

Raw results: [before.json](measurements/before.json) ·
[after.json](measurements/after.json) (logs alongside).

## 3. Results

| Flow                                                   | Before                                  | After                                         |
| ------------------------------------------------------ | --------------------------------------- | --------------------------------------------- |
| Refresh `/`, `/cars`, `/dealers` signed in — header    | **Login** visible, avatar ~350 ms later | placeholder → avatar, **Login never visible** |
| Server actions after a public-page load                | 2, run back to back (~180 + ~170 ms)    | 1 + one `GET /api/account` in parallel        |
| Console tab click → first feedback                     | 228–404 ms (nothing until content)      | **30–63 ms**                                  |
| Console tab click → content                            | 228–404 ms                              | 345–400 ms (see note)                         |
| Click Inventory while a 12 s create is in flight       | **7,244 ms**                            | **430 ms**                                    |
| Home → car card click → feedback (800 ms per API call) | 900–924 ms                              | **40–75 ms**                                  |
| Home → car card click → content (800 ms per API call)  | 900–924 ms                              | **366–373 ms**                                |
| Saved hearts still pressed after logout                | 1                                       | **0**                                         |
| Browser console errors / hydration warnings            | —                                       | none                                          |
| First-load JS per route                                | —                                       | +1–2 kB                                       |

**Note on console content time.** The RSC request for a tab starts at 33–60 ms
and makes the same two API calls as before (proxy log, `harness/tabcalls.mjs`);
the skeleton paints at 38–69 ms and the content lands ~300 ms after it. That is
React 19's Suspense reveal throttle (`FALLBACK_THROTTLE_MS`), not server work. On
a fast local API the content arrives ~100 ms later than without a skeleton; at
the 1–3 s production latencies in the recording the throttle never applies.

**Frozen navigation.** Reproduced and fixed: React 19 entangles transitions, so
a Server Action awaited inside a transition (a form action, `useActionState`,
`startTransition(async …)`) holds every `<Link>` navigation until it settles.
Before, the Inventory click committed only when the 12 s create gave up at the
web tier's 8 s timeout.

**The post-logout stall (2:52–3:20)** did not reproduce locally: after logout,
"Dealers" navigated in 73–74 ms in both builds ([`harness/stuck.mjs`](harness/stuck.mjs)
traces it). The 25 s and 43 s production stalls match chains of the web tier's
8 s API timeouts, i.e. a stuck API/database rather than the client. R98 bounds
the DB pool (acquire, statement, idle-in-transaction timeouts) and adds `dbMs` /
`dbOps` to the API request log and `api.slow_request` with `traceId` to the web
log, so the next occurrence can be attributed from production logs.

## 4. Screens (production build, delay injected so the state stays on screen)

| Screen                                                       | What it shows                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [header-placeholder](screens/header-placeholder.png)         | Signed in, refresh, account lookup still in flight: a 40 px circle, not Login    |
| [header-avatar](screens/header-avatar.png)                   | The same corner a moment later — same place, same size                           |
| [console-pending](screens/console-pending.png)               | Sidebar click: sidebar, top bar and credits stay; only `main` shows the skeleton |
| [console-loaded](screens/console-loaded.png)                 | The page that replaced it                                                        |
| [mobile-console-pending](screens/mobile-console-pending.png) | The same on the mobile tab bar (390 px)                                          |
| [car-card-pending](screens/car-card-pending.png)             | 90 ms after a card click on `/cars`                                              |
| [car-skeleton](screens/car-skeleton.png)                     | The vehicle-page skeleton (2.5 s per API call), on the page's own grid           |
| [car-loaded](screens/car-loaded.png)                         | The page that replaced it                                                        |

## 5. Gate

On the product branch: `pnpm lint`, `pnpm typecheck`, `pnpm test` (web 1,399,
API 2,831 incl. integration on PostgreSQL 16, contracts 420) and `pnpm build`
all green. New unit tests cover the auth hint and its pre-paint script, the
redirect parser, the navigation-safe hooks (pending, redirect, last-click-wins,
error boundary, form submitter), the pending indicators, `GET /api/account`,
the skeletons and the saved hearts clearing on logout.

## 6. Reproducing

```bash
# web on :3000 pointed at the proxy, API on :4000
node harness/latency-proxy.mjs &                       # :4001, BASE_MS=150
API_BASE_URL=http://localhost:4001 pnpm --filter @dealers-drive/web start
node harness/measure.mjs after.json                    # needs playwright-core
```

The scripts launch Chromium from `/opt/pw-browsers/chromium-1194`; change
`executablePath` for another machine. They sign in with the seeded owner
`9840012345` and the fake OTP `123456` (`PHONE_OTP_DRIVER=fake`).
