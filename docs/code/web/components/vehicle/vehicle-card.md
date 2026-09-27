# web / components/vehicle/vehicle-card

Parent: [web/components/vehicle](README.md)

## `apps/web/src/components/vehicle/vehicle-card/vehicle-card.tsx`

### `export function VehicleCard({ vehicle, priority, className }: VehicleCardProps)`

DESIGN-SPEC §2.8, grid variant (**F075**). A server component: it renders what
the API sent and computes nothing — the title, the price and the meta row
arrive formatted, so the card and the page for the car cannot disagree.

The whole card is the link, by the same `after:absolute after:inset-0` pattern
as the dealer card, so the one real `<a>` is the title and a screen reader
hears the car's name rather than "link, image". The dealer strip is on every
card, without exception: who is selling is part of what the card says.

### `variant?: 'grid' | 'compact'`

§2.8's two card variants that exist today (**R48**). `compact` is the
portfolio's: the same card with an 8px body gap and **no dealer strip**,
because it sits under that dealer's own header. The legacy card used the same
prop name for the same reason, so a reader of either finds one vocabulary.

There is no save button and no sold state. Saved cars (F087) are deferred, and
in this phase only ACTIVE listings are public, so a sold card cannot occur.
Both return as props when their features land.

## `apps/web/src/components/vehicle/vehicle-card/vehicle-image.tsx`

### `export function VehicleImage({ image, className, priority }: VehicleImageProps)`

A plain `<img>`: the image comes from the API's public media origin, which
differs per environment, and F034's derivatives do not exist to build a
`srcset` from. `priority` loads the first row eagerly and the rest lazily. No
photograph is an `ImageSlot` that holds the 4:3 band, so a card without one is
the same height as its neighbours.
