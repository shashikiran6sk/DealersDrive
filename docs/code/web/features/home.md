# web / features/home

Parent: [web](../README.md)

The homepage as an entry into `/cars` (**R72**, the F081 slice as revised).
There is no homepage search API and no homepage query. The hero is the `/cars`
search box (R79), and each row is an ordinary `/v1/vehicles` request with a
filter.

## `apps/web/src/features/home/load-home.ts`

### `export async function loadHomeInventory()`

The four rows are `DISCOVERY_SECTIONS`: Recently added, SUVs, Automatic cars,
and Under ₹10 lakh. Each is `/v1/vehicles` with its filter and `limit=4`,
cached for 60 seconds under `VEHICLES_TAG`, which the dealer's lifecycle
actions revalidate.

**Promoted rows show only available cars.** Reserved cars sort after every
available one (R71), so the first four are all available whenever four exist.
The row also drops any card that is not `AVAILABLE`, so it may show fewer than
four but never a car a buyer cannot open. Sold and withdrawn cars never reach
it.

**"View all →" carries no number (R78).** How many cars Dealers-Drive holds is
not something the homepage tells a visitor, so the link names the search, not
its size. The rows are fetched on the server, so the counts in the API
response never reach the browser either.

If the API is down, the page still renders the hero search and the static
sections, without the rows.

## `apps/web/src/features/home/discovery-row/discovery-row.tsx`

### `export function DiscoveryRow(props)`

Renders nothing when a row is empty, so the homepage never shows a heading
with an empty grid beneath it.

## `apps/web/src/features/home/hero-banner/hero-banner.tsx`

### `export function HeroBanner(props)`

The homepage's single full-width hero (**R81**). It replaced the "How it works"
trust panel: one photograph behind the headline, the `/cars` search box and the
two shortcuts. A left-to-right black scrim (a flat 55% one on phones) keeps the
white copy legible whatever the photograph is.

**The photograph is one prop, `image`, on purpose.** The layout never decides
which picture it shows, so making it editable is a data change, not a redesign.
`image: null` draws the dark ground and no `<img>`, so the page is never a
broken-image icon while a photograph is being chosen. The suggestion panel of
the search box hangs below the banner, which is why the clipping
(`overflow-hidden`) is on the background layer and not on the section.

### `apps/web/src/features/home/hero-banner/hero-banner.constants.ts` — `HOME_HERO_IMAGE`

The committed default: `apps/web/public/images/home-hero.webp`, a showroom
scene of a salesperson with an Indian family, supplied for R81. It is what the
homepage shows whenever no operator has set a photograph.

### `apps/web/src/features/home/hero-banner/utils.ts` — `heroImageFrom(configured)`

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
setting revalidates `CONFIG_TAG` (the admin config action already does), so the
next homepage render uses it.

The URL must point at an image already hosted somewhere reachable by browsers;
uploading the file from the admin screen is not part of this.

## `apps/web/src/features/home/discovery-row/discovery-band.tsx`

### `export function DiscoveryBand(props)`

The page-width band a row sits in on the homepage. It exists so the empty case
is decided in one place: `DiscoveryRow` already renders nothing when it has no
cars, but the band's own padding would still have drawn an empty stripe between
two informational sections.

## `journey-section/` · `trust-section/` · `audience-section/`

The homepage's three explainers, lifted out of `page.tsx` unchanged (R83) so
the page can interleave them with the car rows. Each heading carries an id the
section is labelled by, so each is a named region — which is what the order
tests find them by.
