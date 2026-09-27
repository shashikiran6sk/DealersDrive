# web / components/vehicle — the vehicle page parts

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/vehicle-gallery/vehicle-gallery.tsx`

### `export function VehicleGallery({ title, images, primaryIndex }: VehicleGalleryProps)`

DESIGN-SPEC §2.9/§2.10 as the legacy gallery implemented them (**R48**, F083),
rebuilt on the current primitives. It opens on the admin's primary photograph,
not the first in order, and falls back to the first when the index is out of
range.

The main image is one button that opens the fullscreen viewer; the ‹ › arrows
are **siblings** of it, not children, so pressing an arrow can never open the
viewer. They wrap at both ends — the legacy lightbox's `(i + d + n) % n` — which
suits a set a buyer flicks through more than a list they read to the end. The
thumbnail strip is gone: it scrolled sideways, which on a phone competes with
the page for the same gesture; the counter says where you are instead.

`←`/`→` are handled on the gallery's own `<section>`, so they only act while
focus is inside it, and never when the event comes from a text field. The
viewer's keys are its own (below), so the section ignores them while it is
open — React events bubble out of a portal, and without the guard one press
would step twice.

## `apps/web/src/components/vehicle/vehicle-gallery/gallery-viewer.tsx`

### `export function GalleryViewer(...)`

The fullscreen viewer, on `Dialog` with `variant="fullscreen"` rather than a
hand-rolled overlay: Radix gives the focus trap, Escape, the scroll lock on
the page behind, and focus returned to the trigger — the main image — on close,
which were the four things the legacy overlay had to write by hand. The counter
is the dialog's description, so a screen reader hears "3 / 18" with the title.

The image is `max-h-full max-w-full object-contain` inside a flex cell that
fills what the header leaves: it fits the viewport at any size without
cropping or stretching. Arrow keys page while it is open (a modal owns the
keyboard); the arrows are the same `GalleryArrow`, larger.

The legacy viewer also had a rail of thumbnails. It is left out: on a phone it
took a quarter of the width from the photograph, and the counter and arrows
already do its job.

## `apps/web/src/components/vehicle/vehicle-gallery/gallery-arrow.tsx`

### `export function GalleryArrow({ direction, onClick, size }: GalleryArrowProps)`

White at 90% with a border and a shadow, so it reads over the pale sky of one
photograph and the dark interior of the next. 40px (44px in the viewer) — a
thumb's target on a phone.

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
