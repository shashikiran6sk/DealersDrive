# sandbox / stories/dealers

Parent: [sandbox](../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/sandbox/src/stories/dealers/directory-card.stories.tsx`

### `const BASE: DealerCard =`

DESIGN-SPEC §3.5 — the directory card (C038).

⚠️ **The file is `dealer-card.tsx` and the export is `DirectoryCard`.** That
is finding **D-6**: nothing named `DealerCard` exists in the UI — `DealerCard`
is the _contracts DTO_ this component takes. Somebody searching the registry
for either name has to land here rather than write a second card, which is
what the `aliases` field is for.

## R28 — the card as `docs/Dealers-Drive-UI/Dealer-Card` draws it

The composition changed; the rules that hold it together did not. What is
new to look at:

· **The identity plate row straddles the cover's bottom edge.** A 48px
white logo tile pulled up 24px on the left, the VERIFIED DEALER plate on
the right, and the name starting underneath both rather than sharing a
line with the plate.
· **YARD VERIFIED sits on the cover**, top right, on an ink wash. There is
no year on it — nothing on the platform records when a yard was audited,
so the reference's "· 2024" is deliberately absent.
· **The tagline is a pledge panel** — tinted, with an accent rule down its
left edge and decorative quotation marks. The marks are `aria-hidden`;
the sentence a screen reader gets is the dealer's own, unquoted.
· **The first service chip takes the accent** (**R29**; R28 accented the
third). Keyed to the position, not to the value — `ServiceChips` is where
one, two and three sit side by side.
· **The footer runs to the card's edges** on a tint, under a hairline,
rather than sitting inside the body's padding.

Deliberately _not_ taken from the reference: the card does not lift or cast a
shadow on hover. §4.1 gives shadows to exactly three elements — the city
dropdown, the dialog and the mobile sheet — and a directory of eighteen
lifting cards is not the place to make it four. The border takes the accent
instead.

Three things to check by eye:

· **The whole card is one link — including the two places that used to be
holes in it** (**R29**). The heading's anchor is stretched over the card
with `after:absolute after:inset-0`, and nothing is lifted above it.
"View inventory →" and the logo-tile row both carried `z-[2]`, which took
them out of the link rather than putting them in it: clicking the words
"View inventory" did nothing while clicking the gap beside them opened
the portfolio. Click the affordance, and click the tile, and check both
navigate. They are affordances for the card's own link, not second
destinations — a nested anchor would be invalid HTML and would give a
screen reader two links to the same page.
· **The logo tile does not move when the name wraps.** That was **R24**,
and R28 retired the fix by retiring the cause: the tile is no longer in
the heading's row at all, so its position is fixed against the cover.
`ShortAndLongName` is still the story — the two tiles must start level.
· **The card is one fixed size** (R21), and nothing on it changes that:
not a missing tagline, not a third service, not a fifty-character name.
`SameDataTwice` is the story that proves it — two directories, one
sparse and one full, whose cards measure the same.

Both branches are live. A dealership that has uploaded a yard photograph gets
`coverUrl` — the 640px rendition, addressed by media id — and one that has
not gets the `ImageSlot`, which names the shot rather than showing a grey
rectangle. `WithCover` and `Default` are the two, side by side. The cover's
gradient wash is on the photograph branch only: it is there so the white tile
has something to sit against on a bright forecourt, and the flat `ImageSlot`
needs no such help.

### `<div style={{ width: 300 }}>`

The grid cell it lives in: `minmax(290px, 1fr)`.

### `export const Default: Story = { args: { dealer: BASE } }`

A dealership that has answered everything and is trading.

### `export const NoLiveCars: Story =`

The state every dealership is in until **F064** puts a listing on the
platform: verified, findable, and holding nothing yet. A8 is explicit that it
still appears — dropping it would make the network look smaller than it is —
and the em dash is what stands in for a "from" price that does not exist.

### `export const OneCar: Story =`

One car. The label is singular, which a `${n} cars listed` template gets wrong.

### `export const Sparse: Story =`

Nothing optional filled in — the hour after onboarding completes, and the
state that prompted **R17**. On its own it is the `min-h` floor that keeps
this card the ordinary size; in the directory it is `grid-auto-rows: 1fr`
that makes it match the cards beside it.

### `export const NoTagline: Story = { args: { dealer: { ...BASE, tagline: null } } }`

No tagline, but services. The paragraph is not rendered at all — nothing
reserves a two-line box for it — and the card is still the ordinary height,
because `min-h` is the floor and `mt-auto` keeps the footer at the bottom of
whatever is left (R17).

### `export const LongTagline: Story =`

The 200-character tagline the contract allows. `line-clamp-2` cuts it at two
lines, which is what stops one talkative dealership from setting the height
of every card in the grid — see `InTheGrid`, where it is the third card.

### `export const ManyServices: Story =`

Five services. The API slices to three and so does the component — belt and
braces, because a card with five chips wraps to a fourth row and breaks the
grid's rhythm. The portfolio is where the full list belongs.

### `export const ServiceChips: Story =`

One service, two, and three, side by side — and the story R28 wrote to make
its own arguable line easy to argue with. It was argued with, and **R29**
moved the accent to the first chip.

The reference accents the third chip on every card it draws, and every card
it draws has three. Keyed to the position rather than to the value that was
defensible — nothing makes a third service more important than a first — but
it read as a highlight arriving after the row had been read, and it vanished
entirely for any dealership listing fewer than three services. Which is most
of them: the floor is one.

On the first chip the accent is where the eye enters the row, and all three
cards below keep it.

### `export const LongBrandName: Story =`

The long-name case. Indian dealership names run long — "Sri Venkateswara
Automobiles and Finance Private Limited" is not unusual — and the heading has
to wrap beside the VERIFIED plate without pushing it off the card.

**This is the R24 story, and R28 is why it now passes trivially.** The thing
to check is the logo tile: its top edge must be exactly where it is in
`Default`, because it is positioned against the cover rather than against the
name. It used to slide down to the second line, when the tile shared a row
with the heading and was aligned to the bottom of it. `ShortAndLongName` puts
the two side by side so the tile is either level across both or is not.

With the plate out of the heading's row, the name also has the full width of
the card to wrap in — which is the other half of what this story shows.

### `export const ShortAndLongName: Story =`

**R24, and the comparison the bug was reported as.** A one-word name and a
name that wraps, side by side, at the width the grid actually gives a card.

The logo tiles must start at the same height. They did not: the left card's
tile sat beside "Chennai cars" and the right card's sat beside "CARS", the
second line of "GOWTHAM CARS" — a 21px drop that made a row of cards look
ragged for no reason a reader could see.

Under **R28** the tiles are straddling the cover's bottom edge, which is a
fixed distance from the top of the card, so this is now a check that the
structure is still what it claims rather than a check on an alignment rule.

### `export const Unverified: Story = { args: { dealer: { ...BASE, isVerified: false } } }`

Unverified. Not a state the directory can currently produce — `listActive()`
returns ACTIVE dealerships only, and the service hard-codes `isVerified:
true` — but the flag is in the contract and the card branches on it, so the
branch is worth being able to see.

### `export const WithCover: Story =`

A dealership that has uploaded one. The photograph is cropped into the 104px
band with `object-cover`, so the thing to check by eye is that the logo tile
still reads against it — the tile crosses the divider, and a busy photograph
is where that crossing either works or does not.

### `export const InTheGrid: Story =`

Six dealerships over two rows — the arrangement R17 needed, and the one R21
keeps honest.

Cards in the _same_ row have always matched each other; grid stretches them
to the row. What R17 added was matching _between_ rows, and what it could not
give was a fixed size: every card took the height of the fullest card on the
page, so the third card's long tagline set the proportions for all six.

The height is a constant now — 400px since **R28** re-measured it for the
taller cover and the pledge panel's padding. What to check by eye:

· **All six cards are the same height**, as before.
· **The third card's long tagline is cut at two lines** and does not make
the other five taller — compare against `SameDataTwice`, which measures
it rather than asking you to.
· **The three sparse cards leave the slack empty above a footer that is
still on the bottom edge.** That empty space is the fixed size doing its
job, not a card that failed to fill.

### `gridAutoRows: '1fr'`

R17 — the half of the fix that is not in the card. Every implicit

### `gridAutoRows: '1fr'`

row takes the height of the tallest card in the grid, so the sparse

### `gridAutoRows: '1fr'`

second row matches the first.

### `width: 960`

Fixed, because the meta decorator above sizes a single card at 300px.

### `const GRID: DealerCard[] = [`

The first row has everything to say, the second has almost nothing — which is
a real directory page, where onboarding-fresh dealerships sit beside ones that
have been trading for a decade.

### `export const Fullest: Story =`

**The worst case, and the one `CARD_HEIGHT` is measured against.** A
registered name that wraps to two lines, a tagline that fills its two, and
three services long enough to wrap to a second row — all at once.

Nothing here may be cut off. If a font change or a line-height rounding ever
makes it so, this is the story that shows it: the second row of tags is the
first thing to go, and it goes silently, because the box clips rather than
scrolling.

### `export const SameDataTwice: Story =`

**R21, and the reason it exists.** The same three dealerships, twice: once
with almost nothing filled in, once with taglines and three services each.

The reported bug is visible only in this comparison, and it is not visible in
either half alone — under R17 every card in the top grid was shorter than
every card in the bottom one, because "equal to each other" is not "fixed".
The two grids now measure the same, and the number is printed under each so
the check is a reading rather than a squint.

### `const SPARSE_ROW: DealerCard[] = [`

The three of them with nothing to say.

### `const FULL_ROW: DealerCard[] = [`

The same three after they have filled their profiles in.

### `function MeasuredGrid({ label, dealers }: { label: string; dealers: DealerCard[] })`

A grid that reports its own card height, because "are these the same size?"
is a question a screenshot answers badly and a number answers exactly.

## `apps/sandbox/src/stories/dealers/directory-filters.stories.tsx`

### `const LOCATIONS: PublicLocations =`

DESIGN-SPEC §3.5 — the directory's name search and city chips (C031).

**It writes to the URL, not to a state store.** That is the rule every filter
in the product follows (ARCHITECTURE §15.2): `/dealers?city=vellore` is
shareable, server-renderable, and survives a back button. Watch the router
panel in the Storybook addons while clicking a chip — the push it makes _is_
the component's output.

Three behaviours worth checking by eye:

· **The chips are multi-select toggles.** Pressing a second one adds it
rather than replacing the first — a buyer working the Vellore belt wants
Katpadi _and_ Vellore, twenty minutes apart. `aria-pressed` already said
"toggle"; this is the behaviour matching the announcement.
· **There is one way out.** With one chip at a time, pressing the active
one cleared the filter and that was discoverable enough. With several on,
un-pressing each in turn is not — hence the counted "Clear N towns".
· **A search and a town compose**, and so does a district. The query string
carries all three.

The chips come from the API, narrowed to the district the header selected and
counted over it rather than over the page — so choosing one cannot empty the
row it was chosen from. `OneTown` below is what that looks like: Vellore is
pressed, and Katpadi is still there to add.

## The row has two shapes as of R23

Compare **`Default`** with **`WithinADistrict`**, which is the whole of the
revision. With no district, `cities` is every town _on the platform_ — the
old `ManyCities` story was four rows of them and that was at a fraction of
the real number — so the row becomes a single `Select district` button and
the chips wait until a district makes them a readable set.

The grid underneath does not change: no district still means every
dealership. This narrows the control, not the results.

**`AppliedTownWithoutADistrict`** is the case that stops this being a plain
"hide the chips" rule. `indexPolicy` names `/dealers?city=vellore` an
indexable canonical, so a buyer can arrive there from a search result with a
town already applied and no district — and a row that hid itself would leave
them a filter they can neither see nor clear. An applied town always shows.

### `export const Default: Story = { args: { cities: CITIES, locations: LOCATIONS } }`

Nothing chosen: the unfiltered `/dealers`, and **R23's headline change**.

`cities` here is the full platform list, exactly as the API returns it with
no district — and none of it renders. The button and one line of prose stand
in its place. Open the picker and choose Vellore to reach `WithinADistrict`.

### `export const AppliedTownWithoutADistrict: Story =`

A town applied with no district — `/dealers?city=vellore`, which the SEO
policy invites Google to send people to.

Vellore is pressed and `Clear town` is beside it; Katpadi and the rest are
not, because they are still the platform's whole list. Seeing what is applied
is a different need from browsing what could be.

### `export const OneTown: Story =`

One town chosen. Every other chip stays available, and so does the clear.

### `export const SeveralTowns: Story =`

Two towns at once — the case single-select could not express, and the reason
the chips changed. The pill count in "Clear 2 towns" is what makes the size
of the selection legible without counting the highlighted chips.

### `export const Searching: Story =`

A search in progress, restored from the URL rather than from memory.

### `export const SearchWithinACity: Story =`

Both at once — the query string carries `?city=vellore&q=lakshmi`.

### `export const WithinADistrict: Story =`

Inside a district, which is the header's doing. The chips are the towns in
it; this component only carries the district through every navigation it
makes — drop it and choosing a town would silently widen the search back to
the whole platform.

### `export const OneCity: Story =`

One town in the district. This is the shape of a district early on, and the
row has to not look broken with a single chip in it.

### `export const NoCities: Story =`

No chips at all — every dealership in the district left the locality blank,
so there is nothing truthful to offer. The search box stands alone rather
than being joined by an empty row.

### `export const ManyCities: Story =`

Twelve towns **inside one district**. The row wraps rather than scrolling,
which is what keeps every chip reachable by keyboard in document order.

This is what the row is allowed to look like now. Before R23 the same wrap
happened with no district at all and with every town on the platform in it,
which is the state `Default` replaces — twelve is a big district, forty-four
was a wall.

## `apps/sandbox/src/stories/dealers/location-card.stories.tsx`

### `const ADDRESS =`

The third card in the portfolio's info row.

The thing to check by eye is that **the map and the button are independent**.
They look like one feature and are not: the button is `mapsUrl`, the link the
dealer pasted (**R6**), and the map is `embedUrl`, which the API composes
from whatever that link turned out to carry. A `maps.app.goo.gl` share link
carries neither a pin nor a place until it is followed, and following it is
best-effort — so `DirectionsOnly` below is not an error state, it is the
ordinary outcome for a dealership whose link could not be resolved.

The second thing to check is the difference between `Default` and `PinOnly`,
which is what **R14** is for. A link that named a **place** comes back as
Google's place card — name, address, rating, review count, zoom controls and
a directions control, inside the frame. A link that only carried coordinates
comes back as an unlabelled dot. Both are real states; the first is worth the
place id it costs.

Neither half is ever composed from the address. A map confidently centred on
the wrong gate is worse than the slot, because it looks authoritative.

⚠️ The map is a live Google embed, so these stories load a real frame and need
the network. That is also what makes them worth looking at: the place card's
height against the frame's, and the way the frame sits inside the `Blueprint`
border, are the two things a mock would get wrong.

### `const PLACE_EMBED =`

A real dealership, and it has to be.

A place card is drawn from Google's own feature id, so there is no way to
mock one: an invented id renders a blank frame, which would make this story
look like a bug in the component rather than the state it is meant to show.
So the one story that exercises the card names a dealership that exists —
the rest keep the fictional brand the other portfolio stories use.

Built exactly as `embedUrlFor` builds it, so what is on screen here is what
ships. Note that the label in the blob (`!2s…`) is only a hint: Google
renders the place's own name from the id, which is why it can differ.

### `<div style={{ width: 320 }}>`

The info row's cell: `minmax(260px, 1fr)`.

### `export const Default: Story =`

The state **R14** exists for, and the one most dealerships land in: the link
named a place, so the frame carries the dealership's name, its address, its
rating and review count, the zoom buttons and a directions control — and the
card's own button underneath is then the second way to the same place, not
the only one.

### `export const PinOnly: Story = {}`

The same card for a link that carried coordinates and named nothing — a
hand-built `?q=lat,lng` share link, or a `/maps/@…` URL copied off the map
itself. An unlabelled dot, which is honest and is all there is to draw.

### `export const DirectionsOnly: Story =`

The ordinary outcome for a phone-shared link that could not be followed —
a timeout, or Google declining a server-side request. The slot names what is
missing and the button, which is the thing a buyer actually presses, is
untouched.

### `export const MapOnly: Story =`

A map with no link. Not reachable through onboarding — the map is composed
_from_ the link — but the two fields are independently nullable in the
contract, and a card that dropped the map because the button was missing
would be hiding the one piece of information it still had.

### `export const Neither: Story =`

A dealership that predates R6. The card is a heading and a slot, not a gap.
