# #304 — dealer photos in the hero gallery; briefer documents page

Head `a481a03`. Local development database only (photos are synthetic UAT fixtures).

| Check | Result |
| --- | --- |
| Web tests | 1,674 passed (141 files) |
| Lint · typecheck · Prettier · docs check · web build | green |

## Browser (`checkgal.mjs`)

| Check | 1280 px | 390 px |
| --- | --- | --- |
| "Photos of the dealership" row | gone | gone |
| Hero counter | 1 / 3 · view all | 1 / 3 · view all |
| Next arrow / swipe left | 2 / 3 | 2 / 3 (viewer not opened by the swipe) |
| Click opens full-screen viewer with caption | yes | yes |
| Horizontal overflow | none | none |
