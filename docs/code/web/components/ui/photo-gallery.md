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

### `export function PhotoGallery({ title, photos, startIndex, strip, stageClassName, emptyLabel, fallback, variant }: PhotoGalleryProps)`

DESIGN-SPEC §2.9/§2.10 as the legacy gallery drew them (**R49**, F083): a
`.blueprint` stage with its four corner marks, the 108px thumbnail strip under
it, and the fullscreen viewer. R48 had replaced the strip and the rail with
arrows on the main image; R49 put the spec's gallery back, because that is what
the product is meant to look like.

The gallery starts on `startIndex` — the car page passes the admin's primary
photograph — and falls back to the first when the index is out of range or not
a whole number. It opens the viewer on itself, and only on itself: a thumbnail
selects, it does not open (see the strip below).

**One `index`, for everything (R87).** The stage shows `photos[index]`, and its
Previous image / Next image arrows call the same `step` the viewer's arrows,
←/→ keys and swipes call — so they wrap exactly as the viewer does, because
they are the same function. The strip marks `photos[index]` (`aria-current`,
the accent ring) and a click on a thumbnail sets it, the viewer opens on it, and whatever the viewer is left on is
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

**Only the stage opens the viewer.** Until the thumbnail change, every strip
thumbnail opened it too: `GalleryStrip` called `onOpen`, which was `openAt`
(set the index, then open). That was the wiring, not a click bubbling up — the
strip is a sibling of the stage, never inside it — so the fix is the wiring:
the strip now takes `onSelect` (`setIndex`) and nothing it renders can open the
dialog. A buyer comparing photographs stays on the page, and fullscreen is one
deliberate press on the photograph itself.

The stage is not the dialog's Radix trigger (the dialog is controlled), so the
gallery remembers the element that opened it and hands focus back to it in
`onCloseAutoFocus` — the legacy lightbox's "focus returns to the exact opener".
Today that element is always the stage button.

**The position is announced.** With several photographs a visually hidden
`aria-live="polite"` line reads `Photo 4 of 8` and follows the index. The
stage button's accessible name is the constant "View all 8 photos of …", so
without it a screen reader would hear nothing when an arrow or a thumbnail
changes the photograph. Radix hides the page while the viewer is open, so the
line never talks over the viewer's own caption.

**Loading.** Only the stage photograph is fetched eagerly, and only the one
the page opens on is `fetchPriority="high"`: it is the largest thing above the
fold on both pages. After a step the stage asks at normal priority, and every
thumbnail in the strip and the rail is `loading="lazy"`.

**A broken photograph is skipped, once (R118).** The stage `<img>` and every
strip thumbnail report `onError`, and the gallery remembers the URL in a set
that only grows; every part of it — stage, strip, viewer, counts — works from
the photographs that have not failed. A thumbnail used to show the browser's
broken-image icon until the stage reached it. Removing a photograph must not
move the selection, so `markFailed` passes the removed position through
`indexAfterRemoval`: one before the selected photograph shifts the index down
by one, so the same photograph stays on the stage; the selected one itself
leaves the index where it is, so the next photograph takes its place, as the
stage always did. Two failures inside one render can adjust against the same
stale list; the worst case is a selection one photograph off, never a crash. An image that had already failed before React hydrated fires
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

### `variant?: PhotoGalleryVariant` — `'cover'` (default) or `'studio'`

**The car page floats its StudioCar exteriors on the page.** Every vehicle
photograph is a StudioCar output, and StudioCar's default background,
Premium White / Plain, is a flat `#F5F5F5` PNG
(`workers/image-processing/assets/backgrounds/premium-white-plain.png` in
StudioCar). Its lossy WebP encoder rounds that to **`#F6F6F6`** at every
quality, and that is what reaches the browser — the API serves the stored file
and re-encodes nothing. So the photograph is a light-grey rectangle, and on a
white page no stage colour can hide it: a `#F6F6F6` stage only moves the edge
from the photograph to the stage.

`'studio'` therefore does three things, and `'cover'` none of them (the dealer
hero keeps `'cover'`):

- **The stage is the page colour, with no border.** `border-0` overrides the
  `.blueprint` border (utilities outrank the components layer) and the stage
  is `bg-(--color-page)`. The corner marks stay hidden by `.blueprint`.
- **The photograph is `object-contain`.** `object-cover` cropped StudioCar's
  framing — a 1704 × 1446 front view lost its shadow's tail in a 4:3 stage, a
  16:9 photograph a sixth of each side. Contained, nothing is cropped; the
  pillarbox is the page colour.
- **The backdrop is mapped to white at display time.** `StudioWhiteFilter`
  is one hidden SVG `<filter>` with an `feComponentTransfer` lookup table on
  R, G and B (`studioWhiteTable` in `utils.ts`), and the stage `<img>` points
  `filter: url(#…)` at it. The table is the identity up to the knee (216),
  rises linearly to white at the backdrop (246), and is white above it. The
  car's body, glass and tyres sit below the knee and are untouched; the
  shadow's soft tail sits in the band and keeps its gradient into white; the
  backdrop and anything brighter becomes white. The table has 86 points, one
  every three levels, so 216 and 246 are exact breakpoints.
  `color-interpolation-filters="sRGB"` is load-bearing: the default,
  `linearRGB`, would apply the table to linearised values and move the knee.
  The stored image, and StudioCar, are not changed.

**Only StudioCar photographs are whitened.** The public image has only `url`
and `alt` — nothing says which shot is an exterior on the backdrop — so the
gallery looks. `classifyPhoto` draws the loaded stage photograph onto a
16 × 16 canvas and `cornerKind` reads its four corners: all four within ±3 of
246 is `'studio'`, anything else `'photo'`. A `'photo'` (an interior, a
photograph not taken on the backdrop) is shown exactly as stored. The answer
is remembered by URL, so stepping back to a photograph does not flash.

Until a photograph has been read it **is** whitened, because nearly every
vehicle photograph is a StudioCar exterior: whitening by default draws the
server-rendered page right before JavaScript runs, and the cost of guessing
wrong is a photograph that is not StudioCar's having its brightest highlights
(above 216) lifted until it has loaded, by at most nine levels. The opposite
default would flash a grey rectangle on every page before hydration. A
photograph whose pixels cannot be read stays whitened: the canvas is tainted
by a cross-origin image, which is the case in local development (web on
:3000, media on :4000) but not in a deployment, where `MEDIA_BASE_URL` is
`https://<domain>/media` on the page's own origin. `crossOrigin` is not set on
the `<img>` — without CORS headers on `/media` it would stop the photograph
loading at all.

The filter's id is `useId()` with everything but `[A-Za-z0-9_-]` removed
(`studioFilterId`), so it can be named in `url(#…)` without escaping.

**What it rests on.** The backdrop is StudioCar's Premium White / Plain as
delivered. If StudioCar changes that background or its encoder, change
`STUDIO_BACKDROP.level` in `photo-gallery.constants.ts` with it. Premium White
/ Horizon, Grey and Dark have gradients or other colours, are not recognised
by the corner check, and are shown as stored. A transparent or pure-white
export from StudioCar would make the filter unnecessary.

**Not changed.** The thumbnail strip, the viewer (its `#151a23` stage), the
dealer hero and the mobile app's gallery.

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
- **Pinch-zoom still works on the page.** `touch-action: pan-y` on its own
  also switches off pinch-zoom, so for a long time a pinch over the car
  photograph did nothing at all — on a phone, the one place a buyer most wants
  a closer look. The page stage is `touch-pan-y touch-pinch-zoom`
  (`touch-action: pan-y pinch-zoom`): the browser zooms the whole page, as it
  does everywhere else, and blocking that was an accessibility fault
  (WCAG 1.4.4) as much as an annoyance. The viewer's photograph does its own
  zooming instead — see `use-zoom.ts` below.
- **A second finger is a pinch, never a swipe.** A second `pointerdown` while
  a swipe is being tracked forgets the swipe, so the two fingers of a pinch
  that happen to travel 40px sideways do not also page.
- **A swipe never opens the viewer.** The stage is a button, and a touch that
  ends on it can still produce a click. After a swipe, a click in the next
  500ms is swallowed in the capture phase, before it reaches the button or an
  arrow; the next `pointerdown` clears the guard, so a real tap afterwards
  always works.
- A single photograph is not swipeable at all, so a tap on it is never
  mistaken for one.

## `apps/web/src/components/ui/photo-gallery/gallery-strip.tsx`

### `export function GalleryStrip({ photos, index, onSelect, onFailed }: GalleryStripProps)`

§2.9's strip. A thumbnail is a button named `Show photo 3 of 8`; pressing it
(click, Enter or Space) calls `onSelect` and nothing else — the photograph
changes on the stage, focus stays on the thumbnail, and the viewer stays
closed. The cursor is a pointer, not the stage's zoom-in. The selected
thumbnail has the accent border plus a 2px accent ring offset 2px on white,
so it reads at a glance among photographs that are mostly white; the track's
4px padding (`p-1`) is there so the ring is not clipped by the scrolling
track. A hover darkens the border of the others to `--color-neutral-500`. The
ring is a box-shadow, so it never fights the inset blue focus outline. The track is `.dd-strip` — it scrolls on its own, with no
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

**Zoom (`useZoom`).** The frame is `overflow-hidden` and `touch-action: none`
(`touch-none`), so every touch on the photograph comes to the page as pointer
events and the browser neither scrolls nor zooms underneath it; the image
inside is moved by a CSS `transform`. While the photograph is zoomed:

- the swipe is switched off (`useSwipe(onStep, several && !zoomed)`): one
  finger, or a mouse button, drags the photograph instead;
- the arrow keys pan by 80px instead of paging — ← shows more of the left, as
  it would in any image viewer — and the Previous / Next buttons and the rail
  still page, because they say so;
- the cursor is `grab` / `grabbing` rather than `zoom-in`.

`+` / `=` and `-` / `_` step the zoom, `0` resets it, and a key with Ctrl, ⌘
or Alt held is left alone — Ctrl + is the browser's own page zoom, and taking
it would leave a keyboard user with no way to enlarge the header. The zoom
resets on every photograph and every opening: the hook is keyed on
`open:url`, so a buyer who zoomed into a tyre and pressed Next does not land
on the next photograph at 3x, somewhere in its corner. A single photograph
zooms too; it just has nothing to page to.

The line under the stage is the photograph's **caption** when it has one, and
its alt text when it does not (`captionOf`), announced as it changes. A car
photograph has no caption, so the car page reads exactly as before; a dealer's
captioned photograph shows the dealer's own words rather than the alt text
built around them. Captions are typed by dealers, so the line wraps anywhere
rather than overflowing.

## `apps/web/src/components/ui/photo-gallery/use-zoom.ts`

### `export function useZoom(resetKey): Zoom`

Pinch, double tap, wheel and drag for the viewer's photograph, in pointer
events and a `translate3d(x, y, 0) scale(s)` on the `<img>` — no library. The
baseline has none to reuse, and AGENTS.md §6 rules out adding one, but it is
also not much code once the maths is pure functions in `utils.ts` and the hook
only routes events to them.

- **The view is `{ scale, x, y }`**, with `x`/`y` in screen pixels from the
  frame's centre (the `transform-origin`). `zoomAt` keeps the point under the
  cursor, the double tap or the pinch still as the scale changes, which is
  what makes it feel like the photograph is being held rather than scaled
  from its middle.
- **1x to 4x, and never off its own edges.** `clampView` limits the pan to
  `(scale − 1) × size / 2` either way, so a corner of the photograph can reach
  the frame's edge but no further. At 1x it returns the one frozen
  `UNZOOMED` object, so a drag across an unzoomed photograph — which is a
  swipe — sets the same state again and React bails out of the render.
- **Pinch** is the change in distance between two pointers (the scale) and in
  their midpoint (the pan), applied move by move. A pinch that ends below
  1.05x settles back to exactly 1x (`settleView`), because "very slightly
  zoomed" looks like a bug and switches the swipe off for no visible reason.
- **Double tap** toggles between 1x and 2.5x at the tap: two taps within
  300ms and 30px, each under 300ms and 10px of travel. It is read from
  pointer events for every pointer type — mouse included, as a double click —
  rather than from `dblclick`, which iOS Safari does not send for a touch, and
  which Chrome would send _as well_, toggling twice.
- **Wheel** zooms toward the cursor, `scale × e^(−deltaY × 0.002)`. A
  trackpad pinch arrives as a wheel event with `ctrlKey` set and small
  deltas, so it gets five times the sensitivity; line- and page-mode deltas
  (Firefox) are turned into pixels first. The listener is attached by hand
  with `passive: false`, through the frame's callback ref, because React's
  `onWheel` is passive and cannot `preventDefault`, and an un-prevented wheel
  scrolls the page under the dialog's scroll lock.
- **The pointer is captured** on `pointerdown`, so a mouse drag that leaves the
  frame keeps panning, and a mouse `pointerdown` is prevented so the browser
  starts neither a text selection nor its own image drag (the `<img>` is also
  `draggable={false}`).
- **Gestures follow the finger; buttons and keys glide.** `smooth` turns on a
  200ms `transition-transform` for the buttons, the keys, the double tap and
  the settle after a gesture, and off for every pointer move and wheel tick,
  which must track the input exactly.
- **Reset by key.** A change of `resetKey` puts the view back to `UNZOOMED`
  during render (the "adjusting state when a prop changes" pattern), so the
  new photograph's first paint is already at 1x rather than one frame later.

## `apps/web/src/components/ui/photo-gallery/gallery-zoom-controls.tsx`

### `export function GalleryZoomControls({ scale, onZoom }: GalleryZoomControlsProps)`

Zoom out and Zoom in, top right of the viewer's stage, in a group named
"Zoom". They are the gestures' accessible equivalent — a mouse with no wheel,
a switch user, anyone who does not know a double tap exists — and they step
by 1.5x about the centre. Each is disabled at its end (1x, 4x). They are
`.dd-arrow`s taken out of their absolute centring (`static transform-none`)
so they share the stage arrows' 38px white-on-90% look, hover, focus ring and
disabled state, and grow to 44px below 768 like them.

## `apps/web/src/components/ui/photo-gallery/gallery-rail.tsx`

### `export function GalleryRail({ photos, index, onSelect }: GalleryRailProps)`

§2.10's rail: 132px wide, 84px on a phone, one 4:3 cell per photograph with a
two-digit number in the corner, the current one outlined in the accent and
marked `aria-current`. The current cell scrolls itself into view whenever the
index changes, however it changed.

## `apps/web/src/components/ui/photo-gallery/gallery-arrow.tsx`

### `export function GalleryArrow({ direction, label, onClick, placement, disabled }: GalleryArrowProps)`

One `.dd-arrow` for both places §2.9/§2.10 draw it: `strip` at the ends of the
thumbnail strip, `stage` inset 12px (8px on a phone) either side of the stage
photograph and of the viewer's. The stage arrow is a 40px solid white disc
with a `--color-neutral-400` border and a stronger shadow than `--shadow-sm`,
holding a black chevron: black alone vanishes on a dark interior shot, and a
white disc alone vanishes on the white studio page, so it is both. Both
placements grow to 44px below 768. Hover fills `--color-neutral-150` (and
darkens the stage border), a press fills `--color-neutral-300` and scales to
0.95, focus is the product's blue ring, and disabled — only the strip's, at
either end; the stage arrows wrap — is 0.45.

The glyph was the text `‹ ›`, whose weight and position depended on the font;
`GalleryChevron` draws it as a 24-grid stroke, 2.25 wide, 20px on the stage
and 16px on the strip.

## `apps/web/src/components/ui/photo-gallery/gallery-chevron.tsx`

### `export function GalleryChevron({ direction, className }: GalleryChevronProps)`

The arrow's icon, `currentColor`, `aria-hidden` and not focusable: the
button's `aria-label` is its name.

## `apps/web/src/components/ui/photo-gallery/expand-icon.tsx`

### `export function ExpandIcon()`

Four corner brackets in the stage's count tag (`⤢ 2 / 8 · view all`). On a
phone there is no zoom-in cursor to say that the photograph opens fullscreen;
the icon says it inside the same button, so there is no new control and no
second way in.

## `apps/web/src/components/ui/photo-gallery/classify-photo.ts`

### `export function classifyPhoto(image): PhotoKind | null`

Reads whether a loaded photograph is on the StudioCar backdrop (see
`variant` above). `null` means it cannot say — not loaded yet, no 2D context,
or a tainted canvas (`getImageData` throws a `SecurityError` on a cross-origin
image) — and the gallery then keeps its default. `willReadFrequently` asks
for a CPU-backed canvas, which is what a one-off `getImageData` wants.

## `apps/web/src/components/ui/photo-gallery/studio-white-filter.tsx`

### `export function StudioWhiteFilter({ id }: StudioWhiteFilterProps)`

The hidden, zero-size SVG that holds the backdrop-to-white filter. It is
`aria-hidden` and not focusable; the table is built once, at module load.
