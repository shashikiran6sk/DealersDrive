# web / features/home

Parent: [web](../README.md)

The homepage as an entry into `/cars` (**R72**, the F081 slice as revised, and
the Homepage Deck redesign). There is no homepage search API and no homepage
query. The hero is the `/cars` search box (R79), and every car on the page comes
from an ordinary `/v1/vehicles` request with a filter.

The motion rules the redesign added are DESIGN-SPEC §1.7 (_Homepage motion_);
the layout is §3.2.

## `apps/web/src/features/home/home.constants.ts`

### `export const HOME_CATEGORIES`

The five shopping categories, in deck order: SUVs, Automatic, Under ₹10 lakh,
Family cars, Low kilometres. Each is the search it opens (`params`, the same
`VehicleSearchParams` the results page reads), the copy on its card, and its
icon. A category is a filter the marketplace already supports, so adding or
changing one is a constant, not an API change.

- **Family cars is `bodyType=muv`.** Listings carry no seat count, so "family"
  is the body type built for it: three rows. Sedans and SUVs have their own
  ways in. Chosen by the product owner.
- **Under ₹10 lakh sorts `price_asc`.** The card shows the three cheapest, and
  its button opens the same sorted search, so the cars on the card are the
  first cars on the page it opens. Unsorted, while stock is small, the card
  would repeat the newest cars the stream already shows.
- **Low kilometres is the `featured` one.** The redesign asked for a "hot"
  category. Nothing records views or enquiries per filter, so nothing can say
  what is hot; under 1,00,000 km is useful to buyers and is a filter that exists.
  The badge says _Featured_, which is true, rather than _Hot_, which would be a
  claim.

`RECENT_CAR_COUNT` (10) feeds both the stream and Recently added
(`RECENT_ROW_COUNT`, 4), so one read serves two sections.

## `apps/web/src/features/home/load-home.ts`

### `export async function loadHomeInventory()`

Six reads, in parallel: the ten newest cars, and three cars for each category.
All are `/v1/vehicles`, cached for 60 seconds under `VEHICLES_TAG`, which the
dealer's lifecycle actions revalidate.

**Promoted cars are available cars.** Reserved cars sort after every available
one (R71), and the loader drops any card that is not `AVAILABLE`, so a section
may show fewer cars but never one a buyer cannot open. Sold and withdrawn cars
never reach it.

**The makes come from the recent read's facets.** An unfiltered
`/v1/vehicles` already returns the brand facet over every available car, so
the strip costs no read of its own. Only the labels and values are used; the
counts never leave the server (**R78**).

**No section carries a number (R78).** How many cars Dealers-Drive holds is not
something the homepage tells a visitor. The reads happen on the server, so the
`available` and facet counts in the responses never reach the browser either.

### `unavailable: true`

The cars failing is not the homepage failing. `loadHomeInventory` says so rather
than returning nothing, and the page draws `SectionError` where the cars were.
An empty space would read as "there are no cars", which is a different and
wrong sentence. The deck, stream, strip and row all render nothing; the hero,
the shortcuts and the explainers stay.

## `apps/web/src/features/home/utils.ts`

### `export function categoryHref(category)`

One function so the hero shortcut and the card's button can never disagree
about where a category goes.

## `apps/web/src/features/home/hero-banner/hero-banner.tsx`

### `export function HeroBanner({ image, aside, children })`

The copy on the left; on the right, `aside` when the page gives one (the
stream), else the photograph. It replaced the full-bleed photo hero of **R81**:
the Deck design leads with stock, not a stock photo.

**The photograph is still one prop, `image`.** The layout never decides which
picture it shows, so the admin setting below still works unchanged. `image:
null` draws the dark ground and no `<img>`, so the frame is never a
broken-image icon.

**`z-10`, without `isolate`.** The search's suggestion panel hangs below the
banner. `z-10` lifts the banner above the sections that follow, whose
positioned children (card photos, the deck's sticky cards) would otherwise
paint over the panel, and stays under the sticky header's `z-20`. The old
`isolate` existed to keep the background photograph's `-z-10` behind the copy;
there is no background layer now.

## `apps/web/src/features/home/hero-banner/hero-banner.constants.ts` — `HOME_HERO_IMAGE`

The committed default: `apps/web/public/images/home-hero.webp`, a showroom
scene of a salesperson with an Indian family, supplied for R81. It is what the
hero shows, when it shows a photograph, whenever no operator has set one.

## `apps/web/src/features/home/hero-banner/utils.ts` — `heroImageFrom(configured)`

**The photograph is admin-editable.** Two platform-config keys, edited in
`/admin/config` under _Platform settings_: `home.heroImageUrl` (an `https:`
URL, or a path on the web app such as `/images/home-hero-diwali.webp`) and
`home.heroImageAlt` (its description). The API checks the URL on the way out
(`heroImage()` in `config.service.ts`: anything else — `http:`, `data:`,
`javascript:`, protocol-relative, a relative path — is `null`) and publishes it
as `heroImage` on `GET /v1/config/public`.

`heroImageFrom` picks the configured photograph when there is one and the
committed default otherwise, and keeps the default's description if the
operator left theirs blank, so the `<img>` is never unlabelled. Saving the
setting revalidates `CONFIG_TAG`, so the next homepage render uses it.

Since the Deck redesign the photograph shows only when fewer than four cars are
listed or the API is unreachable; with stock, the stream takes its place.

## `apps/web/src/features/home/stock-stream/stock-stream.tsx`

### `export function StockStream({ cars, className })`

Two columns of real listings drifting in opposite directions: the first thing
the homepage says is what is for sale. Cars are dealt alternately
(`splitColumns`) so neighbouring cards differ.

**The loop is two copies, and the second is `inert` and `aria-hidden`.** Each
column holds its cars twice and translates by exactly half its height, so the
end meets the start without a jump. Each copy carries its own bottom padding
rather than a gap between copies; with a gap, half the height would be off by
half the gap and the loop would jump by that much. The second copy exists only
to be seen: a keyboard user tabs through each car once and a screen reader reads
each once.

### `export function StreamPauseButton({ className })`

Anything that moves on its own for more than five seconds needs a way to stop
it (WCAG 2.2.2). Hover and focus already pause the columns; the button is the
way that does not depend on the pointer staying put. It sets `data-paused` on
the stream from `closest()`, so the stream itself stays a server component. The
name is fixed and `aria-pressed` carries the state; a label that flipped
between Pause and Play while also pressed would announce the state twice. It is
hidden under reduced motion, where nothing moves.

## `apps/web/src/features/home/makes-strip/makes-strip.tsx`

### `export function MakesStrip({ makes })`

The makes on the marketplace, each a link to `/cars?brand=`. It scrolls
sideways like any overflowing row, so every make stays reachable by keyboard
and touch. The drift is scroll-linked rather than automatic: it moves only when
the visitor scrolls, so it needs no pause control.

**The drift's timeline is named on the `<nav>`, not taken from the row.** The
row sits inside the horizontal scroller, and `view()` would bind to that
scroller, which never scrolls vertically, so the animation would never run.
`.dd-makes` declares `view-timeline: --dd-makes` on the element outside the
scroller and the row animates on that.

Below three makes it renders nothing: two names in a full-width strip read as
a mistake.

## `apps/web/src/features/home/category-deck/category-deck.tsx`

### `export function CategoryDeck({ categories })`

The five categories as cards that stick under the header and stack, each
offset 16 px lower than the last, as the page scrolls. The stacking is sticky
positioning, so it works without script; `DeckStack` only adds the scale and
dim of the card being covered.

## `apps/web/src/features/home/category-deck/category-cars.tsx`

### `mix-blend-darken` on the lead photo

Listing photographs are studio cut-outs on a flat `#f6f6f6`, and the panel is
`--color-neutral-100` (`#f7f7f5`). One step apart is still a visible box around
every car. `darken` keeps the darker of the two at each pixel, so the photo's
ground disappears into the panel while the car, which is always darker than
either, is unchanged.

## `apps/web/src/features/home/category-deck/category-card.tsx`

### `export function CategoryCard({ category, position, total })`

**An empty category stays, and says so.** Family cars (MUVs) had no stock when
the deck shipped. Hiding an empty card would leave its hero shortcut pointing at
nothing on the page and make the deck's length depend on stock. Instead the
photo side shows the category's `emptyMessage`, and the button changes from
"Browse family cars", which would open an empty page, to "See every car".

**`overflow-clip`, not `overflow-hidden`.** Both clip the rounded corners, but
`overflow: hidden` makes the card a scroll container, and the lead photo's
`view()` timeline would bind to a container that never scrolls, so the slide-in
would never run.

**Sticky from `md` up, and never on a short screen.** On a phone the card is
taller than what is left of the viewport under the header. Stuck, the next
card would slide over its button before the visitor reached it. On phones the
cards scroll normally and drop their small photos and third fact. The same
holds on any screen under 640 px tall (`max-height`, a landscape phone).

### `--deck-top`

The sticky offset, set per card from `position`. Each card stops 16 px lower
than the one before, so the edges of the cards underneath stay visible as a
stack.

## `apps/web/src/features/home/category-deck/deck-stack.tsx`

### `export function DeckStack({ children, className })`

The one piece of the deck that needs script: how far the next card has slid
over this one (`coverProgress`) is a relation between two elements, and no CSS
timeline expresses it. It writes the number to `--deck-cover` and the CSS does
the rest (`.dd-deck-card` in `globals.css`). One `requestAnimationFrame` per
burst of scroll events, nothing in React state, so a scroll never re-renders.

It writes 0 under reduced motion, and does nothing at all where `matchMedia` is
missing (as in the unit-test DOM), the same guard as `MobileNav`.

## `apps/web/src/features/home/category-deck/utils.ts`

### `export function coverProgress(card, next)`

0 while the next card is a full card-height below, 1 once it sits on top. A pure
function of two rectangles, so the arithmetic is tested without a browser.

## `apps/web/src/features/home/category-deck/category-icon.tsx`

### `export function CategoryIcon({ icon, className })`

Drawn in SVG, not an icon font or images, so it takes the text colour and
scales with the button. Always `aria-hidden`: the label beside it names the
link. The lettering inside the automatic and price icons ("PRN", "D", "₹10L")
is drawing, not text, and is excluded from the accessible name.

## `apps/web/src/features/home/discovery-row/discovery-row.tsx`

### `export function DiscoveryRow(props)`

Renders nothing when a row is empty, so the homepage never shows a heading
with an empty grid beneath it. "View all →" carries no number (**R78**).

### `dd-reveal-group`

The cards rise in one after another as the row enters the viewport, where
scroll-driven animation is supported. On phones the row is a horizontal
scroller, which becomes the cards' timeline source and never scrolls
vertically, so they stay put there, which is what a swipeable row should do.

## `apps/web/src/features/home/discovery-row/discovery-band.tsx`

### `export function DiscoveryBand(props)`

The page-width band the Recently added row sits in. It exists so the empty case
is decided in one place: `DiscoveryRow` already renders nothing when it has no
cars, but the band's own padding would still have drawn an empty stripe.

## `journey-section/` · `trust-section/` · `audience-section/`

The homepage's three explainers, lifted out of `page.tsx` unchanged (R83). Each
heading carries an id the section is labelled by, so each is a named region —
which is what the order tests find them by.
