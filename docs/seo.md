# SEO — how the public marketplace is found, read and indexed

This is the operating manual for search. It says what the site tells crawlers,
where each answer is decided, and — most importantly — what happens to a
vehicle URL over its life. Read it before adding a public route or changing a
listing's lifecycle.

There is no "AI SEO" layer and there is not meant to be one. Google Search, AI
Overviews, AI Mode, Bing and the rest read the same things: a crawlable page, a
canonical URL, the facts in server-rendered HTML, and structured data that says
what the page already says. Everything below is one of those four.

---

## 1. The public surface

| Route                     | Rendering                  | Indexable                                   | In the sitemap                     |
| ------------------------- | -------------------------- | ------------------------------------------- | ---------------------------------- |
| `/`                       | ISR, 60 s                  | yes                                         | yes                                |
| `/cars`                   | dynamic                    | the base, each district, plain later pages  | the base and each stocked district |
| `/car/[slug]`             | ISR, 60 s, tag-revalidated | ACTIVE and RESERVED; every other state 404s | ACTIVE and RESERVED                |
| `/dealers`                | dynamic                    | the base, each district, plain later pages  | the base and each district         |
| `/dealers/[slug]`         | ISR, 600 s                 | an ACTIVE dealership with an available car  | the same                           |
| `/contact`                | ISR, 10 min                | yes                                         | yes                                |
| `/support`                | 308 → `/contact`           | —                                           | no                                 |
| `/login`                  | dynamic                    | `noindex, follow`                           | no                                 |
| `/saved`, `/enquiries`    | dynamic, signed in         | `noindex, nofollow`                         | no                                 |
| `/dealer/**`, `/admin/**` | dynamic, signed in         | `noindex, nofollow`                         | no                                 |

Every public page is a server component that fetches its own data before it
renders, so the title, the heading, the price, the specifications, the dealer
and every link to a car or a dealership are in the first HTML response. Client
components (the gallery, the filters, the enquiry panel, the heart) hydrate on
top of that HTML; none of them is where a fact first appears.

## 2. One origin

`WEB_BASE_URL` is the only source of the site's origin. `lib/seo/site.ts` reads
it (`siteUrl()`), and **every** absolute URL the site publishes — canonical,
`og:url`, sitemap `<loc>`, JSON-LD `url` and `@id`, the robots.txt `Sitemap:` —
goes through `absoluteUrl(path)`. There is no second spelling of the domain in
`apps/web/src`.

Production is `https://www.dealers-drive.com` (`deploy/terraform/envs/production.tfvars`,
`deploy/aws/env.production.example`). The apex `dealers-drive.com` redirects to
`www` at the edge; configure the same on the Vercel project.

**Indexing is on only when it is safe.** `indexingEnabled()` is true only when
`APP_ENV=production` **and** the origin is `https:`, not localhost/loopback and
not a `*.vercel.app` preview. Anything else — dev, preview, local, or a
production deploy with a mis-set origin — serves `noindex, nofollow` on every
page and `Disallow: /` in robots.txt. A misconfigured production refuses to be
indexed rather than publishing canonicals that point at `localhost`.

`WEB_BASE_URL` and `APP_ENV` are read at render time, but `/`, `/contact` and
the icons are prerendered at build, so the web build must run with the target
environment's values (it does on Vercel — one build per environment, D7).

## 3. Metadata

`lib/seo/metadata.ts` has the two builders every page uses:

- `rootMetadata()` — the root layout. `metadataBase`, `applicationName`, the
  title template `%s | Dealers-Drive`, the default description, Open Graph and
  Twitter defaults (the 1200×630 brand card at `/og/dealers-drive.png`). It sets
  robots **only** outside production; in production each page states its own,
  so the not-found page carries Next's `noindex` alone.
- `pageMetadata({ title, description, route, images? })` — every public page.
  It resolves the route's indexing policy, writes the absolute canonical, and
  writes Open Graph and Twitter (`summary_large_image`) from the same title,
  description and image. A page with an image of its own (a car's primary
  photograph, a dealership's yard photograph) uses it; otherwise the brand card.

Open Graph and Twitter are written in full on each page because Next replaces a
parent's `openGraph` object rather than merging it.

**Titles** read `<page> | Dealers-Drive`: `Used Cars for Sale`, `Used Cars in
Vellore`, `2022 Maruti Suzuki Brezza ZXI in Mangalagiri`, `Adoni Motor Traders —
Used Car Dealer in Adoni` (the API composes the dealer's, `seo.title`). The home
page is `Dealers-Drive | Used Cars from Verified Independent Dealers`. The brand
is always `Dealers-Drive`.

**Robots.** An indexable page is `index, follow, max-image-preview:large`. There
is no `nosnippet`, `max-snippet` or `noimageindex` anywhere: those would limit
what Search and AI experiences may quote.

**Metadata is always in `<head>`.** Next 15 streams a dynamic page's metadata
into `<body>` for every client not on its "HTML-limited bots" list — which does
not include Googlebot — and Google ignores a canonical outside `<head>`.
`htmlLimitedBots: /.*/` in `next.config.ts` makes metadata blocking for every
client. Each `generateMetadata` awaits the same memoised fetch as its page, so
this costs nothing measurable.

**Icons.** `app/favicon.ico` (16/32/48), `app/icon.png` (512) and
`app/apple-icon.png` (180, full-bleed) are the only icon declarations; Next
writes their `<link>` tags. The root metadata has no `icons` key, so there is
nothing to disagree with. All three are the current header mark: the `#0c0c0b`
rounded tile with `DD` in Manrope 800.

## 4. Faceted navigation — `/cars` and `/dealers`

Every filter, sort, search and page is a URL, and nearly all of them are not
pages anybody should arrive at from a search engine. `lib/seo/policy.ts`
decides, from the URL alone:

| URL                                                       | robots          | canonical                      |
| --------------------------------------------------------- | --------------- | ------------------------------ |
| `/cars`, `/dealers`                                       | index, follow   | itself                         |
| `?district=vellore`                                       | index, follow   | itself                         |
| `?page=3`, `?district=vellore&page=3`                     | index, follow   | itself                         |
| anything else — `q`, any filter, `sort`, `city`, `dealer` | noindex, follow | the district page, or the base |
| any view with no results                                  | noindex, follow | the district page, or the base |

- **Districts are the landing pages** ("used cars in Vellore", "car dealers in
  Kurnool"). They are real navigation — the header's district selector writes
  them — and they are in the sitemap: `/cars?district=` for every district with
  an available car, `/dealers?district=` for every district with an ACTIVE
  dealership.
- **Later pages are self-canonical**, so the cars and dealerships on page 7 stay
  reachable by following links, not only through the sitemap.
- **`noindex, follow`, not `nofollow`**: a filtered page's links are still how
  a crawler reaches the cars on it.
- **An empty view is a 200**, never a 404 — a buyer's filter that matches
  nothing is not a missing page — but it is not indexed.
- A parameter the page does not recognise is dropped by `readVehicleSearch`
  before the policy sees it, so `/cars?utm_source=x` canonicalises to `/cars`.

The dealer portfolio's own inventory filters follow the same rule: a filtered
or sorted portfolio is `noindex, follow`, canonical to `/dealers/[slug]`.

## 5. Sitemap and robots

**`/sitemap.xml`** (`app/sitemap.ts`, built by `lib/seo/sitemap.ts`) lists:

1. `/`, `/cars`, `/dealers`, `/contact` — no `lastmod`; a static page has no
   honest last-changed time and "now" is a lie.
2. The district landing pages above.
3. Every indexable dealership, `lastmod` = the later of its approval and the
   newest change to one of its available cars.
4. Every ACTIVE or RESERVED car, `lastmod` = the later of the listing's and the
   vehicle's `updatedAt`.

The entities come from `GET /v1/sitemap` — slugs and timestamps only, from two
narrow queries (`search.repository.ts`: `sitemapListings`, `sitemapDealers`).
The read is cached for an hour and tagged `vehicles` + `dealers`, so a listing
approved, reserved, sold or withdrawn through the app refreshes it.

If the API is down the sitemap is a **5xx**, not a sitemap missing every car.

**Scale.** One sitemap file holds 50,000 URLs. `SITEMAP_ENTRY_LIMIT` caps each
entity list at 45,000 (vehicles newest-change first). When the marketplace
approaches that, split with `generateSitemaps` into `sitemap/static`,
`sitemap/dealers/0`, `sitemap/cars/0…n`, add a `?page` to `GET /v1/sitemap`,
and serve a sitemap index at `/sitemap.xml`. Nothing else changes.

**`/robots.txt`** (`app/robots.ts`, built by `lib/seo/robots.ts`):

```
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /v1/

Sitemap: https://www.dealers-drive.com/sitemap.xml
```

`/api/` is the BFF (JSON, never a page); `/v1/` is the proxied OAuth round trip.
`/login`, `/dealer/**`, `/admin/**`, `/saved` and `/enquiries` are deliberately
**not** disallowed: they carry `noindex`, and a crawler that may not fetch a page
never sees that. `/_next/` and the media host are not blocked — a page whose
CSS, script or photographs are blocked cannot be rendered or shown in Images.

Outside production (§2) robots.txt is `Disallow: /` with no sitemap.

## 6. Structured data

JSON-LD is built by typed functions in `lib/seo/schemas/` and rendered by
`components/seo/json-ld`, which wraps a page's nodes in one `@graph` and
serialises it with `serializeJsonLd` — `<`, `>`, `&`, U+2028 and U+2029 are
escaped, so a tagline containing `</script>` cannot end the element. Never write
`JSON.stringify` into a `<script>` directly.

**The rule: structured data says only what the page shows.** No rating, review,
opening hours, "certified", "lowest price" or telephone number is emitted,
because none is on the page. A fact the dealer never entered is left out, never
guessed.

| Page              | Nodes                                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `/`               | `Organization` (name, url, logo, footer social links as `sameAs`, footer support email/phone as `contactPoint`) · `WebSite` |
| `/cars`           | `BreadcrumbList` · `ItemList` of the available cars on the page, in page order — indexable views only                       |
| `/car/[slug]`     | `Car` (+ `Offer`) · `BreadcrumbList` Home → Cars → the car                                                                  |
| `/dealers`        | `BreadcrumbList` · `ItemList` of the dealerships on the page — indexable views only                                         |
| `/dealers/[slug]` | `AutoDealer` · `BreadcrumbList` Home → Dealers → the dealership                                                             |

**`Car`** (`schemas/vehicle.ts`) is built from `PublicVehicleDetail.facts` — the
same values the Specifications list prints: `brand`, `model`,
`vehicleConfiguration` (variant), `vehicleModelDate` (year), `bodyType`,
`fuelType`, `vehicleTransmission`, `color`, `mileageFromOdometer` (KMT),
`numberOfPreviousOwners`, `itemCondition: UsedCondition`, every photograph
(primary first), the dealer's description. The registration number, the RTO and
the dealer's phone never appear.

**`Offer`** is present only when the page shows a price. `price` is
`round(pricePaise / 100)` — exactly the rupees the page prints — in `INR`.
`seller` is the dealership, by the same `@id` its own page uses.

**`AutoDealer`** (`schemas/dealer.ts`): name, `legalName`, url, the tagline as
`description`, the yard photograph, `PostalAddress` (street, locality, region,
postcode, `IN`), `hasMap` (the dealer's own Maps link — the page's "Get
directions"), `taxID` (the GSTIN the page prints). **Not** `geo`: those
coordinates come from a pasted share link, fine for centring a map a person
looks at, not for asserting to a search engine. **Not** `telephone`: rule 7.

Schema.org validity and Google rich-result eligibility are different things.
Google's vehicle-listing rich result is limited in region; the `Car`/`Offer`
markup is kept because it is the accurate description of the page and is what
search and AI systems read to understand it.

## 7. Vehicle lifecycle — what happens to a car's URL

A listing's public address is `/car/{slug}`. The slug is minted **once**, at the
first approval (`moderation.service.ts` → `listingSlug`), from year, make, model,
variant and town plus eight random hex characters, and is never rewritten.

| State                                 | `/car/[slug]`                    | Indexed | Sitemap | `/cars` & portfolio                 | `Offer.availability` |
| ------------------------------------- | -------------------------------- | ------- | ------- | ----------------------------------- | -------------------- |
| **ACTIVE**                            | 200, full page, enquiry offered  | yes     | yes     | listed and linked                   | `InStock`            |
| **RESERVED**                          | 200, marked Reserved, no enquiry | yes     | yes     | listed greyed, **not linked**, last | `Reserved`           |
| **SOLD**                              | **404**                          | no      | no      | gone                                | —                    |
| **WITHDRAWN**                         | **404**                          | no      | no      | gone                                | —                    |
| draft, in review, sent back, rejected | 404                              | no      | no      | never shown                         | —                    |
| dealership not ACTIVE                 | 404 for every car it has         | no      | no      | gone                                | —                    |
| never existed / deleted               | 404                              | —       | —       | —                                   | —                    |

- **RESERVED** keeps its page because the reservation may fall through and the
  car return to sale. The page says it is reserved, in the description too, and
  the `Offer` says `https://schema.org/Reserved` — a Schema.org availability
  value, not `InStock`. Google may decline a rich result for it, which is right.
- **SOLD** and **WITHDRAWN** are **404** — product decision R71: a sold or
  withdrawn car leaves every public surface. That is consistent with the rest
  of the product and avoids a stale sales page nobody can act on. A 404 is
  used rather than 410 because the App Router has no 410 for a page; search
  engines treat the two alike for removal. The sold car is not redirected to
  `/cars` or `/` (that would be a soft 404).
  _If the product later wants sold pages kept as "This car has been sold"
  pages_, the change is: let `GET /v1/vehicles/:slug` return SOLD listings for a
  bounded window with `availability: SOLD`, render the notice with links to
  similar cars and the dealer, keep `index` off (`isIndexable: false` in the
  car page's route), `SoldOut` in the `Offer`, and leave them out of the
  sitemap. None of that exists today.
- **Deleted** listings do not exist publicly: only a never-submitted DRAFT can
  be deleted, and it never had a slug. A missing slug is a 404.
- **A slug never changes.** Correcting the make, model, variant, year or the
  dealership's town after approval leaves the slug as it was — a stale word in
  a URL is better than a broken one — so there are no slug redirects to keep.
  If a future change ever re-mints slugs, it must add a table of old → new and
  a **308** from the old one; both URLs must never be served as 200.

Availability reaches crawlers promptly: every lifecycle action revalidates the
`vehicles` cache tag, which the vehicle page, the directories and the sitemap
all read, so the next request after a sale answers 404.

**Missing is not broken.** `/car/[slug]` and `/dealers/[slug]` call `notFound()`
only when the API answered 404 (or 400 for a malformed slug). Any other failure
— the API down, a 500, a contract mismatch — is thrown to the error boundary
and answered **5xx**, so an outage cannot tell a crawler that thousands of cars
stopped existing. Pages already in Next's cache keep serving their last good
render through the outage.

## 8. Dealer pages

`/dealers/[slug]` is indexable when the dealership is ACTIVE **and** has at
least one available car (`seo.isIndexable` from the API). An empty portfolio is
`noindex, follow`: it is a real page, but not one to send anyone to. A
dealership that is not ACTIVE — pending, rejected, suspended, closed — is a 404.
Dealer slugs are minted at onboarding from the registered name and the place,
and never change.

The page states, in server-rendered text: the name (`<h1>`), the tagline, the
full address, city/district/state, GSTIN, hours where given, services, the map
link, and every available car as a crawlable `<a href="/car/…">`. Each car page
links back with "View dealership".

## 9. Images

Listing photographs are Dealers-Drive's own (R45), served from stable public
URLs `${MEDIA_BASE_URL}/by-media/{mediaId}/{width}.webp` — never a presigned or
expiring URL, never a bucket address. Alt text comes from the API: the card's
is `{title}, the primary photograph`, the gallery's `{title}, photograph n of
N`. No angle ("front view") is claimed, because the system does not record one.
The portfolio's yard photograph is alt-texted `{dealer} dealership yard`.

## 10. Adding a public route

1. Fetch its data in the server component; do not make a fact appear only after
   hydration.
2. `generateMetadata` returns `pageMetadata({ title, description, route })`.
   Pick the route kind: `resolved` for an entity (with its canonical path and
   whether it is indexable), `cars`/`dealers` for a directory view, `noindex`
   for a utility page, `private` for anything signed in.
3. If it is indexable and not a directory view, add it to
   `STATIC_SITEMAP_PATHS`, or to the sitemap read if it is an entity.
4. Structured data: build it in `lib/seo/schemas/`, render it with `<JsonLd>`,
   and only from values the page prints.
5. Tests: its metadata (title, canonical, robots in production and outside it)
   and its JSON-LD, beside `tests/unit/app/seo-routes.test.tsx`.
6. Build, `next start` with `APP_ENV=production WEB_BASE_URL=https://www.dealers-drive.com`,
   and read the `<head>` and the JSON-LD with `curl`.

## 11. After each production deployment

In Google Search Console (property `https://www.dealers-drive.com`) and Bing
Webmaster Tools:

1. Submit `https://www.dealers-drive.com/sitemap.xml` (once; re-read automatically).
2. URL-inspect `/`, `/cars`, `/dealers`, one dealership and one available car;
   check "Page is indexable", the Google-selected canonical, and the rendered HTML.
3. Run one car and one dealership through the Rich Results Test and the
   Schema.org validator.
4. Request indexing for the home page and the directories on the first launch.
5. Watch **Pages → Not indexed**: filtered `/cars` URLs should be "Excluded by
   noindex"; sold and withdrawn cars "Not found (404)". Anything else there is a
   regression.
