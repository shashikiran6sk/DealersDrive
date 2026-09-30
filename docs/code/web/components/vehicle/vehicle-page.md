# web / components/vehicle — the vehicle page parts

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/vehicle-gallery/vehicle-gallery.tsx`

### `export function VehicleGallery({ title, images, primaryIndex }: VehicleGalleryProps)`

DESIGN-SPEC §2.9/§2.10 as the legacy gallery drew them (**R49**, F083): a
`.blueprint` main image with its four corner marks and a "20 photos · view all"
tag, the 108px thumbnail strip under it, and the fullscreen lightbox. R48 had
replaced the strip and the rail with arrows on the main image; R49 puts the
spec's gallery back, because that is what the product is meant to look like.

The gallery starts on the admin's primary photograph, not the first in order,
and falls back to the first when the index is out of range. It opens the
lightbox on itself; a thumbnail opens it on that thumbnail.

**One `index`, for everything (R87).** The main image shows `images[index]`,
not a fixed primary, and its Previous image / Next image arrows call the same
`step` the lightbox's arrows and ←/→ keys call — so they wrap exactly as the
lightbox does, because they are the same function. The strip marks
`images[index]` (`aria-current`, the accent ring), the lightbox opens on it, and
whatever the lightbox is left on is what the page shows when it closes. There is
no second index anywhere to drift out of step. The arrows are siblings of the
main image's button, not children — a button inside a button is invalid, and a
click on an arrow must never open the lightbox — and they are drawn only when
there is more than one photograph, as the lightbox's are.

Several controls open one dialog, so none of them can be its Radix trigger.
The gallery remembers which one was pressed and hands focus back to it in
`onCloseAutoFocus` — the legacy lightbox's "focus returns to the exact opener".

## `apps/web/src/components/vehicle/vehicle-gallery/gallery-strip.tsx`

### `export function GalleryStrip({ images, index, onOpen }: GalleryStripProps)`

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

## `apps/web/src/components/vehicle/vehicle-gallery/gallery-viewer.tsx`

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
cropped or stretched. ← and → page while it is open, wrapping at both ends; the
caption under the stage is the photograph's alt text, announced as it changes.

## `apps/web/src/components/vehicle/vehicle-gallery/gallery-rail.tsx`

### `export function GalleryRail({ images, index, onSelect }: GalleryRailProps)`

§2.10's rail: 132px wide, 84px on a phone, one 4:3 cell per photograph with a
two-digit number in the corner, the current one outlined in the accent and
marked `aria-current`. The current cell scrolls itself into view whenever the
index changes, however it changed.

## `apps/web/src/components/vehicle/vehicle-gallery/gallery-arrow.tsx`

### `export function GalleryArrow({ direction, label, onClick, placement, disabled }: GalleryArrowProps)`

One `.dd-arrow` for both places §2.9/§2.10 draw it: `strip` at the ends of the
thumbnail strip, `stage` inset 14px either side of the lightbox photograph at
38px on white at 90%. Both grow to 44px below 768.

## `apps/web/src/components/vehicle/price-block/price-block.tsx`

### `export function PriceBlock({ priceLabel, negotiabilityLabel }: PriceBlockProps)`

DESIGN-SPEC §2.11 without the EMI line: there is no finance partner and no rate
to quote, and a made-up monthly figure is exactly the kind of number a buyer
should not be shown.

## `apps/web/src/components/vehicle/vdp-dealer-card/vdp-dealer-card.tsx`

### `export function VdpDealerCard({ dealer }: { dealer: PublicVehicleDetail['dealer'] })`

Who is selling, and a way to see the rest of their yard. No phone number and no
Call or Enquire button: the reveal route (rule 7) and enquiries are deferred,
and a button that cannot work is worse than none.
