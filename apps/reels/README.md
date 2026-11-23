# @dealers-drive/reels

20-second promo reels (1080×1920, 30 fps, MP4) for every dealership on
Dealers-Drive with live inventory, rendered with [Remotion](https://www.remotion.dev).

Each reel, in English and Tamil:

| Time       | Scene                                                                          |
| ---------- | ------------------------------------------------------------------------------ |
| 0–2s       | The dealer's name, monogram or logo, town, and verified badge if earned        |
| 2–3.5s     | Services offered                                                               |
| 3.5–15.5s  | Eight featured cars across the price range, 1.5s each                          |
| 15.5–17.5s | A mosaic of the stock, cars available ("15+" from ten up), and the price range |
| 17.5–20s   | A QR code to the dealer's page, the Dealers-Drive wordmark, the prices' date   |

Every reel carries a generated 120 BPM soundtrack, with the beat dropping at 2s
and a whoosh on every cut. `--music <file>` swaps in your own track and
`--silent` renders without sound.

The reel never shows a phone number. Why each choice was made is in
[`docs/code/reels`](../../docs/code/reels/README.md).

## Render

Each render writes three files per dealer to `apps/reels/out/`: the reel
(`<slug>.mp4`), its Instagram caption (`<slug>.instagram.txt`), and its YouTube
Short title and description (`<slug>.youtube.txt`, title on the first line).

```bash
pnpm --filter @dealers-drive/contracts build
pnpm --filter @dealers-drive/reels render
pnpm --filter @dealers-drive/reels render -- --dealer aishwaryas-autos-vellore-tamil-nadu
pnpm --filter @dealers-drive/reels render -- --music ./track.mp3 --as-of 2026-11-04
pnpm --filter @dealers-drive/reels render -- --dealer <slug> --feature creta --feature brv
```

The eight featured cars are picked automatically, spread across the price range
with each model shown once. `--feature` (repeatable, up to eight) hand-picks
them instead, by model name or car slug.

Reels are written to `apps/reels/out/<dealer-slug>.mp4`. `--help` lists every
option. Set `REELS_BROWSER_EXECUTABLE` to an existing Chrome headless shell to
stop Remotion downloading its own.

## Preview and adjust

```bash
pnpm --filter @dealers-drive/reels render -- --dealer <slug> --props-only
pnpm --filter @dealers-drive/reels studio -- --public-dir=.cache/public --props=.cache/props/<slug>.json
```

Without `--props`, Studio opens on a sample dealership.
