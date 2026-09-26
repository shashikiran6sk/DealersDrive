# web / components/vehicle — the vehicle page parts

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/vehicle-gallery/vehicle-gallery.tsx`

### `export function VehicleGallery({ images, primaryIndex }: VehicleGalleryProps)`

A client component for one reason: the thumbnails switch the main photograph.
It opens on the admin's primary, not on the first in order, and falls back to
the first when the index is out of range rather than rendering nothing. The
strip is in the admin's order. The fullscreen lightbox with its focus trap is
**F083** and not built; the thumbnails are real buttons with `aria-pressed`, so
the gallery is usable by keyboard without it.

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
