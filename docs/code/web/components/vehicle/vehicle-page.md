# web / components/vehicle — the vehicle page parts

Parent: [web/components/vehicle](README.md)

The gallery at the top of the page is the shared
[`PhotoGallery`](../ui/photo-gallery.md) — it was `VehicleGallery` here until
the dealer page's hero needed the same gallery. The car page renders it with
the strip and the 4:3 stage, starting on the admin's primary photograph.

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

## `apps/web/src/components/vehicle/vehicle-name/vehicle-name.tsx`

### `export function VehicleName({ title, year })`

The card and the vehicle page both put the year in a plate beside the title, so
the visible title drops it (R88): the plate says 2022, the heading says Maruti
Suzuki Brezza ZXi. Only the visible text changes. The year is still in the
heading as screen-reader text, because the plate is a separate element and a
link read out of context ("Maruti Suzuki Brezza ZXi") would lose it, and
`vehicle.title` itself is unchanged in the API, the page `<title>`, image alt
text, the save button's label, breadcrumbs and structured data.

`titleWithoutYear` lives in contracts beside `vehicleTitle`, whose inverse it
is. It only removes a leading year that equals `year`; anything else — no year,
a different year, a registration-number title, a title that is only the year —
is drawn exactly as it came. The space between the hidden year and the name is
its own text node, because the accessible-name algorithm trims each element's
text and a space inside the hidden span would be lost.
