# Dealers-Drive promotional film

Everything needed to rebuild the Dealers-Drive product film from the real
application: a development-only demo dataset, generated placeholder
photography, a scripted Playwright walkthrough, and a frame-accurate
compositor that turns the walkthrough into 4K, 1080p, vertical and square
exports.

**This folder is marketing tooling. Nothing in it is part of the product.** It
is not a pnpm workspace package, it is not built or deployed, and nothing in
`apps/` or `packages/` imports it. See [Production is unaffected](#production-is-unaffected).

| Deliverable                  | Where                                                        |
| ---------------------------- | ------------------------------------------------------------ |
| 16:9 master, 3840×2160       | `exports/dealers-drive-promo-4k.mp4`                         |
| 16:9, 1920×1080              | `exports/dealers-drive-promo-1080p.mp4`                      |
| 9:16 vertical, Reels/Shorts  | `exports/dealers-drive-promo-9x16.mp4`                       |
| 1:1 square                   | `exports/dealers-drive-promo-1x1.mp4`                        |
| Subtitles                    | `exports/*.srt` (also `film/captions.srt`, 16:9 cut)         |
| Narration script             | [`film/narration.md`](film/narration.md)                     |
| Scene list                   | [`film/scene-list.md`](film/scene-list.md)                   |
| Asset inventory and licences | [`film/assets-and-licences.md`](film/assets-and-licences.md) |

`exports/`, `recordings/` and `assets/generated/` are git-ignored: they are
large, and every one of them is rebuilt deterministically by the commands
below.

---

## What the film shows, and what it does not claim

The film is the real product, running locally against the dev seed. Every
screen in it is a screenshot of `apps/web` taken by `scripts/capture.mjs`
while it performs the real action — searching, filtering, opening the
gallery, signing in with an OTP, sending an enquiry, onboarding a
dealership, reserving a car, marking an enquiry contacted. No screen is
mocked, retouched or built for the film.

Three things are changed for the camera, and only for the camera
(`scripts/lib/recorder.mjs`, `RECORDING_SCRIPT`):

- the yellow `local — not real data` banner is hidden;
- the `No SMS is sent in this environment — enter 123456` hint on the OTP
  step is hidden (in production a real SMS is sent);
- scrollbars and the blinking caret are hidden.

The narration makes no claim the product does not implement. "Verified" is
only said of **dealerships** (identity and business documents are checked
during onboarding and approved by an admin); nothing is called certified,
guaranteed, cheapest or best.

---

## The pipeline

```
 1  pnpm --filter @dealers-drive/api db:seed         base seed: the admin, one dealership
 2  pnpm --filter @dealers-drive/api db:seed:dev     120 dealerships, 320 cars
 3  pnpm --filter @dealers-drive/api db:seed:promo --catalog-only
                                                     the demo story + assets/catalog.json
 4  npm run media                                    render the placeholder photography
 5  pnpm --filter @dealers-drive/api db:seed:promo   attach it through the storage port
 6  npm run capture                                  walk the app, 16:9 (desktop)
    npm run capture:mobile                           walk the app, 9:16 (phone)
 7  npm run render:all                               compose and encode every export
```

`scripts/prepare-demo.sh` runs 3–5 in order. Steps 6–7 need the app running.

### Prerequisites

- The local stack from the root README: PostgreSQL, `apps/api` and
  `apps/web`, with `STORAGE_DRIVER=local` (or MinIO) and the default
  `PHONE_OTP_DRIVER=fake`.
- For the capture, run `apps/web` as a **production build**
  (`pnpm --filter @dealers-drive/web build && … start`) so no Next.js dev
  overlay appears on screen.
- Node 22+ and a Chromium. `npm install` here pulls only `playwright-core`;
  set `PROMO_CHROMIUM` if Chromium is not at
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- An `ffmpeg` with libx264: on `PATH`, in `FFMPEG`, or from
  `pip install imageio-ffmpeg` (the scripts find that one automatically).

```bash
cd marketing/dealers-drive-promo
npm install
```

---

## 1. The demo data — `db:seed:promo`

`apps/api/prisma/seed/dev-promo.ts` with its data in
`apps/api/prisma/seed/dev-promo.data.ts`. It sits beside the other dev seeds
and uses the same loopback guard (`dev-guard.ts`): it refuses
`NODE_ENV=production` and any non-local `DATABASE_URL` unless
`ALLOW_REMOTE_DEV_SEED=yes` is typed out.

It adds no new concept. On top of `db:seed:dev` it:

| What                                      | Why                                                                                          |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| 7 cars for **Green Circle Cars, Vellore** | the featured dealership; an inventory across Active, Reserved, Sold, Withdrawn and In review |
| 4 customers and their enquiries           | the dealer's inbox and dashboard have history before the film's own enquiry arrives          |
| **Arjun Raman**, the film's customer      | signs in by phone on camera; his enquiries and saved cars are cleared on every run           |
| **Metro Motors**' owner, Ravi Shankar     | a dealer with a proved phone and a linked Google identity, so onboarding is walkable locally |

Every name, number and address is invented. Phone numbers sit in the block
`+91 90000 1xxxx`–`3xxxx`; emails are on `example.com`.

**Re-running it is the reset.** Rows are upserted by deterministic id, so a
run restores the exact starting state of the film: Arjun has no enquiries,
the Nexon is Active again, Metro Motors has not started onboarding. It takes
about three seconds once the photographs are in place.

### How the photographs are loaded

The seed writes each image through the API's own `StoragePort`
(`src/platform/storage/factory.ts`), with the same object keys the upload
flows use — `vehicles/{vehicleId}/{mediaId}/original.webp` plus the
`320/640/1024/1600` derivatives, and `dealers/{slug}/yard/{mediaId}` for a
yard photograph — and creates `Media` and `VehicleMedia` rows beside them,
marked `READY`, credited to the seeded admin. The app then serves them
through its normal `/media/by-media/{id}/{width}.webp` route. There is no
special case anywhere in `src`.

Every row it writes has a `fileName` starting `promo/`. A car or dealership
that already has a photograph without that prefix (a real upload) is
skipped, and a re-run only replaces its own rows. `--refresh-media`
re-encodes everything after the art has been regenerated.

---

## 2. The placeholder photography — `npm run media`

**These are stylised renders, not photographs, and are meant to be
replaced.** No image-generation service was available when the film was
made, so `art/` draws every image as SVG — studio side profiles, front and
rear views, interiors (right-hand drive), detail crops, and Indian dealership
yards — and rasterises it with Chromium.

- Deterministic: every trait (paint shade, wheels, grille, interior trim,
  studio backdrop, yard style, sky) is seeded from the vehicle id or the
  dealership slug, so the same database always produces the same images.
- No logos, no signage text, no number plates: plates carry a plain
  "Dealers-Drive" mask, and dealership fascias are blank colour bands, so the
  UI is what names the dealer.
- Featured cars (every Green Circle car) get 14 images; every other publicly
  visible car gets 5. That is 1,485 car images and 122 yards.

`assets/catalog.json` (written by the seed) says what to draw;
`assets/generated/manifest.json` (written by the generator) says what was
drawn, and is what the seed reads to attach it.

### Replacing them with real photography

Drop real files into `assets/generated/` over the placeholders — same
folder and file name, e.g. `cars/<vehicleId>/01-hero.jpg`, or edit
`manifest.json` to point at new files — then run
`db:seed:promo --refresh-media`. The manifest lists every car's shots in
gallery order with a label (`Side profile`, `Dashboard`, `Boot`…).

---

## 3. The walkthrough — `npm run capture`

`scripts/capture.mjs` signs in, clicks and types through the real app and
saves a still at every meaningful moment, plus the on-screen position of
everything it clicks (for the cursor). Desktop runs at 1440×810 CSS pixels
at a device scale of 8/3, so every still is a native 3840×2160 frame; mobile
runs at 390×844 at 3×. Long pages are captured as scrolled viewport tiles
rather than one enormous screenshot.

It reports, and writes to `recordings/<device>/capture.json`, any console
error, failed request or broken image it saw. The current capture is clean.

Off-site requests are blocked during the capture: the local environment
cannot reach Google, and the dealer page's embedded map would otherwise hang
the page. For that reason the film never frames the portfolio's map panel.

**Run the promo seed immediately before a capture** — the capture sends a
real enquiry and reserves a real car, and the seed puts both back. The OTP
endpoints are rate-limited per IP (`PHONE_OTP_RATE_LIMITED`); after several
takes in a row, restart `apps/api` (with `CACHE_DRIVER=memory` the limiter
lives in the process) before capturing again.

```bash
pnpm --filter @dealers-drive/api db:seed:promo && npm run capture
pnpm --filter @dealers-drive/api db:seed:promo && npm run capture:mobile
npm run capture -- --scene=enquiry,console      # just some scenes
```

---

## 4. Composing and exporting — `npm run render:*`

`film/timeline.mjs` is the edit: every clip, its stills, camera moves, cursor
path, clicks, lower thirds and narration timing. `film/stage/` is a small
HTML compositor; `scripts/render-film.mjs` loads it in Chromium, asks for
each frame in turn (so timing is exact, never dependent on how fast a
machine renders), and pipes the frames into ffmpeg/x264. Frames are split
across workers and the segments joined losslessly.

```bash
npm run preview -- --every=2.5            # stills of the edit, for checking
npm run render:4k                         # 3840×2160, 30 fps
npm run render:1080p                      # scaled from the 4K master
npm run render:vertical                   # 1080×1920, from the mobile capture
npm run render:square                     # 1080×1080
npm run render:all
```

Captions are burned in (the film is silent until narration is recorded);
`--no-captions` renders a clean version with the lower-third titles only.
Each render also writes its `.srt` beside it.

### Adding narration and music

The film is delivered silent with burned-in captions. When a recorded
voice-over and a licensed music track are available:

```bash
# assets/audio/voiceover.wav — read from film/narration.md, timed to the .srt
# assets/audio/music.wav     — a track licensed for promotional use
npm run mix -- --in=exports/dealers-drive-promo-4k.mp4
```

`scripts/mix-audio.sh` ducks the music under the voice, normalises to
−14 LUFS and writes `…-mixed.mp4`. Record the track's licence in
`film/assets-and-licences.md` before publishing.

---

## Which parts are marketing-only

| Path                                       | What it is                              |
| ------------------------------------------ | --------------------------------------- |
| `marketing/dealers-drive-promo/**`         | everything in this folder               |
| `apps/api/prisma/seed/dev-promo.ts`        | the dev-only demo seed and media loader |
| `apps/api/prisma/seed/dev-promo.data.ts`   | its data                                |
| `db:seed:promo` in `apps/api/package.json` | the script that runs it                 |

## Production is unaffected

- No file under `apps/*/src` or `packages/` was changed. Upload, storage,
  auth, listing lifecycle, enquiries and moderation run exactly as before.
- The promo seed is not part of `db:seed`, is not called by tests or CI,
  refuses production and non-local databases, and is not imported by
  anything the API or web app build.
- The demo images are not in the web app's `public/` folder and are not
  shipped with any build; they exist only in a local database's storage.
- This folder is outside `pnpm-workspace.yaml`, so its one dependency
  (`playwright-core`) never enters the product lockfile.
