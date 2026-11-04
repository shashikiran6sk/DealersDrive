# reels / components

Parent: [reels](README.md)

The scenes follow the web app's folder-per-component layout (**AGENTS.md §4b**).
They are video frames, not web UI, so they have no Storybook entry: Remotion
Studio (`pnpm --filter @dealers-drive/reels studio`) is their sandbox.

## `apps/reels/src/reel/reel.constants.ts`

### `export const SAFE_AREA`

Instagram and WhatsApp draw their own controls over a reel: the caption and
buttons over roughly the bottom 400 px of a 1920 px frame and the progress and
account row over the top 200. Nothing a viewer has to read is placed there.

### `export const COLORS`

The site's monochrome palette from `apps/web/src/styles/globals.css`, so a reel
reads as Dealers-Drive. `photo` is `#f6f6f6`, the exact background of every
listing photograph (they are cut-out studio shots); the car scenes are painted
that colour, so the photo's edge is invisible and the car stands on a seamless
stage.

## `apps/reels/src/components/car-scene/car-scene.tsx`

### `export function CarScene({ car, position, total, duration }: CarSceneProps)`

The model year is drawn large and outlined behind the car. The photograph is
opaque, so it is composited with `mix-blend-mode: darken`: its light background
lets the year through, and the car — darker than the outline everywhere — stays
in front of it.

## `apps/reels/src/components/brand-mark/brand-mark.tsx`

### `export function BrandWordmark({ tone, height }: BrandMarkProps)`

The wordmark and icon are imported from `apps/web/public/brand` rather than
copied, so a rebrand of the site is a rebrand of the reels on the next render.

## `apps/reels/src/fonts.ts`

### `export function loadFonts(): void`

Manrope is the site's typeface; Noto Sans Tamil covers the Tamil lines. Both come
from `@fontsource` packages and are bundled, so rendering needs no network. A
frame must not be captured before a face has loaded, or the first frames fall
back to Arial, so rendering is held with `delayRender` until every weight has
loaded, and fails outright if one cannot.
