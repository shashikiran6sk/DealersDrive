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

Today the photograph is static: a file committed under
`apps/web/public/images/` and named here as `{ src, alt }`. It is `null` until a
licensed photograph of an Indian dealership — dealer, customers and yard — is
committed; the prototype's showroom photograph is a fixture and was not used.

**Making it admin-editable later** follows the R44/R81 pattern for public
settings: add a `home.heroImage` key (and its alt text) to `CONFIG_DEFAULTS`
with a reader in `CONFIG_READERS`, expose it on `GET /v1/config/public` as an
`https:` URL checked on the way out (or an uploaded media id resolved against
`MEDIA_BASE_URL`), and pass `config.heroImage ?? HOME_HERO_IMAGE` into
`HeroBanner`. The admin config action already revalidates `CONFIG_TAG`, and the
homepage revalidates every 60 seconds.
