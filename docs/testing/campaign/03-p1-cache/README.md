# Fix 3 — BUG-NEW-010 (P1) cached car page public after suspension

Root cause: a car page's fetch is tagged `vehicles` + `vehicle:<slug>`; Admin dealer
decisions revalidated only `dealers` + `dealer:<slug>`. Next 15's data cache stores a
fetch only when it answers 200 (`patch-fetch.js`: `res.status === 200`), so after the
API started answering 404 the background refresh was discarded and the warmed 200
was served indefinitely.

| Run | Path | Car page after suspend | After 65 s | Verdict |
| --- | --- | --- | --- | --- |
| `probe-main.json` | Admin console Suspend button, main's action | 200, 200 | 200, 200 | FAIL |
| `probe-fix-branch.json` | Admin console Suspend button, fix branch | 404, 404 | 404, 404 | PASS |

`probe.mjs` reproduces it end to end (real `next start` build, real server action,
simulated admin session). Unit red/green: `unit-red-on-main.txt` (6 failed) and
`unit-green-on-fix.txt`.

Residual (documented in `docs/code/web/features/admin.md`): any future write that removes
a car from public view outside a web action — e.g. the reserved, not yet implemented
`listings.expire-sweep` job — must also reach a tag revalidation. Tracked as
OBS-STALE-404 (P3).
