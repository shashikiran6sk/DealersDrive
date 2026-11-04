# @dealers-drive/reels

20-second promo reels (1080×1920, 30 fps, MP4) for every dealership on
Dealers-Drive with live inventory, rendered with [Remotion](https://www.remotion.dev).

Each reel, in English and Tamil:

| Time      | Scene                                                                            |
| --------- | -------------------------------------------------------------------------------- |
| 0–2.5s    | The dealer's name, monogram or logo, town, and verified badge if earned          |
| 2.5–4.5s  | The services the dealer offers                                                   |
| 4.5–14.5s | Four featured cars across the price range: photo, year, title, price, specs      |
| 14.5–17s  | A mosaic of the stock, the number of cars available, and the price range         |
| 17–20s    | A QR code to the dealer's page, the Dealers-Drive wordmark, and the prices' date |

The reel never shows a phone number. Why each choice was made is in
[`docs/code/reels`](../../docs/code/reels/README.md).

## Render

```bash
pnpm --filter @dealers-drive/contracts build
pnpm --filter @dealers-drive/reels render
pnpm --filter @dealers-drive/reels render -- --dealer aishwaryas-autos-vellore-tamil-nadu
pnpm --filter @dealers-drive/reels render -- --music ./track.mp3 --as-of 2026-11-04
```

Reels are written to `apps/reels/out/<dealer-slug>.mp4`. `--help` lists every
option. Set `REELS_BROWSER_EXECUTABLE` to an existing Chrome headless shell to
stop Remotion downloading its own.

## Preview and adjust

```bash
pnpm --filter @dealers-drive/reels render -- --dealer <slug> --props-only
pnpm --filter @dealers-drive/reels studio -- --public-dir=.cache/public --props=.cache/props/<slug>.json
```

Without `--props`, Studio opens on a sample dealership.
