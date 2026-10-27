---
name: dealers-drive-car-promo
description: Create the approved vertical and horizontal vehicle promo videos from Dealers-Drive /car/ listing URLs, including bare URL-only requests in this project. Use for car promo production, not listing questions, app debugging, or implementation plans.
---

# Dealers-Drive car promos

For a URL-only message containing `dealers-drive.com/car/<slug>` links, create the video pair for each eligible listing. Honour explicit requests for planning, information or app changes instead of rendering just because a URL appears.

Use the script-backed workflow in `marketing/dealers-drive-vehicle-series` relative to this repository root. The approved defaults are 20 seconds, 60 fps, vertical 1080 × 1920 and horizontal 1920 × 1080, with the existing typography, branding, motion and original score. No additional style approval is needed for this established format. Follow explicit user changes to the brief rather than silently overriding them with defaults.

## Workflow

1. Work from the repository checkout. Set the shell working directory to `marketing/dealers-drive-vehicle-series`. Run `node promo.mjs doctor`; if dependencies are missing, run `npm ci --ignore-scripts`, then `node promo.mjs doctor --install`. Use normal execution permissions for network/browser/tool setup; do not change production configuration.
2. Run `node promo.mjs prepare '<URL>'` with all requested URLs as separate arguments. Comma/newline-separated lists are accepted. This reads the public vehicle API, with a browser fallback, and creates an isolated job. Read the returned JSON. Report skipped reserved/sold/missing listings or source failures; continue eligible cars. If there are no eligible cars, return those reasons without rendering.
3. Inspect every returned gallery contact sheet with the image-viewing tool. Choose only actual photographs of that vehicle. Do not assume photo numbers correspond to particular angles. For each car needing selection, run:

   ```sh
   node promo.mjs select <job-id> --car <slug> --roles '{"hero":1,"front":3,"rear":5,"side":4,"oppositeSide":6,"dashboard":8,"frontSeats":7}'
   ```

   These numbers are an example, not a default mapping. Use the current contact sheet. Available roles are `hero`, `front`, `rear`, `side`, `oppositeSide`, `dashboard`, `frontSeats`, `rearSeats`. The engine stores choices by image hash and can reuse them after gallery reordering. Choose a clean exterior hero; omit unsupported roles. Exclude instrument clusters, unrelated imagery, placeholders and poor shots. Never invent an angle, interior, vehicle feature, price or ownership claim. Missing cabin coverage gets a truthful exterior alternative. If image identity is unclear, inspect the original image before selecting it; request clarification only when essential source identity cannot be established.

4. Run `node promo.mjs preview <job-id>`. Inspect both orientation contact sheets for correct car identity, photo selection, readable price/specifications, full-vehicle framing, clean text and branding. Fix photo selections and rerun preview if needed. Automated checks reject covered/clipped headlines and broken images. The renderer uses manufacturing year, not a later registration year, and omits missing optional details.
5. Run `node promo.mjs render <job-id>`. It produces and fully verifies both files for each car. Rerunning this command resumes valid completed orientations and repairs incomplete ones; do not delete earlier jobs. Unchanged verified outputs can be reused only when the data, photo choices, template, branding and settings match.
6. Run `node promo.mjs deliver <job-id>`. It rechecks current availability, prices and gallery before releasing links. If it reports `STALE`, repeat prepare/selection/preview/render/deliver once for the original URL set; valid unchanged renders can be reused. If the source remains unstable, report the specific issue instead of looping or presenting old available-car ads as current. A source error is not permission to invent data.
7. Return two clickable local MP4 links per car, labelled Vertical and Horizontal. For multiple cars, include the ZIPs and index returned by deliver. Include any skipped/error reasons. Do not claim completion unless deliver succeeds. Fixture outputs are clearly labelled tests and must not be presented as live vehicle ads.

Public listing reads and local marketing artifacts are the scope. Do not sign in, submit enquiries, modify listings or publish to social platforms as part of this skill. Keep downloaded photos, previews, reports and movies in the ignored job directory. See the pipeline README for CLI details and recovery.
