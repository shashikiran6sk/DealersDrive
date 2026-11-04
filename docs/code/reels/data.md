# reels / data

Parent: [reels](README.md)

## `apps/reels/src/data/featured.ts`

### `export function showcaseCars(cards: readonly VehicleCardDto[]): VehicleCardDto[]`

Only `AVAILABLE` cars with a photograph are ever shown. A `RESERVED` car is
_visible_ on the site (**R71**) but a reel is shared and re-watched for days, and
a reserved car in it is a car the buyer cannot have by the time they ask. A car
with no photograph would leave a blank stage in the one scene the reel exists
for.

### `export function selectFeatured(cards: readonly VehicleCardDto[], max: number): VehicleCardDto[]`

Four cars fit into the ten seconds the cars get. They are picked across the
price range — the cheapest, the dearest and two evenly between — rather than the
four newest, because the newest four are often the same model twice and say
nothing about the yard's range, while a spread tells a buyer in one glance
whether this dealer has a car at their budget. They play cheapest first, so the
reel builds to its most expensive car.

There is no make or model to deduplicate on: a card carries a free-text title
(**D1**, no catalogue), and splitting it into a make is guesswork
(`Maruti Suzuki Baleno` is two words of make). The price spread gets diversity
without guessing. Unpriced cars only top up a list that is short of priced ones.

### `export function priceRange(cards: readonly VehicleCardDto[]): string | null`

The range is computed from the same available cars the reel shows, through
`formatLakh` from contracts, so it reads like the directory's "from ₹3.75 Lakh".
The card carries only `priceLabel`, so the rupees are read back out of it —
the label is exact rupees, never rounded, so nothing is lost.

## `apps/reels/src/data/build-props.ts`

### `export function buildReelProps(input: BuildReelInput): ReelProps`

The one place API shapes become reel shapes. The scenes receive only plain,
serialisable props: Remotion passes props across the browser boundary as JSON,
and a scene that reached for a contract type would be tempted to re-derive what
was decided here.

**No phone number, anywhere** (**AGENTS.md rule 7**). The closing scene sends the
viewer to the dealer's page through a QR code; the number is behind
reveal-contact, where it is rate-limited and counted as a lead.

`availableCount` is the inventory response's `available`, which is the
"available" count by **R71** — the same number the dealer page states.

## `apps/reels/src/data/specs.ts`

### `export function carSpecs(metaLabel: string): Bilingual[]`

`metaLabel` is the card's `93,304 km · Petrol · Automatic · Vellore`. Only the
parts the reel can name in Tamil are kept — distance, fuel, gearbox — and
anything else is dropped rather than shown in one language only. The town is
dropped deliberately: the opening scene already says where the dealer is.

## `apps/reels/src/data/dealer.ts`

### `export function serviceLabel(raw: string): Bilingual`

Services are typed by dealers: `Rc Transfer`, `Workshop( Wash and Polish)`. A
known service is matched on its letters only and given a tidy English label and
its Tamil one. An unknown service keeps the dealer's own words, in English
only — a guessed translation of a phrase nobody reviewed is worse than none.

## `apps/reels/src/data/media.ts`

### `export function atWidth(url: string, width: number): string`

The public cards point at the 640 px derivative, which is soft on a 1080 px
frame. The media route accepts any width and answers with the largest derivative
it holds (1600) or the original, so asking for 1600 gets the best image there is.

### `export function planMedia(width: number, folder = 'media'): MediaPlan`

Every image is downloaded before rendering and served from the bundle's public
folder, instead of letting the headless browser fetch it mid-render. A render is
then repeatable, does not depend on the browser's proxy settings, and cannot fail
at frame 400 because one request timed out. The plan records each URL as it is
mapped, so the list of downloads is exactly the list of images the props name.

## `apps/reels/src/data/campaign.ts`

### `export const REEL_CAMPAIGN`

The QR code opens the dealer's page tagged `utm_source=dealer-reel`, so visits
from reels can be counted separately. The dealer page ignores parameters it does
not read, so the tags cannot break it (checked against production).

## `apps/reels/src/data/api.ts`

### `export async function getJson<T>(fetcher: Fetcher, url: string, parser: Parser<T>): Promise<T>`

Every response is parsed with the contracts schema the web app uses. A field
renamed in the API breaks the reel loudly at fetch time rather than drawing
`undefined` into a video someone then posts.
