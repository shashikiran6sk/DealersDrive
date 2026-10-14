# web / components/ui/photo-gallery

Parent: [web/components/ui](README.md)

The one photo gallery in the product. It was `VehicleGallery` in
`components/vehicle/vehicle-gallery/`; when the dealer page's hero became a
gallery too, the generic parts moved here unchanged and the car page and the
dealer page now render the same component. It lives in `components/ui/`
because nothing in it knows what is being photographed: a photo is
`{ url, alt, caption? }`, which `PublicVehicleImage` satisfies as it is and the
dealer page builds from its approved portfolio.

## `apps/web/src/components/ui/photo-gallery/photo-gallery.tsx`

### `export function PhotoGallery({ title, photos, startIndex, strip, stageClassName, emptyLabel }: PhotoGalleryProps)`

DESIGN-SPEC §2.9/§2.10 as the legacy gallery drew them (**R49**, F083): a
`.blueprint` stage with its four corner marks, the 108px thumbnail strip under
it, and the fullscreen viewer. R48 had replaced the strip and the rail with
arrows on the main image; R49 put the spec's gallery back, because that is what
the product is meant to look like.

The gallery starts on `startIndex` — the car page passes the admin's primary
photograph — and falls back to the first when the index is out of range or not
a whole number. It opens the viewer on itself; a thumbnail opens it on that
thumbnail.

**One `index`, for everything (R87).** The stage shows `photos[index]`, and its
Previous image / Next image arrows call the same `step` the viewer's arrows,
←/→ keys and swipes call — so they wrap exactly as the viewer does, because
they are the same function. The strip marks `photos[index]` (`aria-current`,
the accent ring), the viewer opens on it, and whatever the viewer is left on is
what the page shows when it closes. There is no second index anywhere to drift
out of step. The arrows are siblings of the stage's button, not children — a
button inside a button is invalid, and a click on an arrow must never open the
viewer — and they are drawn only when there is more than one photograph, as
the viewer's are.

**The tag says where you are.** With several photographs it reads
`2 / 5 · view all` and follows the arrows and swipes; with one it reads
`1 photo · view`. The car page's tag used to be a fixed `5 photos · view all`.
Once a stage can be stepped in place, the position is the more useful fact, and
"view all" stays because on a phone there is no zoom cursor to say that a tap
opens the viewer. The button's accessible name is unchanged
(`View all 5 photos of …`), so the count is still announced.

**Two options, both for the dealer hero.** `strip` (default `true`) drops the
thumbnail strip: the dealer page's hero is a banner across the page, and a
strip of up to eight thumbnails under it would push the dealership's details
below the fold. `stageClassName` (default `aspect-[4/3]`) sets the stage's
proportions — the car keeps 4:3, the dealer hero keeps its 440px / 340px /
16:9 banner — and the empty frame takes the same proportions, so a page with
no photographs is laid out exactly as one with them. `emptyLabel` names the
missing shot in that frame (`ImageSlot`).

Several controls open one dialog, so none of them can be its Radix trigger.
The gallery remembers which one was pressed and hands focus back to it in
`onCloseAutoFocus` — the legacy lightbox's "focus returns to the exact opener".

**Loading.** Only the stage photograph is fetched eagerly, and only the one
the page opens on is `fetchPriority="high"`: it is the largest thing above the
fold on both pages. After a step the stage asks at normal priority, and every
thumbnail in the strip and the rail is `loading="lazy"`.

**A broken photograph is skipped, once (R118).** The stage `<img>` reports
`onError`, and the gallery remembers the URL in a set that only grows; every
part of it — stage, strip, viewer, counts — works from the photographs that
have not failed. An image that had already failed before React hydrated fires
no `onError`, so an effect also checks `complete && naturalWidth === 0` on the
stage photograph. With nothing left, the gallery draws `GalleryFallback`.

### `fallback?: GalleryFallbackImage`

When the gallery has nothing it can show, `GalleryFallback` draws the empty
frame (same `stageClassName`, so nothing shifts). Given a `fallback`, it shows
that image there with `emptyLabel` as a tag; without one, or once the fallback
image has failed too, it shows the `ImageSlot` labelled `emptyLabel`. That is
the end of the chain: the slot is not an image and cannot fail, so there is no
fallback loop. The fallback is a `next/image` with `fill`, `priority` (it is
the largest thing above the fold when it shows) and `unoptimized`, as an SVG
has nothing for the optimiser to do. The car page passes no fallback and keeps
its slot.

## `apps/web/src/components/ui/photo-gallery/use-swipe.ts`

### `export function useSwipe(onStep, enabled): SwipeHandlers`

A horizontal swipe on the stage and on the viewer's photograph steps through
the photographs (left is next). It is pointer events, not touch events, and
only for touch and pen: a mouse already has the arrows, and a mouse drag on an
image is the browser's own image drag.

- **40px, and more across than down** (`swipeStep` in `utils.ts`). Anything
  shorter is a tap; anything steeper is the start of a scroll.
- **Vertical scrolling still works.** Both surfaces are `touch-action: pan-y`
  (`touch-pan-y`), so the browser keeps the vertical pan and hands the
  horizontal movement to the page. When the browser does take a gesture over
  it sends `pointercancel`, and the swipe is forgotten.
- **A swipe never opens the viewer.** The stage is a button, and a touch that
  ends on it can still produce a click. After a swipe, a click in the next
  500ms is swallowed in the capture phase, before it reaches the button or an
  arrow; the next `pointerdown` clears the guard, so a real tap afterwards
  always works.
- A single photograph is not swipeable at all, so a tap on it is never
  mistaken for one.

## `apps/web/src/components/ui/photo-gallery/gallery-strip.tsx`

### `export function GalleryStrip({ photos, index, onOpen }: GalleryStripProps)`

§2.9's strip. The track is `.dd-strip` — it scrolls on its own, with no
scrollbar, and `min-width: 0` keeps it inside the column so the page never
scrolls sideways. The ‹ › arrows scroll it ±240px and disable at either end,
measured on scroll and on resize. They are 30px from 768 up and 44px below,
the touch minimum §4.15 sets; the strip's side padding grows with them. Thumbs
are 108px, 88px on a phone.

When `index` moves (R87), the strip scrolls the current thumbnail into view —
horizontally only, by `revealOffset` in `utils.ts`, with the same `scrollBy` its
arrows use. `scrollIntoView` would also have scrolled the page to reach a strip
below the fold, which is not what pressing an arrow on the image above it
asked for. It does nothing on first render or when the thumbnail is already in
view.

## `apps/web/src/components/ui/photo-gallery/gallery-viewer.tsx`

### `export function GalleryViewer(...)`

§2.10's lightbox, on `Dialog variant="fullscreen"` rather than the legacy
hand-rolled overlay: Radix gives the focus trap, Escape and the scroll lock,
which the legacy overlay wrote by hand. The header is the spec's — the mono
`DD` chip, the title (the dialog's name), the `2 / 11` counter (its
description, in the `inverse` tone) and a `Close ✕` button. Focus lands on
Close when it opens, as the legacy one did.

The stage frame is `#151a23`, 4:3, at most 1100px wide, and never taller than
the viewport leaves (`100dvh` less the header and padding, times 4/3). The
photograph is `object-contain` inside it: a portrait shot is pillarboxed, never
cropped or stretched. ← and → page while it is open, wrapping at both ends, and
so does a swipe on the stage.

The line under the stage is the photograph's **caption** when it has one, and
its alt text when it does not (`captionOf`), announced as it changes. A car
photograph has no caption, so the car page reads exactly as before; a dealer's
captioned photograph shows the dealer's own words rather than the alt text
built around them. Captions are typed by dealers, so the line wraps anywhere
rather than overflowing.

## `apps/web/src/components/ui/photo-gallery/gallery-rail.tsx`

### `export function GalleryRail({ photos, index, onSelect }: GalleryRailProps)`

§2.10's rail: 132px wide, 84px on a phone, one 4:3 cell per photograph with a
two-digit number in the corner, the current one outlined in the accent and
marked `aria-current`. The current cell scrolls itself into view whenever the
index changes, however it changed.

## `apps/web/src/components/ui/photo-gallery/gallery-arrow.tsx`

### `export function GalleryArrow({ direction, label, onClick, placement, disabled }: GalleryArrowProps)`

One `.dd-arrow` for both places §2.9/§2.10 draw it: `strip` at the ends of the
thumbnail strip, `stage` inset 14px either side of the stage photograph at
38px on white at 90%. Both grow to 44px below 768.
