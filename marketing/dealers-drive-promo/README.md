# Dealers-Drive promotional film

A 111-second product film made from the actual Dealers-Drive application, with original generated photography, synthetic narration and an original music score.

## Deliverables

- `exports/dealers-drive-promo-4k.mp4` — 3840×2160, 16:9, 30 fps
- `exports/dealers-drive-promo-1080p.mp4` — 1920×1080, 16:9, 30 fps
- `exports/dealers-drive-promo-vertical-9x16.mp4` — 1080×1920, 30 fps
- `exports/dealers-drive-promo-social-4x5.mp4` — 1080×1350, 30 fps
- `narration.md`, `dealers-drive-promo.srt`, `scene-list.md`
- `AUDIT.md`, `LICENSES.md`, `asset-inventory.json`
- `assets/` — 41 vehicle photographs, 6 dealership photographs, a separate cinematic opening photograph, voiceover WAVs, original music and Manrope font

Exports and raw recordings are local build artifacts, ignored by Git. Preserve or distribute them separately from source control. The generated source media and scripts are intended to be retained with the project.

## Isolation and production behavior

**All added files are inside this marketing directory. No production application source, schema, authentication, upload, listing, enquiry or moderation code is changed.** The normal development seed is also unchanged.

The promotional database is named **`dealersdrive_promo`**, on loopback PostgreSQL only. Preparation resets that database's fixture rows. It never resets the ordinary `dealersdrive` database. The seed rejects production, remote hosts, other database names and non-local storage. There is no remote override. `scripts/environment.test.mjs` checks these boundaries.

The app runs with its existing fake development OTP driver, cookie sessions, local storage, memory cache and console mail driver. Background jobs are disabled. It uses ports **4300** (web) and **4301** (API). Don't run a second Next.js dev process against the same `apps/web/.next` directory while recording.

Stored media goes to `.storage/demo/`, with normal Media/VehicleMedia relations and 320/640/1024/1600 WebP derivatives. The API's existing storage adapter serves it through the normal media route. Production uploads are unaffected and production never imports these fixtures. No AI image request occurs at runtime or during reset.

## Setup and reset

Prerequisites: repository dependencies installed, generated Prisma client, migrated development tooling, Node 24+, pnpm 9, Chrome, and the repository's local PostgreSQL service running on port 5432. Local database credentials match the repository's Docker development service (`dealersdrive`).

From this directory:

```sh
pnpm install --ignore-workspace
node scripts/run.mjs prepare
```

`prepare` creates the dedicated database if missing, applies existing migrations and loads the deterministic media/fixture mapping. The reset yields 12 public cars across 6 dealerships, a separate editable draft, Arjun's customer account, dealer owner accounts and a new-dealer onboarding fixture. IDs, galleries and slugs remain stable between resets. Development contacts use sample numbers and `example.invalid` emails.

Start the application in two terminals:

```sh
node scripts/run.mjs api
```

```sh
node scripts/run.mjs web
```

Open `http://localhost:4300` for the promotional environment. The regular dev banner remains visible there. The capture script hides only that banner and the Next.js development indicator in its private browser context.

## Record the actual walkthrough

With both servers running:

```sh
node scripts/record.mjs
```

This resets the isolated database before **each** format, then runs the same customer-to-dealer story using separate responsive layouts. It records actual screenshots during browser interactions, waits for loading, checks broken images and records JavaScript/API errors. Browser chrome is never captured. Authentication setup uses the existing local phone sign-in endpoint; no session token is manually invented.

To record just one format:

```sh
node scripts/record.mjs landscape
node scripts/record.mjs vertical
node scripts/record.mjs social
```

Don't run these simultaneously: each reset intentionally restores the shared promotional story. `recordings/<format>/` contains timestamped frames, FFconcat timing, end screenshots and `qa.json`. Intermediate latency is removed by editorial retiming to the fixed scene durations. The custom capture cursor follows deliberate eased movement.

The onboarding fixture begins after Google identity linking and phone verification. The recorded account, business and document screens are real. The film does not stage a Google login, upload fake government identification or suggest a new dealer is automatically approved. See `AUDIT.md` for the implemented flow and filming boundaries.

## Rebuild the edit

The checked-in audio and image assets require no network or AI service to render.

```sh
node scripts/plates.mjs
node scripts/supporting-assets.mjs
node scripts/render.mjs landscape
node scripts/render.mjs vertical
node scripts/render.mjs social
```

The landscape command produces both 4K and 1080p. Title plates use Manrope and the product's restrained monochrome palette. Screens are placed inside editorial frames without cropping their controls. Portrait and 4:5 versions use separately recorded responsive application views.

Landscape capture uses a 1440×760 CSS viewport at 2× pixel density (2880×1520 source pixels). The UI is modestly scaled into the 4K composition; this is not a claim of native 3840-wide browser footage. Portrait uses 440×660 CSS pixels at 2×; social uses 760×780 at 2×. Capture timing is variable, typically around 10–15 screen updates per second; exports are constant 30 fps. Static UI holds retain sharp text. Generated photographs are 1672×941 source images. The 4K frame and typography are rendered at 4K.

Music stays underneath normalized narration. External SRT captions are supplied for accessible playback or platform upload. Caption sentence timings are estimated within each measured voiceover segment; they are not word-level forced alignment.

## Regenerating source assets

Photography was generated once with OpenAI's built-in image generation tool, then stored locally. Exact per-image prompts, dimensions, hashes and generation references are in `asset-inventory.json`. Later gallery views were generated with their hero image as a visual reference. Reset/rebuild uses the stored files, so it is deterministic; asking an image model to regenerate them is not pixel-deterministic. No Cars24 or other marketplace images were copied.

The 2026-09-30 photography revision uses a consistent seamless white studio with soft contact shadows across all 12 cars and their galleries. Card heroes face right in an approximately 45-degree front three-quarter view. Rear, side and detail views retain their useful viewing angles. Interiors retain the cabin while replacing visible outdoor surroundings with white studio surroundings. Exact edit prompts and references are in `studio-generation.json`; hero framing refinements are also recorded in `hero-framing-generation.json`. Wider white margins keep complete vehicles visible in the portfolio’s 4:3 frame. Vehicle media IDs and storage keys include the deterministic `white-studio-v2` revision and an image content hash to avoid stale image caches. Dealership yard imagery and the separate cinematic opening photograph retain their original settings.

To regenerate audio only:

```sh
node scripts/voice.mjs
node scripts/music.mjs
node scripts/supporting-assets.mjs
```

Voice generation downloads the Apache-2.0 Kokoro ONNX model on first use. It runs locally thereafter. Music is synthesized deterministically from source, with no third-party recording or sample. Licensing and attribution are in `LICENSES.md`.

## Verification

```sh
node --test scripts/environment.test.mjs
node scripts/contact-sheet.mjs landscape
node scripts/contact-sheet.mjs vertical
node scripts/contact-sheet.mjs social
node scripts/run.mjs verify
node scripts/verify-exports.mjs
node scripts/review-frames.mjs
```

`QA.md` records the completed checks and any practical limits. Never publish the fictional generated inventory as real vehicle stock. The promotional environment and media exist to illustrate the actual product experience.
