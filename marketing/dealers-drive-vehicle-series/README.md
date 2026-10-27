# Dealers-Drive car promo skill

The project skill creates the approved pair of vehicle advertisements from one or more public Dealers-Drive car URLs. A bare car-URL request is the normal skill trigger; explicit invocation is `$dealers-drive-car-promo <URL>`. Questions, planning and app-debugging requests containing URLs retain their stated intent.

Every available car gets a 20-second, 60 fps H.264/AAC pair: vertical 1080 × 1920 and horizontal 1920 × 1080. The renderer preserves the approved photo-led layout and original instrumental score. This is local marketing tooling, outside the production workspace packages.

## Setup

Use Node 24+, Python 3 and Chrome/Chromium. From this directory:

```sh
npm ci --ignore-scripts
node promo.mjs doctor --install
```

The package owns its locked Playwright, Sharp and FFmpeg dependencies. Doctor downloads the official package's encoder and bundled Chromium when needed. Browser/system dependency installation may require the normal execution approvals. CI installs Chromium's Linux dependencies explicitly.

## Workflow

```sh
node promo.mjs prepare 'https://www.dealers-drive.com/car/<slug>'
node promo.mjs select <job-id> --car <slug> --roles '{"hero":1,"rear":5,"dashboard":8,"frontSeats":7}'
node promo.mjs preview <job-id>
node promo.mjs render <job-id>
node promo.mjs deliver <job-id>
```

The role numbers above are examples. The skill inspects the generated contact sheets and supplies the actual selections; users need only provide URLs. The deterministic CLI deliberately does not guess whether a numbered photograph shows a dashboard or a rear exterior. Roles are cached by image hash and gallery identity, so reordering does not swap selections. A new/changed gallery requires visual inspection. Missing cabin coverage uses actual exterior images with suitable copy. No photographs are generated or vehicle details altered.

Prepare reads the same public vehicle contract as the website at `/v1/vehicles/:slug`. The real page is a fallback for transient API failures, not for missing/unavailable listings. Manufacturing year, dealer-set price, kilometre figure, transmission, fuel and ownership come from that source; absent optional values are omitted or displayed as price on request. Nothing is inferred from a registration year or URL slug. Reserved/sold/missing listings are reported and other eligible URLs continue.

Every request creates a separate directory under ignored `runs/`, containing source snapshots, content-addressed images, role selections, template/brand snapshots, previews, verification reports and exports. The website's existing brand SVGs and Manrope font are copied read-only into each job; historical galleries and generated videos are not required in the repository. Downloads and job data are not production uploads or database changes.

Preview checks image decoding, text overflow and photograph/headline overlap in both orientations. Inspect the returned proof sheets before render. Render verifies all 1,200 frames, dimensions, codecs, duration and audio levels. Completed orientations survive interrupted reruns; unchanged validated movies can be copied from cache only when input data, chosen images, template, branding, dependencies and settings match. Corrupt or mismatched receipts are not reused. Partial movie files are never delivered.

Deliver rereads current facts and gallery bytes, checks output hashes, and rejects stale or changed output. The skill retries a stale source by preparing the original URL set once, reusing unchanged results; it reports persistent instability instead of looping. For one car, it returns two MP4 links. Multiple cars also receive CRC-checked orientation ZIPs, a complete ZIP and an index. This workflow does not post to social platforms or change the live application.

## Validation

```sh
npm test
npm run test:smoke
```

Fast tests cover URL scope, read-only access, bounded retries, unavailable cars, year/price conflicts, missing optional data, image-identity mapping, reordered galleries, fingerprint invalidation, source tampering and job isolation. The offline smoke run renders full-length examples in both formats, verifies one- and two-URL deliveries, repairs an incomplete orientation, checks cache reuse, and blocks a changed-price delivery. It generates small labelled illustrations at runtime; fixture films are visibly marked **TEST FIXTURE**, not represented as real inventory. CI publishes these test proof sheets and movies as artifacts.

For a network-free skill evaluation, create fixtures with the test helper and pass `--fixture <directory>` to prepare. The job retains that explicit fixture adapter for subsequent phases; it never falls back to production reads. Normal live requests do not use fixture mode. `PROMO_RUNS_DIR` may set a separate local run/cache directory for evaluation.

After implementation, test discovery/behaviour in a fresh project session using a bare URL, explicit skill invocation, multiple URLs and a non-promo question. Source/API network permissions still apply normally. A skill description enables automatic selection; it is not a universal URL hook.

## Asset provenance

The actual car photographs are downloaded from the user's public Dealers-Drive listing for the requested promotion and retained with SHA-256 hashes. Existing app brand SVGs and the app's Manrope font are runtime inputs. The original oscillator-synthesised score is retained as `src/score.py`, with no third-party samples, loops or recordings; it may be used and distributed with Dealers-Drive promotional material. It is generated locally, with no AI service or key required. Manrope is Copyright 2018 The Manrope Project Authors, SIL Open Font License 1.1; see `Manrope-OFL.txt`.
