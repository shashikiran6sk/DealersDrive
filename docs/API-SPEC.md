# Dealers-Drive — Backend API Specification

**Version** v1 · MVP · generated 16 Aug 2026
**Base URL** `https://api.dealers-drive.com`
**Companion to** `ARCHITECTURE.md` (r2) and `DESIGN-SPEC.md`

Every endpoint below exists because a screen needs it. The **Screen** column on each section header names the design that drives it. If you add an endpoint here, name the screen; if you can't, it probably shouldn't exist.

---

## 0. Conventions

### 0.1 Shape

All responses are JSON. Success bodies are the resource itself (or `{ data, page }` for collections) — there is no envelope on the happy path.

```
Content-Type: application/json; charset=utf-8
X-Request-Id: 01J9F2K3M4N5P6Q7R8S9T0
```

### 0.2 Errors — RFC 9457 problem+content

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json
```
```json
{
  "type": "https://dealers-drive.com/errors/insufficient-credits",
  "title": "Not enough listing credits",
  "status": 422,
  "code": "INSUFFICIENT_CREDITS",
  "detail": "Publishing this vehicle needs 1 credit. Your balance is 0.",
  "instance": "/v1/dealer/vehicles/9f1c.../submit",
  "requestId": "01J9F2K3M4N5P6Q7R8S9T0",
  "errors": [
    { "field": "photos", "code": "TOO_FEW", "message": "At least 6 photos are required." }
  ]
}
```

| HTTP | `code` examples |
|---|---|
| 400 | `UNKNOWN_QUERY_PARAM` `MALFORMED_CURSOR` |
| 401 | `NOT_AUTHENTICATED` `SESSION_EXPIRED` |
| 403 | `FORBIDDEN` `DEALER_NOT_ACTIVE` `TWO_FACTOR_REQUIRED` |
| 404 | `NOT_FOUND` `PHONE_NOT_REGISTERED` |
| 409 | `ALREADY_SUBMITTED` `DUPLICATE_ENQUIRY` `INVALID_TRANSITION` |
| 422 | `VALIDATION_FAILED` `INSUFFICIENT_CREDITS` `TOO_FEW_PHOTOS` `PROFILE_INCOMPLETE` |
| 429 | `RATE_LIMITED` (with `Retry-After`) `CAPTCHA_REQUIRED` |
| 500 | `INTERNAL` |

Unknown query parameters are a **400**, never silently ignored.

### 0.3 Auth

Session cookie `dd_session` — `HttpOnly; Secure; SameSite=Lax; Domain=.dealers-drive.com; Max-Age=2592000` for a dealer, 12 hours for an admin. Its value is 32 random bytes; only the SHA-256 is stored, and the row it points at is what makes revocation immediate.

`dealerId` is **always** taken from the session and **never** read from a request body or path — a body containing `dealerId` is a 400.

> `X-CSRF-Token` (double-submit) is specified here but **not implemented**. What protects state-changing routes today is `SameSite=Lax` — the browser will not attach the cookie to a cross-site POST — plus a CORS allow-list naming one origin. Add the token before allowing any third-party origin to call this API with credentials.

### 0.4 Money, dates, phones

- Money in **paise** as a JSON number where safe and as a string where it could exceed 2^53 — all MVP amounts are small, so paise integers are used throughout. `645000` = ₹6,450.00.
- Every price is also returned pre-formatted (`priceLabel: "₹6.45 Lakh"`) so the four surfaces that show it cannot disagree about Lakh rounding.
- Timestamps are ISO-8601 UTC. Display dates are additionally returned pre-formatted (`"02 Aug 2026"`).
- Phones are E.164 (`+919840012345`); a `phoneDisplay` (`"+91 98400 12345"`) accompanies them.

### 0.5 Pagination

| Style | Where | Params | Response |
|---|---|---|---|
| Offset | Public search (SEO needs linkable pages) | `?page=1&limit=24`, capped at page 40 | `{ data, page: { page, limit, total, totalPages } }` |
| Cursor | Dealer + admin lists | `?cursor=<opaque>&limit=20` | `{ data, page: { nextCursor, hasMore } }` |

### 0.6 Idempotency

`POST` routes that create money or credits accept `Idempotency-Key: <uuid>`. A repeat of the same key within 24h returns the original response with `Idempotent-Replay: true`.

---

# PART A — PUBLIC API

No authentication. IP rate-limited. CDN-cacheable except where noted.

---

## A1. `GET /v1/home`
**Screen:** Homepage

Everything above and below the fold in one round trip. Cached 5 minutes at the edge.

**Query:** `?city=vellore` *(optional; omit or `city=all` for all of Tamil Nadu)*

**Response `200`**
```json
{
  "city": { "slug": "vellore", "name": "Vellore", "state": "Tamil Nadu" },
  "activeCount": 18,
  "activeCountLabel": "18 cars available",
  "popularSearches": [
    { "label": "Cars under ₹5L",  "href": "/cars?priceMax=500000" },
    { "label": "Cars under ₹10L", "href": "/cars?priceMax=1000000" },
    { "label": "Automatic",       "href": "/cars?transmission=automatic" },
    { "label": "First owner",     "href": "/cars?owners=1" },
    { "label": "SUVs",            "href": "/cars?bodyType=suv" },
    { "label": "Hatchbacks",      "href": "/cars?bodyType=hatchback" }
  ],
  "featured": [
    {
      "id": "9f1c8e2a-4d5b-4c11-9a3e-77bd0c2f1a01",
      "slug": "2021-toyota-fortuner-2-8-4x2-at-vellore-9f1c8e",
      "year": 2021,
      "title": "Toyota Fortuner 2.8 4x2 AT",
      "pricePaise": 285000000,
      "priceLabel": "₹28.50 Lakh",
      "emiPaise": 5200000,
      "emiLabel": "₹52,000/mo",
      "kmDriven": 38900,
      "kmLabel": "38,900 km",
      "fuel": "DIESEL",
      "fuelLabel": "Diesel",
      "transmission": "AUTOMATIC",
      "transmissionLabel": "Automatic",
      "bodyType": "SUV",
      "city": { "slug": "vellore", "name": "Vellore" },
      "dealer": {
        "slug": "velavan-cars",
        "brandName": "Velavan Cars",
        "initials": "VC",
        "isVerified": true
      },
      "primaryImage": {
        "url": "https://img.dealers-drive.com/v/9f1c8e/640.webp",
        "srcset": "https://img.dealers-drive.com/v/9f1c8e/320.webp 320w, https://img.dealers-drive.com/v/9f1c8e/640.webp 640w, https://img.dealers-drive.com/v/9f1c8e/1024.webp 1024w",
        "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
        "alt": "2021 Toyota Fortuner 2.8 4x2 AT — three-quarter front"
      },
      "photoCount": 11
    }
  ],
  "bodyTypes": [
    { "slug": "hatchback", "label": "Hatchback", "count": 5 },
    { "slug": "sedan",     "label": "Sedan",     "count": 3 },
    { "slug": "suv",       "label": "SUV",       "count": 6 },
    { "slug": "muv",       "label": "MUV",       "count": 4 },
    { "slug": "luxury",    "label": "Luxury",    "count": 0 }
  ],
  "dealers": [
    {
      "slug": "sri-lakshmi-motors",
      "brandName": "Sri Lakshmi Motors",
      "initials": "SL",
      "city": "Vellore",
      "yearsOperating": 12,
      "carCount": 4,
      "isVerified": true,
      "logoUrl": null
    }
  ]
}
```

`bodyTypes[].count` and `dealers[].carCount` are computed live from `listing_search`; a zero-count tile still renders (disabled), never hidden.

---

## A2. `GET /v1/vehicles`
**Screen:** Search results (`/cars`)

**Query parameters** — whitelisted; anything else is a `400 UNKNOWN_QUERY_PARAM`.

| Param | Type | Notes |
|---|---|---|
| `city` | slug | `vellore`; omit for all |
| `q` | string | free text, `websearch_to_tsquery` + trigram fallback |
| `make` `model` `variant` | csv of slugs | |
| `priceMin` `priceMax` | paise | |
| `yearMin` `yearMax` | int | |
| `kmMax` | int | |
| `fuel` | csv | `petrol,diesel,cng,electric,hybrid,lpg` |
| `transmission` | csv | `manual,automatic` |
| `bodyType` | csv | `hatchback,sedan,suv,muv,luxury` |
| `owners` | csv int | `1,2,3` |
| `seats` `airbagsMin` | int | |
| `color` | csv | colour **family** slugs |
| `rtoState` `rto` | code | `TN`, `TN-23` |
| `dealer` | csv of slugs | the sidebar's Dealer group |
| `sort` | enum | `relevance` (default, UI "Recommended") · `price_asc` · `price_desc` · `year_desc` (UI "Newest first") · `km_asc` · `newest` (by `approvedAt`) |
| `page` `limit` | int | default `1` / `24`; `limit` max 48; `page` max 40 |

**Response `200`**
```json
{
  "data": [ "<VehicleCard, exactly as in A1.featured[]>" ],
  "page": { "page": 1, "limit": 24, "total": 3, "totalPages": 1 },
  "resultLabel": "3 cars available",
  "appliedFilters": [
    { "key": "fuel",      "value": "diesel", "label": "Diesel",     "removeHref": "/cars?city=vellore" },
    { "key": "bodyType",  "value": "suv",    "label": "SUV",        "removeHref": "/cars?city=vellore&fuel=diesel" }
  ],
  "clearAllHref": "/cars?city=vellore"
}
```

**Empty `200`** — a valid result, not a 404:
```json
{ "data": [], "page": { "page": 1, "limit": 24, "total": 0, "totalPages": 0 },
  "resultLabel": "0 cars available", "appliedFilters": [], "clearAllHref": "/cars" }
```

---

## A3. `GET /v1/vehicles/facets`
**Screen:** Search results — filter sidebar and mobile filter sheet

Takes the **same** query parameters as A2. Returns counts for each option **as if that facet's own filter were not applied** (standard facet semantics), from one `GROUPING SETS` query, cached 60 s. Options with count 0 are returned and rendered disabled — never omitted.

**Response `200`**
```json
{
  "priceRange": { "min": 22500000, "max": 285000000, "step": 5000000,
                  "minLabel": "₹2.25 Lakh", "maxLabel": "₹28.50 Lakh" },
  "fuel": [
    { "value": "petrol", "label": "Petrol", "count": 13 },
    { "value": "diesel", "label": "Diesel", "count": 5 },
    { "value": "cng",    "label": "CNG",    "count": 0 }
  ],
  "bodyType": [
    { "value": "hatchback", "label": "Hatchback", "count": 5 },
    { "value": "sedan",     "label": "Sedan",     "count": 3 },
    { "value": "suv",       "label": "SUV",       "count": 6 },
    { "value": "muv",       "label": "MUV",       "count": 4 }
  ],
  "transmission": [
    { "value": "manual",    "label": "Manual",    "count": 10 },
    { "value": "automatic", "label": "Automatic", "count": 8 }
  ],
  "dealer": [
    { "value": "sri-lakshmi-motors", "label": "Sri Lakshmi Motors", "count": 4 },
    { "value": "anbu-auto-hub",      "label": "Anbu Auto Hub",      "count": 5 },
    { "value": "velavan-cars",       "label": "Velavan Cars",       "count": 5 },
    { "value": "mrv-motors",         "label": "MRV Motors",         "count": 4 }
  ],
  "owners":  [ { "value": "1", "label": "First owner",  "count": 10 },
               { "value": "2", "label": "Second owner", "count": 6 },
               { "value": "3", "label": "Third owner",  "count": 2 } ],
  "color":   [ { "value": "white", "label": "White", "count": 7 } ],
  "rtoState":[ { "value": "TN", "label": "Tamil Nadu", "count": 18 } ]
}
```

---

## A4. `POST /v1/vehicles/batch`
**Screen:** Saved cars · customer header badge

Hydrates ids held in the buyer's `localStorage`. There are no buyer accounts, so this is how a saved list becomes cards.

**Request**
```json
{ "ids": ["9f1c8e2a-4d5b-4c11-9a3e-77bd0c2f1a01", "3b7d1f40-88ca-4e02-b1a7-2c9e5d33aa10"] }
```
Max 100 ids per call.

**Response `200`**
```json
{
  "data": [ "<VehicleCard>" ],
  "unavailable": [
    { "id": "3b7d1f40-88ca-4e02-b1a7-2c9e5d33aa10", "reason": "SOLD" }
  ],
  "savedCountLabel": "1 car saved"
}
```

`reason` is one of `SOLD` `EXPIRED` `REMOVED` `NOT_FOUND`. The client prunes those ids from `localStorage`. A car that has left the catalogue must never 404 the whole request.

---

## A5. `GET /v1/vehicles/{idOrSlug}`
**Screen:** Vehicle detail (VDP)

**Response `200`**
```json
{
  "id": "9f1c8e2a-4d5b-4c11-9a3e-77bd0c2f1a01",
  "slug": "2021-toyota-fortuner-2-8-4x2-at-vellore-9f1c8e",
  "listingId": "b2a55d10-9cf1-4a77-8e21-6d0e4c93bb22",
  "year": 2021,
  "title": "Toyota Fortuner 2.8 4x2 AT",
  "make":    { "slug": "toyota",   "name": "Toyota" },
  "model":   { "slug": "fortuner", "name": "Fortuner" },
  "variant": { "slug": "2-8-4x2-at", "name": "2.8 4x2 AT" },
  "summary": "First owner · Vellore, Tamil Nadu · TN 23 registration",
  "price": {
    "pricePaise": 285000000,
    "priceLabel": "₹28.50 Lakh",
    "emiLabel": "EMI from ₹52,000/month",
    "negotiable": "SLIGHTLY",
    "negotiableLabel": "Fixed price, no hidden charges"
  },
  "specs": [
    { "key": "year",         "label": "Year",         "value": "2021" },
    { "key": "km",           "label": "KM driven",    "value": "38,900 km" },
    { "key": "fuel",         "label": "Fuel",         "value": "Diesel" },
    { "key": "transmission", "label": "Transmission", "value": "Automatic" },
    { "key": "owners",       "label": "Ownership",    "value": "First owner" },
    { "key": "registration", "label": "Registration", "value": "TN 23 · Vellore" },
    { "key": "insurance",    "label": "Insurance",    "value": "Comprehensive, valid to Mar 2027" },
    { "key": "bodyType",     "label": "Body type",    "value": "SUV" }
  ],
  "features": ["Sunroof","6 airbags","ABS with EBD","Android Auto","Cruise control",
               "Reverse camera","Push-button start","Alloy wheels","Climate control"],
  "description": "Well-maintained Fortuner serviced only at the authorised centre — full service history available for inspection at our yard. Original paint on all panels except the left rear door. New tyres fitted in January 2026, insurance valid to March 2027. RC transfer and loan assistance handled in-house.",
  "photos": [
    { "id": "m-01", "position": 0, "label": "Three-quarter front",
      "url":    "https://img.dealers-drive.com/v/9f1c8e/m-01/1600.webp",
      "srcset": "https://img.dealers-drive.com/v/9f1c8e/m-01/320.webp 320w, …",
      "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
      "width": 1600, "height": 1200 }
  ],
  "photoCount": 11,
  "photoCountLabel": "11 photos · view all",
  "dealer": {
    "slug": "velavan-cars",
    "brandName": "Velavan Cars",
    "initials": "VC",
    "city": "Vellore",
    "carCount": 5,
    "carCountLabel": "Vellore · 5 cars listed",
    "isVerified": true,
    "logoUrl": null
  },
  "seo": {
    "canonical": "https://dealers-drive.com/car/2021-toyota-fortuner-2-8-4x2-at-vellore-9f1c8e",
    "title": "2021 Toyota Fortuner 2.8 4x2 AT in Vellore — ₹28.50 Lakh | Dealers-Drive",
    "description": "First owner, 38,900 km, Diesel, Automatic. Listed by Velavan Cars, a verified dealer in Vellore.",
    "isIndexable": true
  }
}
```

> **The dealer's phone number is deliberately absent.** It appears in no public response body and in no server-rendered HTML. Verify with `curl … | grep -F '+91'`. It is obtainable only through A7.

**`404`** if the listing is not `APPROVED`, the dealer is not `ACTIVE`, or the vehicle is soft-deleted.

---

## A6. `GET /v1/vehicles/{id}/similar`
**Screen:** VDP (below the fold)

**Query:** `?limit=4`
**Response `200`** — `{ "data": [ "<VehicleCard>" ] }`

Same body type and city, price within ±25%, excluding the same vehicle. Falls back to same city, then same body type.

---

## A7. `POST /v1/vehicles/{id}/reveal-contact`
**Screen:** VDP `Call dealer` · Portfolio `Call dealership`

The anti-scraping gate. Writes a `PhoneReveal` **and** an `Enquiry` with `source: "CALL_BUTTON"` — the dealer sees the tap in their inbox.

**Request**
```json
{ "captchaToken": "0.AbCdEf…", "name": null }
```
`captchaToken` is required only after the third reveal from an IP in 24 h; the `429 CAPTCHA_REQUIRED` response tells the client to render the widget and retry.

**Response `200`**
```json
{
  "phone": "+919444190210",
  "phoneDisplay": "+91 94441 90210",
  "dealer": { "slug": "velavan-cars", "brandName": "Velavan Cars" },
  "callHref": "tel:+919444190210",
  "whatsappHref": "https://wa.me/919444190210",
  "revealsRemainingToday": 17
}
```

**`429`**
```json
{
  "type": "https://dealers-drive.com/errors/captcha-required",
  "title": "Please confirm you're not a robot",
  "status": 429, "code": "CAPTCHA_REQUIRED",
  "detail": "Complete the challenge to see this number.",
  "captchaSiteKey": "0x4AAAAAAA…"
}
```

Limits: 10/hour and 20/day per IP; over 20/day the IP is blocked and flagged.

---

## A8. `GET /v1/dealers`
**Screen:** Dealer directory (`/dealers`)

**Query:** `?city=vellore&q=lakshmi&page=1&limit=24`

**Response `200`**
```json
{
  "data": [
    {
      "slug": "sri-lakshmi-motors",
      "brandName": "Sri Lakshmi Motors",
      "initials": "SL",
      "city": "Vellore",
      "state": "Tamil Nadu",
      "yearsOperating": 12,
      "yearsLabel": "Vellore, Tamil Nadu · 12 years",
      "tagline": "Family-run since 2014 — single-owner cars with full service history.",
      "services": ["In-house workshop", "RC transfer assistance", "Bank loan tie-ups"],
      "carCount": 4,
      "fromPricePaise": 64000000,
      "fromPriceLabel": "from ₹6.40 Lakh",
      "isVerified": true,
      "logoUrl": null,
      "coverUrl": null
    }
  ],
  "page": { "page": 1, "limit": 24, "total": 4, "totalPages": 1 },
  "countLabel": "4 verified dealerships",
  "cities": [
    { "slug": "vellore", "name": "Vellore", "count": 2 },
    { "slug": "katpadi", "name": "Katpadi", "count": 1 },
    { "slug": "ranipet", "name": "Ranipet", "count": 1 }
  ]
}
```

`carCount` and `fromPricePaise` count only `APPROVED` listings. A dealer with zero live cars still appears, with `fromPriceLabel: "—"`.

---

## A9. `GET /v1/dealers/{slug}`
**Screen:** Dealer portfolio — header, stat tiles, info row

**Response `200`**
```json
{
  "slug": "sri-lakshmi-motors",
  "brandName": "Sri Lakshmi Motors",
  "legalName": "Sri Lakshmi Automobiles Pvt Ltd",
  "initials": "SL",
  "isVerified": true,
  "about": "A family-run dealership operating on Katpadi Main Road since 2014. We buy directly from single-owner customers in and around Vellore, put every car through a 120-point check at our own workshop, and sell with the full service history in hand. RC transfer, loan tie-ups and insurance renewal are handled in-house.",
  "services": ["In-house workshop","RC transfer assistance","Bank loan tie-ups","Exchange accepted","7-day return window"],
  "address": {
    "line": "14, Katpadi Main Road, Gandhi Nagar",
    "city": "Vellore", "state": "Tamil Nadu", "pincode": "632006",
    "full": "14, Katpadi Main Road, Gandhi Nagar, Vellore 632006, Tamil Nadu",
    "lat": 12.9165, "lng": 79.1325,
    "directionsUrl": "https://www.google.com/maps/dir/?api=1&destination=12.9165,79.1325"
  },
  "stats": [
    { "key": "cars",     "label": "Cars available",  "value": "4" },
    { "key": "years",    "label": "Years operating", "value": "12" },
    { "key": "location", "label": "Location",        "value": "Vellore" },
    { "key": "response", "label": "Response time",   "value": "< 2 hrs" }
  ],
  "contact": [
    { "key": "phone", "label": "Phone",  "value": "Tap to reveal", "masked": true },
    { "key": "city",  "label": "City",   "value": "Vellore, Tamil Nadu" },
    { "key": "gstin", "label": "GSTIN",  "value": "33AABCS1429P1ZK", "mono": true },
    { "key": "hours", "label": "Open",   "value": "Mon–Sat, 9:30am – 8:00pm" }
  ],
  "logoUrl": null,
  "coverUrl": null,
  "seo": {
    "canonical": "https://dealers-drive.com/dealers/sri-lakshmi-motors",
    "title": "Sri Lakshmi Motors — used cars in Vellore | Dealers-Drive",
    "isIndexable": true
  }
}
```

Note `contact[0].masked: true` — the phone is not in the payload. `GSTIN` **is** public (it is on every Indian invoice); PAN and the KYC documents never are.

---

## A10. `GET /v1/dealers/{slug}/vehicles`
**Screen:** Dealer portfolio — inventory grid

Same filter/sort/pagination grammar as A2, scoped to the dealer.

**Response `200`**
```json
{
  "data": [ "<VehicleCard>" ],
  "page": { "page": 1, "limit": 24, "total": 4, "totalPages": 1 },
  "resultLabel": "4 of 4 cars"
}
```

## A11. `GET /v1/dealers/{slug}/facets`
**Screen:** Dealer portfolio — inventory filter sidebar

Identical shape to A3, counted **within this dealer's live inventory only**. Zero-count rows are returned so the UI can dim them at `opacity: 0.4` while keeping them operable.

---

## A12. `GET /v1/cities`
**Screen:** Customer header city selector · homepage

**Response `200`**
```json
{
  "data": [
    { "slug": "all",        "name": "All of Tamil Nadu", "count": 18 },
    { "slug": "vellore",    "name": "Vellore",    "state": "Tamil Nadu", "count": 9 },
    { "slug": "katpadi",    "name": "Katpadi",    "state": "Tamil Nadu", "count": 4 },
    { "slug": "ranipet",    "name": "Ranipet",    "state": "Tamil Nadu", "count": 2 },
    { "slug": "arcot",      "name": "Arcot",      "state": "Tamil Nadu", "count": 2 },
    { "slug": "gudiyattam", "name": "Gudiyattam", "state": "Tamil Nadu", "count": 1 }
  ],
  "default": "vellore"
}
```

Counts are live `APPROVED` totals, cached 60 s.

---

## A13. `GET /v1/catalog/bundle`
**Screen:** Add-vehicle wizard dropdowns · search filters

Cached 1 hour, `ETag`-validated. Dealers never free-type make/model/variant/colour/RTO (§6.2).

**Response `200`**
```json
{
  "version": "2026-08-16T04:00:00Z",
  "makes": [
    { "id": "…", "slug": "maruti-suzuki", "name": "Maruti Suzuki", "popularity": 100,
      "models": [
        { "id": "…", "slug": "swift", "name": "Swift", "bodyType": "HATCHBACK",
          "yearFrom": 2005, "yearTo": null,
          "variants": [
            { "id": "…", "slug": "vxi", "name": "VXi", "fuel": "PETROL",
              "transmission": "MANUAL", "engineCc": 1197, "seats": 5 }
          ] }
      ] }
  ],
  "cities":  [ { "id": "…", "slug": "vellore", "name": "Vellore", "state": "Tamil Nadu" } ],
  "rto":     [ { "code": "TN-23", "name": "Vellore", "city": "Vellore", "state": "Tamil Nadu" } ],
  "colors":  [ { "id": "…", "slug": "pearl-white", "name": "Pearl White", "hex": "#F2F3F4", "family": "white" } ],
  "fuels":         [ { "value": "PETROL", "label": "Petrol" }, { "value": "DIESEL", "label": "Diesel" }, { "value": "CNG", "label": "CNG" } ],
  "transmissions": [ { "value": "MANUAL", "label": "Manual" }, { "value": "AUTOMATIC", "label": "Automatic" } ],
  "bodyTypes":     [ { "value": "HATCHBACK", "label": "Hatchback" }, { "value": "SEDAN", "label": "Sedan" }, { "value": "SUV", "label": "SUV" }, { "value": "MUV", "label": "MUV" }, { "value": "LUXURY", "label": "Luxury" } ],
  "owners":        [ { "value": 1, "label": "First owner" }, { "value": 2, "label": "Second owner" }, { "value": 3, "label": "Third owner" } ],
  "features":      [ "Sunroof", "6 airbags", "ABS with EBD", "Android Auto", "Cruise control", "Reverse camera", "Push-button start", "Alloy wheels", "Climate control" ]
}
```

---

## A14. `GET /v1/config/public`

**Response `200`**
```json
{
  "mediaBaseUrl": "https://img.dealers-drive.com",
  "captchaSiteKey": "0x4AAAAAAA…",
  "supportEmail": "support@dealers-drive.com",
  "supportPhone": "+914162248890",
  "minPhotosPerListing": 6,
  "listingDurationDays": 90,
  "enquiryRateLimitPerHour": 5,
  "photoRequestsEnabled": false
}
```

---

## A15. `POST /v1/enquiries`
**Screens:** VDP `Enquire now` → Enquiry sent · Portfolio `Enquire with dealer`

Exactly one of `vehicleId` / `dealerSlug` must be present.

**Request — from a VDP**
```json
{
  "vehicleId": "9f1c8e2a-4d5b-4c11-9a3e-77bd0c2f1a01",
  "name": "Karthik Raja",
  "phone": "9840722118",
  "email": "karthik.raja@example.com",
  "message": "Is the price negotiable? Can I see it on Saturday morning?",
  "source": "LISTING_PAGE",
  "captchaToken": null,
  "website": ""
}
```
`website` is the honeypot — non-empty means a bot, and the server returns a normal `201` with a fabricated reference while writing nothing.

**Request — from a dealer portfolio**
```json
{
  "dealerSlug": "sri-lakshmi-motors",
  "name": "Priya Selvam",
  "phone": "9003188420",
  "message": "Do you have any automatic hatchbacks under ₹7 Lakh?",
  "source": "DEALER_PAGE",
  "website": ""
}
```

**Response `201`**
```json
{
  "reference": "DD-EN-40912",
  "createdAt": "2026-08-16T09:11:42Z",
  "dealer": {
    "slug": "velavan-cars",
    "brandName": "Velavan Cars",
    "responseTimeLabel": "typically responds within 2 hours"
  },
  "vehicle": {
    "id": "9f1c8e2a-4d5b-4c11-9a3e-77bd0c2f1a01",
    "slug": "2021-toyota-fortuner-2-8-4x2-at-vellore-9f1c8e",
    "title": "Toyota Fortuner 2.8 4x2 AT",
    "priceLabel": "₹28.50 Lakh",
    "city": "Vellore",
    "thumbnailUrl": "https://img.dealers-drive.com/v/9f1c8e/320.webp"
  },
  "isDuplicate": false
}
```

Same phone + same vehicle within 24 h returns `200` with the **original** reference and `isDuplicate: true`, and does not re-notify the dealer.

**`429`** — `RATE_LIMITED` after 5/hour per IP; `captchaToken` required after the 2nd.
**`422`** — `VALIDATION_FAILED` with per-field `errors[]` for the inline form.

---

# PART B — AUTH

> **Revised, r3.** Dealer sign-in was specified as phone OTP with an email
> fallback, and admin sign-in as password + mandatory TOTP. Both were replaced
> before implementation: **dealers sign in with Google**, and **admins sign in
> with an email and a password, with no second factor**. The OTP endpoints
> (`B1`–`B3`) and the 2FA challenge (`B7`) do not exist. This part describes what
> is implemented; `docs/CLAUDE.md §5` records the decision.

Both flows end in the same place: an opaque `dd_session` cookie backed by a row
in `sessions`, revocable on the next request (ARCHITECTURE §8.2).

---

## B1. `GET /v1/auth/providers`
**Screen:** Dealer sign-in

Lets the sign-in screen render a working button or an explanation, rather than a
button that fails on click.

**Response `200`**
```json
{
  "google": {
    "enabled": true,
    "startUrl": "http://localhost:4000/v1/auth/google/start",
    "reason": null
  }
}
```
`enabled` is false when the deployment has no Google client configured; `reason`
then names the missing variables. `Cache-Control: no-store`.

---

## B2. `GET /v1/auth/google/start`
**Screen:** Dealer sign-in — `[ Continue with Google ]`

A browser navigation, not an API call. Mints `state`, an OIDC `nonce` and a PKCE
verifier, seals all three into a 10-minute HttpOnly `dd_oauth` cookie, and
redirects to Google's authorization endpoint with `code_challenge_method=S256`,
`scope=openid email profile`, `access_type=online` and `prompt=select_account`.

**Query** `?returnTo=/dealer/inventory` — optional, and a **path**. An absolute
URL, a protocol-relative `//host`, or anything containing a backslash or newline
is replaced with `/dealer`: a callback that redirects wherever the caller asks is
an open redirect, and an open redirect on an OAuth callback leaks sessions.

**Response `302`** — `Location: https://accounts.google.com/o/oauth2/v2/auth?…`,
`Set-Cookie: dd_oauth=…; HttpOnly; SameSite=Lax; Max-Age=600`

**`503 OAUTH_NOT_CONFIGURED`** when the deployment holds no Google credentials.
The `detail` names the two variables and the redirect URI to register — it is
written for the developer who has to fix it.

---

## B3. `GET /v1/auth/google/callback`
**Screen:** none — Google redirects the browser here

**Query** `?code=…&state=…`, or `?error=access_denied` when the person declined
at Google.

1. `state` is compared with the sealed `dd_oauth` cookie, which is then spent —
   a callback with no cookie, a stale cookie or somebody else's state is refused
   before the code is worth anything.
2. The code is redeemed at Google's token endpoint with the PKCE verifier and
   the client secret, server-to-server.
3. The identity token's `iss`, `aud`, `exp` and `nonce` are checked. Its
   signature is not, and that is correct rather than a shortcut: OpenID Connect
   Core §3.1.3.7 item 6 permits it for a token received directly from the token
   endpoint over validated TLS, which is exactly this position.
4. `email_verified` must be true. An unverified Google email is an address
   somebody typed, not one Google checked.
5. The account is found by `(provider, sub)` — **never by email**. A `sub` is
   stable; an email address is not, and matching on it would let an expired
   domain become somebody else's inventory.

**Response `302`** — `Set-Cookie: dd_session=…; HttpOnly; SameSite=Lax`, then:

| Situation | Location |
|---|---|
| Known identity, dealership active | the requested `returnTo`, default `/dealer` |
| Known identity, dealership `DRAFT` or `PENDING_APPROVAL` | `/dealer/onboarding` |
| First sign-in — no dealership yet | `/dealer/onboarding` |

Every failure redirects to `/dealer/login?error=<code>` instead, so the person
sees the product's own error state rather than a JSON body in the address bar:
`sign_in_failed` · `identity_unverified` · `google_declined` ·
`invalid_callback` · `account_link_required` · `account_suspended`.

`account_link_required` is the account-linking policy: a verified Google email
that already belongs to an account is **not** a way into it. Linking is
deliberate, and is not self-service.

---

## B4. `GET /v1/auth/me`
**Screen:** every authenticated shell (top bar credits, sidebar, verified tag),
and the onboarding wizard

One shape covers both states, because the client has one branch to write.

**Response `200`**
```json
{
  "next": "DASHBOARD",
  "user": {
    "id": "c41f…", "fullName": "R. Manikandan", "roleTitle": "Proprietor",
    "phone": "+919840012345", "phoneDisplay": "+91 98400 12345",
    "email": "owner@srilakshmimotors.in", "emailVerified": true
  },
  "identity": {
    "provider": "GOOGLE", "email": "owner@srilakshmimotors.in",
    "name": "R. Manikandan", "pictureUrl": null
  },
  "dealer": {
    "id": "8d20…", "slug": "sri-lakshmi-motors", "brandName": "Sri Lakshmi Motors",
    "status": "ACTIVE", "statusLabel": "Verified", "isVerified": true,
    "creditBalance": 23, "creditsHeld": 1
  },
  "role": "OWNER",
  "permissions": ["vehicle:read", "vehicle:write", "…"],
  "counts": { "newEnquiries": 12, "pendingListings": 1 }
}
```

`next` is `DASHBOARD` · `ONBOARDING` (no dealership yet, or still `DRAFT`) ·
`PENDING_APPROVAL` (submitted, awaiting an admin). Before onboarding, `dealer`
and `role` are `null` and `permissions` is empty — a verified identity is not a
tenant. `identity` is the Google account, which is what the onboarding screen
displays instead of asking for an email again.

**`401 NOT_AUTHENTICATED`** when there is no valid session. `Cache-Control:
no-store`.

---

## B5. `POST /v1/auth/onboarding`
**Screen:** Dealer onboarding, steps 1–2

The one endpoint a session with no dealership may call.

**Request**
```json
{
  "fullName": "R. Manikandan", "roleTitle": "Proprietor", "phone": "9840012345",
  "brandName": "Sri Lakshmi Motors", "legalName": "Sri Lakshmi Automobiles Pvt Ltd",
  "addressLine": "14, Katpadi Main Road, Gandhi Nagar",
  "citySlug": "vellore", "pincode": "632006", "landline": "0416 224 8890"
}
```

No `email` — it comes from the Google identity on the session, and accepting one
here would let a caller claim an address Google never verified. No `status` and
no `slug`: approval is the admin's decision and the slug is derived from the
brand name (rules 1 and 5).

**Response `201`** — the B4 body. One transaction creates the user's details, the
dealership in `DRAFT`, the `OWNER` membership and the three KYC placeholders.

**`403 DEALER_ALREADY_EXISTS`** · **`409 PHONE_ALREADY_REGISTERED`** ·
**`422 UNKNOWN_CITY`**

---

## B6. `POST /v1/auth/logout`
**Response `204`** — revokes the `sessions` row behind the presented cookie and
clears the cookie. The row is what makes it real: the token stops working
everywhere, rather than being forgotten by one browser.

---

## B7. `POST /v1/auth/admin/login`
**Screen:** `/admin/login`

**Request** `{ "email": "ops@dealers-drive.in", "password": "…" }`

**Response `200`** — sets `dd_session` with `scope = ADMIN` and a 12-hour expiry
```json
{
  "admin": { "id": "…", "email": "ops@dealers-drive.in", "fullName": "…", "adminRole": "SUPER_ADMIN" },
  "permissions": ["admin:dealer:approve", "admin:listing:moderate", "…"],
  "sessionExpiresAt": "2026-08-19T03:52:38.000Z"
}
```

**`401 INVALID_CREDENTIALS`** for a wrong password *and* for an unknown account —
same status, same message, and a decoy Argon2id verification so the timing
matches too. There is no admin sign-up endpoint, and there never should be.

**Rate limits:** 5 attempts per email per 15 minutes, 20 per IP per 15 minutes.

## B8. `POST /v1/auth/admin/logout`
**Response `204`** — as B6. Unguarded: signing out has to work after the session
has already expired, and it can only ever revoke the caller's own token.

---

# PART C — DEALER API

Session + membership required. **`dealerId` always comes from the session.** Sending it in a body is a `400`.

---

## C1. `GET /v1/dealer`
**Screen:** Onboarding (prefill) · Dealer profile

**Response `200`**
```json
{
  "id": "8d20…", "slug": "sri-lakshmi-motors",
  "status": "ACTIVE", "statusLabel": "Verified", "statusReason": null,
  "brandName": "Sri Lakshmi Motors",
  "legalName": "Sri Lakshmi Automobiles Pvt Ltd",
  "tagline": "Family-run since 2014 — single-owner cars with full service history.",
  "about": "A family-run dealership operating on Katpadi Main Road since 2014. …",
  "gstin": "33AABCS1429P1ZK",
  "pan": "AABCS1429P",
  "contact": {
    "fullName": "R. Manikandan", "roleTitle": "Proprietor",
    "phone": "+919840012345", "phoneDisplay": "+91 98400 12345",
    "email": "owner@srilakshmimotors.in",
    "landline": "0416 224 8890"
  },
  "address": { "line": "14, Katpadi Main Road, Gandhi Nagar", "cityId": "…",
               "city": "Vellore", "state": "Tamil Nadu", "pincode": "632006" },
  "specialities": ["In-house workshop","RC transfer assistance","Bank loan tie-ups",
                   "Exchange accepted","7-day return window"],
  "workingHours": { "mon_sat": "09:30-20:00", "sun": null },
  "establishedYear": 2014,
  "logoMediaId": null, "coverMediaId": null,
  "creditBalance": 23, "creditsHeld": 1,
  "activeListings": 4,
  "approvedAt": "2025-03-14T06:00:00Z",
  "createdAt": "2025-03-12T11:20:00Z"
}
```

## C2. `PATCH /v1/dealer`
**Screens:** Onboarding steps 1–3 · Dealer profile

Partial. Each wizard step PATCHes only its own fields, so `Back` never loses data.

**Request — step 1**
```json
{ "contact": { "fullName": "R. Manikandan", "roleTitle": "Proprietor",
               "email": "owner@srilakshmimotors.in" } }
```
**Request — step 2**
```json
{
  "brandName": "Sri Lakshmi Motors",
  "legalName": "Sri Lakshmi Automobiles Pvt Ltd",
  "address": { "line": "14, Katpadi Main Road, Gandhi Nagar",
               "cityId": "c-vellore", "state": "Tamil Nadu", "pincode": "632006" },
  "contact": { "landline": "0416 224 8890" }
}
```
**Request — step 3**
```json
{ "gstin": "33AABCS1429P1ZK", "pan": "AABCS1429P" }
```

**Response `200`** — the full C1 body.
`phone` is **not** patchable here (it is the login identity; changing it needs an OTP flow on the new number).
**`422`** — GSTIN must match `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`; PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`.

---

## C3. `GET /v1/dealer/completeness`
**Screen:** Onboarding stepper · submit gating

**Response `200`**
```json
{
  "isComplete": false,
  "canSubmit": false,
  "percent": 75,
  "steps": [
    { "key": "account",  "label": "Account",   "complete": true,  "missing": [] },
    { "key": "business", "label": "Business",  "complete": true,  "missing": [] },
    { "key": "documents","label": "Documents", "complete": false,
      "missing": ["ADDRESS_PROOF"] },
    { "key": "review",   "label": "Review",    "complete": false, "missing": [] }
  ]
}
```

## C4. `POST /v1/dealer/submit`
**Screen:** Onboarding step 3 → step 4 (`Submit for verification`)

`DRAFT → PENDING_APPROVAL`. No request body.

**Response `200`**
```json
{
  "status": "PENDING_APPROVAL",
  "statusLabel": "Under review",
  "submittedAt": "2026-08-16T09:20:00Z",
  "expectedDecisionBy": "2026-08-17T09:20:00Z",
  "message": "We verify GSTIN, PAN and address proof against government records. Most dealerships are approved within one working day."
}
```
**`422 PROFILE_INCOMPLETE`** with the `errors[]` array naming each missing field.

---

## C5. Dealer KYC documents
**Screen:** Onboarding step 3

### `GET /v1/dealer/documents`
```json
{
  "data": [
    { "type": "GST_CERTIFICATE", "label": "GST certificate", "status": "UPLOADED",
      "statusLabel": "gst-cert.pdf · uploaded", "fileName": "gst-cert.pdf",
      "uploadedAt": "2026-08-16T09:14:00Z", "rejectionReason": null, "action": "Replace" },
    { "type": "PAN_CARD", "label": "PAN card", "status": "UPLOADING",
      "statusLabel": "Uploading — 62%", "fileName": "pan.jpg",
      "progress": 62, "action": "Cancel" },
    { "type": "ADDRESS_PROOF", "label": "Address proof", "status": "REQUIRED",
      "statusLabel": "Required — PDF or JPG, max 5 MB", "fileName": null, "action": "Upload" }
  ],
  "allVerified": false
}
```

### `POST /v1/dealer/documents/presign`
**Request** `{ "type": "ADDRESS_PROOF", "fileName": "eb-bill.pdf", "mimeType": "application/pdf", "bytes": 812004 }`
**Response `201`**
```json
{
  "documentId": "…",
  "uploadUrl": "https://r2.dealers-drive.com/kyc/8d20…/ADDRESS_PROOF/…?X-Amz-Signature=…",
  "method": "PUT",
  "headers": { "Content-Type": "application/pdf", "Content-Length": "812004" },
  "expiresInSeconds": 300
}
```
Allowlist `application/pdf`, `image/jpeg`, `image/png`; max 5 MB. Content-type **and** content-length are baked into the signature.

### `POST /v1/dealer/documents/{type}/commit`
**Request** `{ "documentId": "…" }`
**Response `200`** — the single document row, `status: "UPLOADED"`.

### `DELETE /v1/dealer/documents/{type}` → `204`

> KYC media is stored under a private prefix with **no public delivery route**. There is no dealer or buyer endpoint that returns a document URL.

---

## C6. `GET /v1/dealer/vehicles`
**Screen:** Inventory

**Query:** `?status=ACTIVE|PENDING|DRAFT|REJECTED|EXPIRED|SOLD&cursor=&limit=20&q=`

**Response `200`**
```json
{
  "data": [
    {
      "vehicleId": "…", "listingId": "…",
      "title": "2021 Maruti Suzuki Swift VXi",
      "thumbnailUrl": "https://img.dealers-drive.com/v/…/320.webp",
      "pricePaise": 64500000, "priceLabel": "₹6.45 Lakh",
      "kmLabel": "42,180 km", "fuelLabel": "Petrol",
      "metaLabel": "42,180 km · Petrol",
      "displayStatus": "ACTIVE", "statusLabel": "Active", "statusTone": "ok",
      "views": 412, "enquiries": 9,
      "expiresAt": "2026-10-12T00:00:00Z", "expiryLabel": "12 Oct 2026",
      "rejectionReason": null,
      "canEdit": true, "canResubmit": false, "canRenew": false, "canMarkSold": true
    },
    {
      "vehicleId": "…", "listingId": "…",
      "title": "2020 Mahindra XUV300 W8 (O)",
      "pricePaise": 87500000, "priceLabel": "₹8.75 Lakh",
      "displayStatus": "PENDING", "statusLabel": "Pending review", "statusTone": "warn",
      "views": 0, "enquiries": 0,
      "expiresAt": null, "expiryLabel": "—",
      "submittedLabel": "4 hours ago",
      "canEdit": false, "canResubmit": false, "canRenew": false, "canMarkSold": false
    }
  ],
  "page": { "nextCursor": null, "hasMore": false },
  "totalCount": 8,
  "countLabel": "8 vehicles",
  "banner": {
    "type": "REJECTED",
    "listingId": "…",
    "title": "2016 Ford EcoSport Titanium was rejected",
    "reason": "Odometer photo does not match the declared KM reading.",
    "actionLabel": "Edit & resubmit",
    "actionHref": "/dealer/vehicles/…/edit"
  }
}
```

`statusTone` is `ok` `warn` `err` `neutral` `accent`, mapping directly to the badge fills in DESIGN-SPEC §2.5. `banner` is `null` when nothing needs attention.

---

## C7. `POST /v1/dealer/vehicles`
**Screen:** Add vehicle — step 1, and `Save draft`

**Request**
```json
{
  "makeId": "mk-maruti", "modelId": "md-baleno", "variantId": "vr-zeta-at",
  "year": 2022, "fuel": "PETROL", "transmission": "AUTOMATIC", "bodyType": "HATCHBACK"
}
```
**Response `201`**
```json
{ "id": "…", "status": "DRAFT", "displayStatus": "DRAFT", "slug": null,
  "completeness": { "percent": 25, "missing": ["kmDriven","ownerNumber","colorId","photos","pricePaise"] } }
```

## C8. `PATCH /v1/dealer/vehicles/{id}`
**Screens:** Add vehicle steps 2 and 4 · Edit

**Request — step 2 (Details)**
```json
{
  "kmDriven": 29400, "ownerNumber": 1, "colorId": "cl-pearl-white",
  "rtoCode": "TN-23", "insuranceType": "COMPREHENSIVE",
  "insuranceValidTill": "2027-03-31", "cityId": "c-vellore"
}
```
**Request — step 4 (Price & review)**
```json
{
  "pricePaise": 78500000,
  "priceNegotiable": "SLIGHTLY",
  "description": "Single owner, serviced only at authorised service centre. New tyres fitted in January 2026. Insurance valid till March 2027. Available for inspection at our Katpadi Main Road yard.",
  "features": ["Android Auto","Reverse camera","Alloy wheels","Climate control"]
}
```
**Response `200`**
```json
{
  "id": "…", "status": "DRAFT", "displayStatus": "DRAFT",
  "title": "2022 Maruti Suzuki Baleno Zeta AT",
  "priceLabel": "₹7.85 Lakh",
  "photoCount": 4,
  "completeness": { "percent": 90, "missing": ["photos"],
                    "canSubmit": false,
                    "blockers": [{ "code": "TOO_FEW_PHOTOS", "message": "Add 2 more photos (6 required)." }] },
  "creditPreview": { "balance": 23, "cost": 1, "balanceAfterPublish": 22 }
}
```

`creditPreview` drives the wizard's step-4 summary line "Credits after publish · 22".

## C9. `GET /v1/dealer/vehicles/{id}` — the full editable record plus `media[]` and `completeness`.
## C10. `DELETE /v1/dealer/vehicles/{id}` → `204`. Soft delete. `409 CANNOT_DELETE_LIVE` if a listing is `APPROVED` — mark it sold or removed first.

---

## C11. `POST /v1/dealer/vehicles/{id}/submit`
**Screen:** Add vehicle step 4 `Submit for approval` → Submitted

No body. This is where a credit is held.

**Response `201`**
```json
{
  "listingId": "…",
  "status": "PENDING_REVIEW",
  "displayStatus": "PENDING",
  "statusLabel": "Pending approval",
  "submittedAt": "2026-08-16T09:32:11Z",
  "expectedReviewBy": "2026-08-17T09:32:11Z",
  "credit": {
    "held": 1,
    "balanceBefore": 23,
    "balanceAfter": 22,
    "transactionId": "…",
    "note": "One credit is held now and spent when the listing is approved. If we reject it, the credit returns to your balance."
  },
  "message": "Your listing is with our team. Most listings are reviewed within 24 hours."
}
```

**Guards, each with its own error code:**

| Code | HTTP | When |
|---|---|---|
| `DEALER_NOT_ACTIVE` | 403 | dealer status ≠ `ACTIVE` |
| `PROFILE_INCOMPLETE` | 422 | required dealer fields or documents missing |
| `VEHICLE_INCOMPLETE` | 422 | `errors[]` names each missing field |
| `TOO_FEW_PHOTOS` | 422 | fewer than **6** `READY` photos |
| `INSUFFICIENT_CREDITS` | 422 | `creditBalance < 1` |
| `ALREADY_SUBMITTED` | 409 | a live listing already exists for this vehicle |

**`422 INSUFFICIENT_CREDITS`**
```json
{
  "type": "https://dealers-drive.com/errors/insufficient-credits",
  "title": "Not enough listing credits",
  "status": 422, "code": "INSUFFICIENT_CREDITS",
  "detail": "Publishing this vehicle needs 1 credit. Your balance is 0.",
  "creditBalance": 0,
  "actionLabel": "Buy credits",
  "actionHref": "/dealer/billing"
}
```

## C12. `POST /v1/dealer/vehicles/{id}/mark-sold`
**Request** `{ "soldPricePaise": 780000000, "soldAt": "2026-08-16" }` *(both optional)*
**Response `200`** `{ "displayStatus": "SOLD", "statusLabel": "Sold", "removedFromCatalogueAt": "2026-08-16T09:40:00Z" }`
The credit is **not** refunded — the listing did its job.

## C13. `POST /v1/dealer/listings/{id}/renew`
**Screen:** Inventory, on an `EXPIRED` row

**Response `201`**
```json
{
  "listingId": "…", "status": "PENDING_REVIEW", "displayStatus": "PENDING",
  "renewedFromId": "…",
  "credit": { "held": 1, "balanceBefore": 22, "balanceAfter": 21 },
  "message": "Renewed listings are reviewed again before they go live."
}
```
**`422 INSUFFICIENT_CREDITS`** as in C11.

---

## C14. Media
**Screen:** Add vehicle step 3 · Vehicle images

### `POST /v1/dealer/media/presign`
**Request**
```json
{ "ownerType": "VEHICLE", "ownerId": "…", "fileName": "DSC_4417.jpg",
  "mimeType": "image/jpeg", "bytes": 612884, "width": 2400, "height": 1800 }
```
**Response `201`**
```json
{
  "mediaId": "…",
  "uploadUrl": "https://r2.dealers-drive.com/dealers/8d20…/VEHICLE/…/original.jpg?X-Amz-Signature=…",
  "method": "PUT",
  "headers": { "Content-Type": "image/jpeg", "Content-Length": "612884" },
  "expiresInSeconds": 300,
  "maxBytes": 10485760
}
```
Client-side pre-compression to a 2400px longest edge at q0.85 is expected before this call (§12.1).

### `POST /v1/dealer/media/{id}/commit`
**Request** `{ "position": 0 }`
**Response `202`**
```json
{ "mediaId": "…", "status": "PROCESSING", "position": 0,
  "poll": "/v1/dealer/media/…", "estimatedSeconds": 6 }
```

### `GET /v1/dealer/media/{id}`
```json
{
  "mediaId": "…", "status": "READY", "position": 0,
  "url": "https://img.dealers-drive.com/v/…/1024.webp",
  "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj",
  "width": 2400, "height": 1800,
  "warnings": [],
  "uploadedByAdmin": false
}
```
`status` `PROCESSING` `READY` `FAILED`. `warnings` may contain `TOO_SMALL` `TOO_DARK` `EXTREME_ASPECT` — advisory, shown in the UI, never blocking.

### `PUT /v1/dealer/vehicles/{id}/media/order`
**Request** — the **full** ordered array, always. Never a partial swap.
```json
{ "mediaIds": ["m-03","m-01","m-02","m-04","m-05","m-06"] }
```
**Response `200`** `{ "media": [ { "mediaId": "m-03", "position": 0, "isPrimary": true } ] }`
Position 0 becomes `Vehicle.primaryMediaId` and carries the `PRIMARY` plate in the wizard.

### `DELETE /v1/dealer/media/{id}` → `204`. `409 BELOW_MINIMUM_PHOTOS` if the vehicle has a live listing and deleting would drop it under 6.

---

## C15. `GET /v1/dealer/enquiries`
**Screen:** Enquiries

**Query:** `?status=NEW&cursor=&limit=20`

**Response `200`**
```json
{
  "data": [
    {
      "id": "…",
      "reference": "DD-EN-40912",
      "name": "Karthik Raja",
      "initials": "KR",
      "phone": "+919840722118",
      "phoneDisplay": "+91 98407 22118",
      "callHref": "tel:+919840722118",
      "emailHref": "mailto:karthik.raja@example.com",
      "email": "karthik.raja@example.com",
      "message": "Is the price negotiable? Can I see it on Saturday morning?",
      "vehicle": {
        "id": "…", "title": "2021 Maruti Suzuki Swift VXi",
        "href": "/car/2021-maruti-suzuki-swift-vxi-vellore-3b7d1f"
      },
      "source": "LISTING_PAGE",
      "sourceLabel": "Listing page",
      "status": "NEW",
      "createdAt": "2026-08-16T08:53:00Z",
      "timeAgoLabel": "18 min ago",
      "actions": ["CONTACT","EMAIL","MARK_CONTACTED","CLOSE","SPAM"]
    },
    {
      "id": "…",
      "reference": "DD-EN-40908",
      "name": "Arun Fernandes",
      "initials": "AF",
      "phoneDisplay": "+91 99401 55219",
      "message": "Interested if you can include a new set of tyres.",
      "vehicle": null,
      "source": "DEALER_PAGE",
      "sourceLabel": "Dealer page",
      "status": "NEW",
      "timeAgoLabel": "2 days ago"
    }
  ],
  "page": { "nextCursor": null, "hasMore": false }
}
```

`vehicle: null` renders the card without the "On <vehicle>" line — that is the portfolio enquiry.

## C16. `GET /v1/dealer/enquiries/counts`
**Screen:** Enquiries — the four segmented tabs

```json
{
  "tabs": [
    { "status": "NEW",       "label": "New",       "count": 12 },
    { "status": "CONTACTED", "label": "Contacted", "count": 34 },
    { "status": "CLOSED",    "label": "Closed",    "count": 81 },
    { "status": "SPAM",      "label": "Spam",      "count": 3 }
  ],
  "total": 130
}
```

## C17. `PATCH /v1/dealer/enquiries/{id}`
**Screen:** Enquiries — `Mark contacted` · `Close` · spam

**Request** `{ "status": "CONTACTED" }`
**Request** `{ "status": "CLOSED", "closeReason": "SOLD", "note": "Sold to this buyer." }`
**Request** `{ "status": "SPAM" }`

**Response `200`**
```json
{
  "id": "…", "status": "CONTACTED", "contactedAt": "2026-08-16T09:45:00Z",
  "counts": { "NEW": 11, "CONTACTED": 35, "CLOSED": 81, "SPAM": 3 }
}
```
Returning the fresh counts saves the client a second request to repaint the tabs.
**`409 INVALID_TRANSITION`** for `CLOSED → NEW`.
`closeReason` ∈ `SOLD` `NOT_INTERESTED` `UNREACHABLE` `OTHER`.

---

## C18. `GET /v1/dealer/dashboard`
**Screen:** Dealer dashboard — one round trip, everything

**Response `200`**
```json
{
  "greeting": "Good morning, Manikandan",
  "subline": "Here is what happened across your inventory in the last 7 days.",
  "stats": [
    { "key": "activeListings", "label": "Active listings",   "value": 4,
      "valueLabel": "4",     "delta": "+2 this week",       "deltaTone": "ok" },
    { "key": "credits",        "label": "Available credits", "value": 23,
      "valueLabel": "23",    "delta": "5 used this month",  "deltaTone": "neutral" },
    { "key": "newEnquiries",   "label": "New enquiries",     "value": 12,
      "valueLabel": "12",    "delta": "+4 vs last week",    "deltaTone": "ok" },
    { "key": "views",          "label": "Vehicle views",     "value": 2481,
      "valueLabel": "2,481", "delta": "−6% vs last week",   "deltaTone": "warn" }
  ],
  "viewsChart": {
    "title": "Views this week",
    "totalLabel": "2,481 total",
    "max": 612,
    "series": [
      { "day": "Mon", "date": "2026-08-10", "views": 282, "heightPct": 46 },
      { "day": "Tue", "date": "2026-08-11", "views": 379, "heightPct": 62 },
      { "day": "Wed", "date": "2026-08-12", "views": 355, "heightPct": 58 },
      { "day": "Thu", "date": "2026-08-13", "views": 496, "heightPct": 81 },
      { "day": "Fri", "date": "2026-08-14", "views": 612, "heightPct": 100 },
      { "day": "Sat", "date": "2026-08-15", "views": 563, "heightPct": 92 },
      { "day": "Sun", "date": "2026-08-16", "views": 330, "heightPct": 54 }
    ]
  },
  "recentEnquiries": [
    { "id": "…", "initials": "KR", "name": "Karthik Raja",
      "vehicleTitle": "2021 Maruti Suzuki Swift VXi",
      "phoneDisplay": "+91 98407 22118", "callHref": "tel:+919840722118",
      "timeAgoLabel": "18 min ago" }
  ],
  "creditBalance": 23,
  "creditsHeld": 1,
  "alerts": [
    { "type": "EXPIRING_SOON", "count": 2,
      "message": "2 listings expire in the next 7 days.", "href": "/dealer/inventory?status=ACTIVE" }
  ]
}
```

`heightPct` is server-computed against `max` so the chart cannot disagree with the numbers beside it.

---

## C19. Billing
**Screen:** Billing & credits · sidebar credit card · console top bar

### `GET /v1/dealer/billing/summary`
```json
{
  "creditBalance": 23,
  "creditsHeld": 1,
  "creditsAvailable": 22,
  "label": "Listing credits available",
  "note": "One credit publishes one vehicle for 90 days.",
  "listingDurationDays": 90,
  "usedThisMonth": 5
}
```

### `GET /v1/dealer/billing/packs`
```json
{
  "data": [
    { "id": "…", "slug": "pack-10",  "credits": 10,
      "pricePaise": 450000,  "priceLabel": "₹4,500",
      "perListingLabel": "₹450 per listing", "badge": null,  "highlighted": false },
    { "id": "…", "slug": "pack-25",  "credits": 25,
      "pricePaise": 1000000, "priceLabel": "₹10,000",
      "perListingLabel": "₹400 per listing", "badge": "Most popular", "highlighted": true },
    { "id": "…", "slug": "pack-50",  "credits": 50,
      "pricePaise": 1750000, "priceLabel": "₹17,500",
      "perListingLabel": "₹350 per listing", "badge": null,  "highlighted": false },
    { "id": "…", "slug": "pack-100", "credits": 100,
      "pricePaise": 3000000, "priceLabel": "₹30,000",
      "perListingLabel": "₹300 per listing", "badge": "Best value", "highlighted": false }
  ],
  "currency": "INR",
  "taxNote": "Prices exclude 18% GST."
}
```

### `POST /v1/dealer/billing/orders`
`Idempotency-Key` required.

**Request** — `packId` only. **The client never sends an amount.**
```json
{ "packId": "…" }
```
**Response `201`**
```json
{
  "orderId": "…",
  "gatewayOrderId": "order_PxK92mNq4Lp7Rd",
  "gateway": "razorpay",
  "razorpayKeyId": "rzp_live_ABC123",
  "credits": 25,
  "amountPaise": 1000000,
  "taxPaise": 180000,
  "totalPaise": 1180000,
  "totalLabel": "₹11,800",
  "currency": "INR",
  "prefill": { "name": "Sri Lakshmi Motors", "email": "owner@srilakshmimotors.in",
               "contact": "+919840012345" },
  "expiresAt": "2026-08-16T10:05:00Z"
}
```

### `POST /v1/dealer/billing/orders/{id}/verify`
The browser's Checkout success handler. **This endpoint never credits** — it verifies the signature and reports the current state. The webhook is the only writer.

**Request**
```json
{
  "razorpayPaymentId": "pay_PxK9AbCdEfGhIj",
  "razorpayOrderId": "order_PxK92mNq4Lp7Rd",
  "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```
**Response `200`**
```json
{
  "verified": true,
  "orderStatus": "PAID",
  "creditsAdded": 25,
  "creditBalance": 48,
  "invoice": { "id": "…", "number": "DD-INV-2026-0418" },
  "message": "25 credits added — payment captured via Razorpay."
}
```
**Response `202`** when the signature is valid but the webhook has not landed yet:
```json
{ "verified": true, "orderStatus": "PENDING", "creditsAdded": 0,
  "creditBalance": 23, "pollAfterSeconds": 2,
  "message": "Payment received. Your credits will appear in a few seconds." }
```
The client polls `GET /v1/dealer/billing/summary` for up to 20 s.
**`400 SIGNATURE_MISMATCH`** — logged as a security event.

### `GET /v1/dealer/billing/ledger`
**Screen:** Credit history panel

**Query:** `?cursor=&limit=20`
```json
{
  "data": [
    { "id": "…", "delta": -13, "deltaLabel": "−13", "tone": "err",
      "label": "Listings published — bulk import",
      "reason": "CONSUME_APPROVE",
      "createdAt": "2026-08-12T11:02:00Z", "dateLabel": "12 Aug 2026",
      "balanceAfter": 23, "balanceLabel": "bal 23", "listingId": null },
    { "id": "…", "delta": 10, "deltaLabel": "+10", "tone": "ok",
      "label": "Admin grant — onboarding bonus",
      "reason": "ADMIN_GRANT",
      "createdAt": "2026-08-09T06:30:00Z", "dateLabel": "09 Aug 2026",
      "balanceAfter": 36, "balanceLabel": "bal 36" },
    { "id": "…", "delta": -1, "deltaLabel": "−1", "tone": "err",
      "label": "Listing published — 2020 Honda City ZX CVT",
      "reason": "CONSUME_APPROVE",
      "createdAt": "2026-08-07T09:15:00Z", "dateLabel": "07 Aug 2026",
      "balanceAfter": 26, "balanceLabel": "bal 26",
      "listingId": "…" },
    { "id": "…", "delta": 25, "deltaLabel": "+25", "tone": "ok",
      "label": "Purchased — 25 credit pack",
      "reason": "PURCHASE",
      "createdAt": "2026-08-02T14:22:00Z", "dateLabel": "02 Aug 2026",
      "balanceAfter": 28, "balanceLabel": "bal 28",
      "orderId": "…", "invoiceNumber": "DD-INV-2026-0418" }
  ],
  "page": { "nextCursor": "eyJjIjoiMjAyNi0wOC0wMiJ9", "hasMore": true }
}
```
Newest first. `balanceAfter` is read, never summed.

### `GET /v1/dealer/billing/invoices`
**Screen:** Payment history table
```json
{
  "data": [
    { "id": "…", "number": "DD-INV-2026-0418", "issuedAt": "2026-08-02T14:22:00Z",
      "dateLabel": "02 Aug 2026", "totalPaise": 1000000, "amountLabel": "₹10,000",
      "status": "CAPTURED", "statusLabel": "Captured", "statusTone": "ok",
      "credits": 25, "pdfUrl": "/v1/dealer/billing/invoices/…/pdf", "pdfReady": true },
    { "id": "…", "number": "DD-INV-2026-0301", "dateLabel": "11 Jul 2026",
      "amountLabel": "₹4,500", "status": "CAPTURED", "statusLabel": "Captured",
      "statusTone": "ok", "credits": 10, "pdfReady": true,
      "pdfUrl": "/v1/dealer/billing/invoices/…/pdf" },
    { "id": "…", "number": "DD-INV-2026-0287", "dateLabel": "09 Jul 2026",
      "amountLabel": "₹4,500", "status": "FAILED", "statusLabel": "Failed",
      "statusTone": "err", "credits": 0, "pdfReady": false, "pdfUrl": null,
      "failureReason": "Payment declined by the issuing bank." }
  ],
  "page": { "nextCursor": null, "hasMore": false }
}
```

### `GET /v1/dealer/billing/invoices/{id}/pdf`
**Response `302`** → a 5-minute signed R2 URL, scoped to the caller's own dealer.
**`404 PDF_NOT_READY`** while the render job is still running.

---

## C20. Photo requests 🟡
**Screen:** none yet — see ARCHITECTURE §27 row 24. Gated behind `photoRequestsEnabled`.

### `POST /v1/dealer/photo-requests`
```json
{ "vehicleId": null, "vehicleCount": 4,
  "address": "14, Katpadi Main Road, Gandhi Nagar, Vellore 632006",
  "contactName": "R. Manikandan", "contactPhone": "9840012345",
  "preferredDate": "2026-08-22", "notes": "Yard is open from 10am." }
```
**Response `201`** `{ "id": "…", "status": "REQUESTED", "createdAt": "…", "message": "We'll call you within one working day to confirm a slot." }`
**`403 FEATURE_DISABLED`** when the config flag is off.

### `GET /v1/dealer/photo-requests` → `{ "data": [ { "id", "status", "statusLabel", "vehicleCount", "preferredDate", "scheduledFor", "completedAt" } ] }`

---

# PART D — ADMIN API

Session + TOTP. All writes audit-logged with the admin's identity.

---

## D1. `GET /v1/admin/metrics/overview`
**Screen:** Admin dashboard — the six stat boxes and the queue panel

```json
{
  "stats": [
    { "key": "totalDealers",       "label": "Total dealers",        "value": 86,     "valueLabel": "86" },
    { "key": "pendingVerification","label": "Pending verification", "value": 7,      "valueLabel": "7",
      "href": "/admin/dealers?status=PENDING_APPROVAL" },
    { "key": "activeListings",     "label": "Active listings",      "value": 1258,   "valueLabel": "1258" },
    { "key": "payments30d",        "label": "Payments (30d)",       "value": 42000000, "valueLabel": "₹4.2 L" },
    { "key": "revenue30d",         "label": "Revenue (30d)",        "value": 35593220, "valueLabel": "₹3.6 L" },
    { "key": "newEnquiries",       "label": "New enquiries",        "value": 312,    "valueLabel": "312" }
  ],
  "moderationQueue": {
    "pendingCount": 2,
    "oldestWaitingLabel": "4 hours",
    "message": "2 listings submitted by dealers are waiting for approval. Oldest has been waiting 4 hours.",
    "href": "/admin/listings"
  },
  "headerBadge": { "count": 2, "label": "2 awaiting review", "tone": "warn" }
}
```

`payments30d` is gross captured; `revenue30d` is net of 18% GST. They are different numbers on purpose.

---

## D2. `GET /v1/admin/dealers`
**Screen:** Admin → Dealers

**Query:** `?status=ACTIVE|PENDING_APPROVAL|SUSPENDED|REJECTED&city=&q=&cursor=&limit=20`

```json
{
  "data": [
    { "id": "…", "slug": "sri-lakshmi-motors", "brandName": "Sri Lakshmi Motors",
      "initials": "SL", "city": "Vellore",
      "status": "ACTIVE", "statusLabel": "Active", "statusTone": "ok",
      "vehicleCount": 18, "activeCount": 16,
      "joinedAt": "2025-03-14T00:00:00Z", "joinedLabel": "14 Mar 2025",
      "creditBalance": 23, "documentsVerified": true },
    { "id": "…", "brandName": "MRV Motors", "initials": "MM", "city": "Ranipet",
      "status": "PENDING_APPROVAL", "statusLabel": "Pending", "statusTone": "warn",
      "vehicleCount": 11, "activeCount": 0,
      "joinedLabel": "09 Aug 2026", "creditBalance": 0, "documentsVerified": false },
    { "id": "…", "brandName": "Gokul Cars", "initials": "GC", "city": "Arcot",
      "status": "SUSPENDED", "statusLabel": "Suspended", "statusTone": "err",
      "vehicleCount": 6, "activeCount": 0,
      "joinedLabel": "21 Jan 2026", "creditBalance": 4, "documentsVerified": true }
  ],
  "page": { "nextCursor": null, "hasMore": false },
  "counts": { "ACTIVE": 74, "PENDING_APPROVAL": 7, "SUSPENDED": 3, "REJECTED": 2 }
}
```

## D3. `GET /v1/admin/dealers/{id}` — the full C1 record plus documents, ledger summary, listing counts and recent audit entries.

## D4. Dealer moderation

| Route | Body | Effect |
|---|---|---|
| `POST /v1/admin/dealers/{id}/approve` | `{ "grantCredits": 10, "note": "Onboarding bonus" }` | `→ ACTIVE`. `grantCredits` optional — when present writes an `ADMIN_GRANT` ledger row labelled "Admin grant — onboarding bonus". Emails the dealer. |
| `POST /v1/admin/dealers/{id}/reject` | `{ "reason": "GST certificate does not match the legal name." }` | `→ REJECTED`. Reason ≥ 6 chars, shown verbatim. |
| `POST /v1/admin/dealers/{id}/suspend` | `{ "reason": "…" }` | `→ SUSPENDED`. **All their listings leave `listing_search` immediately.** Sessions revoked. |
| `POST /v1/admin/dealers/{id}/reinstate` | `{ "note": "…" }` | `→ ACTIVE`. Previously `APPROVED` listings return to the catalogue. |

**Response `200`** (all four)
```json
{ "id": "…", "status": "ACTIVE", "statusLabel": "Active",
  "creditsGranted": 10, "creditBalance": 10,
  "listingsAffected": 0, "notifiedAt": "2026-08-16T10:12:00Z" }
```

## D5. KYC review
### `GET /v1/admin/dealers/{id}/documents`
```json
{
  "data": [
    { "id": "…", "type": "GST_CERTIFICATE", "label": "GST certificate",
      "status": "UPLOADED", "fileName": "gst-cert.pdf", "bytes": 412004,
      "uploadedAt": "2026-08-16T09:14:00Z",
      "viewUrl": "https://r2.dealers-drive.com/kyc/…?X-Amz-Expires=300",
      "viewUrlExpiresAt": "2026-08-16T10:17:00Z" }
  ],
  "allVerified": false,
  "declared": { "gstin": "33AABCS1429P1ZK", "pan": "AABCS1429P",
                "legalName": "Sri Lakshmi Automobiles Pvt Ltd" }
}
```
Every `viewUrl` issued is audit-logged with the admin's identity.

### `POST /v1/admin/documents/{id}/verify` → `{ "status": "VERIFIED", "allVerified": true, "dealerCanBeApproved": true }`
### `POST /v1/admin/documents/{id}/reject`
**Request** `{ "reason": "The address on this bill does not match the registered address." }`
**Response `200`** `{ "status": "REJECTED", "dealerNotified": true }`

## D6. `POST /v1/admin/dealers/{id}/credits/grant`
`SUPER_ADMIN` only. `Idempotency-Key` required.
**Request** `{ "credits": 10, "label": "Admin grant — onboarding bonus", "reason": "Launch cohort incentive" }`
**Response `201`** `{ "transactionId": "…", "delta": 10, "balanceAfter": 33, "dealerNotified": true }`
Negative `credits` is a correction and requires a non-empty `reason`; the balance may not go below zero.

---

## D7. `GET /v1/admin/listings`
**Screen:** Moderation queue

**Query:** `?status=PENDING_REVIEW&dealer=&city=&cursor=&limit=20`

```json
{
  "data": [
    {
      "listingId": "…", "vehicleId": "…",
      "title": "2020 Mahindra XUV300 W8 (O)",
      "thumbnailUrl": "https://img.dealers-drive.com/v/…/320.webp",
      "dealer": { "slug": "sri-lakshmi-motors", "brandName": "Sri Lakshmi Motors",
                  "isVerified": true },
      "pricePaise": 87500000, "priceLabel": "₹8.75 Lakh",
      "city": "Vellore",
      "kmLabel": "52,300 km", "fuelLabel": "Diesel", "transmissionLabel": "Manual",
      "photoCount": 8,
      "submittedAt": "2026-08-16T05:32:00Z", "submittedLabel": "4 hours ago",
      "flags": [
        { "code": "PRICE_OUT_OF_BAND", "severity": "warn",
          "message": "18% above the median for this model and year." }
      ],
      "claimedBy": null, "claimExpiresAt": null
    }
  ],
  "page": { "nextCursor": null, "hasMore": false },
  "pendingCount": 2,
  "oldestWaitingLabel": "4 hours"
}
```

`flags` are advisory only and never auto-reject: `TOO_FEW_PHOTOS` `PRICE_OUT_OF_BAND` `CONTACT_IN_DESCRIPTION` `IMPLAUSIBLE_KM` `DUPLICATE_IMAGE_HASH`.

## D8. `GET /v1/admin/listings/{id}`
**Screen:** Review listing

```json
{
  "listingId": "…", "vehicleId": "…", "status": "PENDING_REVIEW",
  "title": "2021 Toyota Fortuner 2.8 4x2 AT",
  "priceLabel": "₹28.50 Lakh",
  "metaLabel": "₹28.50 Lakh · Vellore · Velavan Cars",
  "dealer": { "id": "…", "slug": "velavan-cars", "brandName": "Velavan Cars",
              "status": "ACTIVE", "isVerified": true, "creditBalance": 12,
              "href": "/admin/dealers/…" },
  "photos": [
    { "id": "…", "position": 0, "label": "Primary — front",
      "url": "https://img.dealers-drive.com/v/…/1600.webp" },
    { "id": "…", "position": 4, "label": "RC book",
      "url": "https://img.dealers-drive.com/v/…/1600.webp" }
  ],
  "photoCount": 8,
  "photoCountLabel": "8 submitted photos",
  "specs": [
    { "key": "km",            "label": "KM driven",        "value": "38,900 km" },
    { "key": "fuel",          "label": "Fuel",             "value": "Diesel" },
    { "key": "transmission",  "label": "Transmission",     "value": "Automatic" },
    { "key": "owners",        "label": "Ownership",        "value": "First owner" },
    { "key": "bodyType",      "label": "Body type",        "value": "SUV" },
    { "key": "photos",        "label": "Photos submitted", "value": "8" },
    { "key": "dealerStatus",  "label": "Dealer status",    "value": "Verified · GSTIN on file" }
  ],
  "description": "Well-maintained Fortuner serviced only at the authorised centre…",
  "flags": [],
  "credit": { "held": true, "transactionId": "…", "dealerBalance": 12 },
  "actions": {
    "canApprove": true, "canReject": true, "canRequestChanges": true,
    "consequenceNote": "Approving publishes this listing to the public catalogue for 90 days and spends one of the dealer's credits. This cannot be undone."
  },
  "rejectionReasonPresets": [
    "Photos are too few or too poor to represent the vehicle.",
    "Odometer photo does not match the declared KM reading.",
    "Price is implausible for this model, year and condition.",
    "Description contains a phone number or an external link.",
    "Registration details do not match the RC book."
  ]
}
```

## D9. `POST /v1/admin/listings/{id}/approve`
**Screen:** Approve dialog

**Request** `{}` *(or `{ "note": "…" }`)*
**Response `200`**
```json
{
  "listingId": "…", "status": "APPROVED", "displayStatus": "ACTIVE",
  "approvedAt": "2026-08-16T10:20:00Z",
  "expiresAt": "2026-11-14T10:20:00Z", "expiryLabel": "14 Nov 2026",
  "credit": { "consumed": 1, "transactionId": "…", "dealerBalanceAfter": 12 },
  "publicUrl": "https://dealers-drive.com/car/2021-toyota-fortuner-2-8-4x2-at-vellore-9f1c8e",
  "toast": "Listing approved — now live in the public catalogue."
}
```
Indexing, page revalidation and the dealer email are all asynchronous via the outbox and cannot roll back the approval.
**`409 INVALID_TRANSITION`** if it is not `PENDING_REVIEW` — two moderators opening the same card is expected, and the second one gets a clear error rather than a double approval.

## D10. `POST /v1/admin/listings/{id}/reject`
**Screen:** Reject dialog — confirm disabled until the reason is ≥ 6 characters

**Request** `{ "reason": "Odometer photo does not match the declared KM reading." }`
**Response `200`**
```json
{
  "listingId": "…", "status": "REJECTED", "displayStatus": "REJECTED",
  "reason": "Odometer photo does not match the declared KM reading.",
  "credit": { "released": 1, "transactionId": "…", "dealerBalanceAfter": 13 },
  "dealerNotifiedAt": "2026-08-16T10:21:00Z",
  "toast": "Listing rejected — the dealer has been notified with your reason."
}
```
**`422 REASON_TOO_SHORT`** below 6 characters — the server enforces what the dialog's disabled button implies.

## D11. `POST /v1/admin/listings/{id}/request-changes`
**Screen:** Review listing — `Request changes`

**Request** `{ "note": "Please reshoot the odometer with the ignition on so the reading is legible." }`
**Response `200`**
```json
{
  "listingId": "…", "status": "CHANGES_REQUESTED", "displayStatus": "CHANGES_REQUESTED",
  "note": "Please reshoot the odometer with the ignition on so the reading is legible.",
  "credit": { "stillHeld": 1, "dealerBalanceAfter": 12 },
  "dealerNotifiedAt": "2026-08-16T10:22:00Z",
  "toast": "Changes requested — the dealer can edit and resubmit."
}
```
The credit stays held. This is the difference from rejection.

## D12. `POST /v1/admin/listings/{id}/takedown`
**Request** `{ "reason": "Duplicate of listing DD-…", "refundCredit": false }`
**Response `200`** `{ "status": "REMOVED", "removedFromCatalogueAt": "…", "creditRefunded": false }`

---

## D13. Payments
**Screen:** Admin → Payments

### `GET /v1/admin/payments`
**Query:** `?status=CAPTURED&dealer=&from=2026-07-01&to=2026-08-16&cursor=&limit=20`
```json
{
  "data": [
    { "id": "…", "gatewayPaymentId": "pay_PxK9AbCdEfGhIj",
      "dealer": { "slug": "sri-lakshmi-motors", "brandName": "Sri Lakshmi Motors" },
      "invoiceNumber": "DD-INV-2026-0418",
      "credits": 25,
      "amountPaise": 1180000, "amountLabel": "₹11,800",
      "method": "upi",
      "status": "CAPTURED", "statusLabel": "Captured", "statusTone": "ok",
      "capturedAt": "2026-08-02T14:22:00Z", "dateLabel": "02 Aug 2026" }
  ],
  "page": { "nextCursor": null, "hasMore": false },
  "totals": {
    "grossPaise": 42000000, "grossLabel": "₹4.2 L",
    "netPaise": 35593220,   "netLabel": "₹3.6 L",
    "taxPaise": 6406780,    "taxLabel": "₹64,068",
    "count": 38, "periodLabel": "Last 30 days"
  }
}
```

### `GET /v1/admin/payments/{id}` — the payment plus its order, invoice, ledger row and the verified raw gateway payload.

### `POST /v1/admin/payments/{id}/refund`
`SUPER_ADMIN` only. `Idempotency-Key` required.
**Request** `{ "amountPaise": 1180000, "reason": "Duplicate charge", "revokeCredits": true }`
**Response `200`**
```json
{ "refundId": "rfnd_…", "status": "REFUNDED", "amountLabel": "₹11,800",
  "creditsRevoked": 25, "ledgerTransactionId": "…", "dealerBalanceAfter": 23 }
```
**`422 INSUFFICIENT_CREDITS_TO_REVOKE`** if the dealer has already spent them — the refund is then a business decision, not an API one, and the response says so.

---

## D14. `GET /v1/admin/config` · `PUT /v1/admin/config/{key}`
**Screen:** Admin → Configuration. `SUPER_ADMIN` only, every write audit-logged.

```json
{
  "data": [
    { "key": "listing.durationDays",      "value": 90,    "type": "number",
      "label": "Listing duration (days)", "updatedAt": "2026-07-01T00:00:00Z" },
    { "key": "listing.minPhotos",         "value": 6,     "type": "number",
      "label": "Minimum photos per listing" },
    { "key": "listing.reviewSlaHours",    "value": 24,    "type": "number" },
    { "key": "photoRequests.enabled",     "value": false, "type": "boolean" },
    { "key": "photoRequests.weeklyCapPerDealer", "value": 2, "type": "number" },
    { "key": "otp.maxAttempts",           "value": 3,     "type": "number" },
    { "key": "otp.resendCooldownSeconds", "value": 60,    "type": "number" },
    { "key": "enquiry.rateLimitPerHour",  "value": 5,     "type": "number" },
    { "key": "reveal.dailyCapPerIp",      "value": 20,    "type": "number" },
    { "key": "billing.gstPercent",        "value": 18,    "type": "number" }
  ]
}
```
**`PUT`** `{ "value": 120 }` → `200 { "key": "listing.durationDays", "value": 120, "previousValue": 90, "updatedBy": "…", "updatedAt": "…" }`
Changing `listing.durationDays` affects **new** approvals only; live `expiresAt` values are never rewritten.

## D15. `GET /v1/admin/audit-logs`
**Query:** `?entityType=Listing&entityId=&dealerId=&actorId=&action=&from=&to=&cursor=`
```json
{
  "data": [
    { "id": "…", "actorType": "ADMIN", "actor": { "id": "…", "email": "ops@dealers-drive.in" },
      "action": "listing.approved", "entityType": "Listing", "entityId": "…",
      "dealerId": "…",
      "before": { "status": "PENDING_REVIEW" },
      "after":  { "status": "APPROVED", "expiresAt": "2026-11-14T10:20:00Z" },
      "ip": "103.21.244.0", "traceId": "01J9F2…",
      "createdAt": "2026-08-16T10:20:00Z" }
  ],
  "page": { "nextCursor": "…", "hasMore": true }
}
```

## D16. `POST /v1/admin/vehicles/{id}/media`
Admin uploads on a dealer's behalf after a photo shoot. Same presign/commit pair as C14, but writes `Media.uploadedByAdmin = true`, audit-logs the admin identity, and surfaces in the dealer UI as "added by Dealers-Drive".

## D17. `GET /v1/admin/photo-requests` · `PATCH /v1/admin/photo-requests/{id}` 🟡
**PATCH request** `{ "status": "SCHEDULED", "scheduledFor": "2026-08-22T10:00:00Z", "adminNote": "Would have charged ₹2,000." }`
**Response `200`** `{ "id": "…", "status": "SCHEDULED", "dealerNotifiedAt": "…" }`

---

# PART E — WEBHOOKS & SYSTEM

## E1. `POST /v1/webhooks/razorpay`

**Headers:** `X-Razorpay-Signature` (HMAC-SHA256 over the raw body with the webhook secret) · `X-Razorpay-Event-Id`.

Verify the signature against the **raw** body before parsing. Insert a `WebhookEvent` keyed on the event id **before** any side effect; a unique-violation means a duplicate delivery and the handler returns `200` immediately without re-running anything.

**Handled events:** `payment.captured` · `payment.failed` · `order.paid` · `refund.processed`

**Body (abridged)**
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": { "entity": {
      "id": "pay_PxK9AbCdEfGhIj",
      "order_id": "order_PxK92mNq4Lp7Rd",
      "amount": 1180000, "currency": "INR",
      "status": "captured", "method": "upi",
      "email": "owner@srilakshmimotors.in", "contact": "+919840012345",
      "created_at": 1786955320
    } }
  },
  "created_at": 1786955321
}
```

**Response `200`** `{ "received": true, "eventId": "evt_…", "duplicate": false }`
Always `200` on a successfully *recorded* event, even if downstream processing is queued — Razorpay retries anything else for 24 hours, and a retry storm caused by a slow email job is a self-inflicted outage.
**`401 SIGNATURE_MISMATCH`** — logged as a security event, alerted on if it repeats.

## E2. `GET /health/live` → `200 { "status": "ok" }` — process is up. No dependency checks.
## E3. `GET /health/ready`
```json
{
  "status": "ok",
  "sha": "a3f91c2",
  "checks": { "database": "ok", "queue": "ok", "storage": "ok", "gateway": "ok" },
  "uptimeSeconds": 84213
}
```
`503` with the failing check named when any dependency is down.

---

# Appendix 1 — Endpoint index

| # | Method | Path | Screen(s) | Auth |
|---|---|---|---|---|
| A1 | GET | `/v1/home` | Homepage | — |
| A2 | GET | `/v1/vehicles` | Search results | — |
| A3 | GET | `/v1/vehicles/facets` | Search filters | — |
| A4 | POST | `/v1/vehicles/batch` | Saved cars | — |
| A5 | GET | `/v1/vehicles/{idOrSlug}` | VDP | — |
| A6 | GET | `/v1/vehicles/{id}/similar` | VDP | — |
| A7 | POST | `/v1/vehicles/{id}/reveal-contact` | VDP, Portfolio | — |
| A8 | GET | `/v1/dealers` | Dealer directory | — |
| A9 | GET | `/v1/dealers/{slug}` | Dealer portfolio | — |
| A10 | GET | `/v1/dealers/{slug}/vehicles` | Dealer portfolio | — |
| A11 | GET | `/v1/dealers/{slug}/facets` | Dealer portfolio | — |
| A12 | GET | `/v1/cities` | Header city selector | — |
| A13 | GET | `/v1/catalog/bundle` | Add vehicle, filters | — |
| A14 | GET | `/v1/config/public` | All | — |
| A15 | POST | `/v1/enquiries` | VDP, Portfolio → Enquiry sent | — |
| B1 | POST | `/v1/auth/otp/start` | Sign in, Sign up | — |
| B2 | POST | `/v1/auth/otp/verify` | OTP | — |
| B3 | POST | `/v1/auth/otp/resend` | OTP | — |
| B4 | GET | `/v1/auth/me` | All authed shells | session |
| B5 | POST | `/v1/auth/logout` | — | session |
| B6 | POST | `/v1/auth/admin/login` | Admin | — |
| B7 | POST | `/v1/auth/admin/2fa/verify` | Admin | challenge |
| C1 | GET | `/v1/dealer` | Onboarding, Profile | dealer |
| C2 | PATCH | `/v1/dealer` | Onboarding 1–3 | dealer |
| C3 | GET | `/v1/dealer/completeness` | Onboarding stepper | dealer |
| C4 | POST | `/v1/dealer/submit` | Onboarding 4 | dealer |
| C5 | GET/POST/DELETE | `/v1/dealer/documents…` | Onboarding 3 | dealer |
| C6 | GET | `/v1/dealer/vehicles` | Inventory | dealer |
| C7 | POST | `/v1/dealer/vehicles` | Add vehicle 1 | dealer |
| C8 | PATCH | `/v1/dealer/vehicles/{id}` | Add vehicle 2, 4 | dealer |
| C9 | GET | `/v1/dealer/vehicles/{id}` | Edit | dealer |
| C10 | DELETE | `/v1/dealer/vehicles/{id}` | Inventory | dealer |
| C11 | POST | `/v1/dealer/vehicles/{id}/submit` | Add vehicle 4 → Submitted | dealer |
| C12 | POST | `/v1/dealer/vehicles/{id}/mark-sold` | Inventory | dealer |
| C13 | POST | `/v1/dealer/listings/{id}/renew` | Inventory | dealer |
| C14 | POST/PUT/DELETE | `/v1/dealer/media…` | Add vehicle 3 | dealer |
| C15 | GET | `/v1/dealer/enquiries` | Enquiries | dealer |
| C16 | GET | `/v1/dealer/enquiries/counts` | Enquiries tabs | dealer |
| C17 | PATCH | `/v1/dealer/enquiries/{id}` | Enquiries | dealer |
| C18 | GET | `/v1/dealer/dashboard` | Dashboard | dealer |
| C19 | GET/POST | `/v1/dealer/billing…` | Billing & credits | dealer |
| C20 | GET/POST | `/v1/dealer/photo-requests` | 🟡 none | dealer |
| D1 | GET | `/v1/admin/metrics/overview` | Admin dashboard | admin |
| D2 | GET | `/v1/admin/dealers` | Admin dealers | admin |
| D3 | GET | `/v1/admin/dealers/{id}` | Admin dealers | admin |
| D4 | POST | `/v1/admin/dealers/{id}/{action}` | Admin dealers | admin |
| D5 | GET/POST | `/v1/admin/…/documents` | Admin dealers | admin |
| D6 | POST | `/v1/admin/dealers/{id}/credits/grant` | Admin dealers | super |
| D7 | GET | `/v1/admin/listings` | Moderation queue | admin |
| D8 | GET | `/v1/admin/listings/{id}` | Review listing | admin |
| D9 | POST | `/v1/admin/listings/{id}/approve` | Approve dialog | admin |
| D10 | POST | `/v1/admin/listings/{id}/reject` | Reject dialog | admin |
| D11 | POST | `/v1/admin/listings/{id}/request-changes` | Review listing | admin |
| D12 | POST | `/v1/admin/listings/{id}/takedown` | Moderation | admin |
| D13 | GET/POST | `/v1/admin/payments…` | Admin payments | admin |
| D14 | GET/PUT | `/v1/admin/config…` | Admin configuration | super |
| D15 | GET | `/v1/admin/audit-logs` | Admin | admin |
| D16 | POST | `/v1/admin/vehicles/{id}/media` | Photo shoots | admin |
| D17 | GET/PATCH | `/v1/admin/photo-requests…` | 🟡 | admin |
| E1 | POST | `/v1/webhooks/razorpay` | — | HMAC |
| E2 | GET | `/health/live` | — | — |
| E3 | GET | `/health/ready` | — | — |

**68 routes across 20 screens.**

---

# Appendix 2 — Screen → endpoint coverage

| Screen | Endpoints |
|---|---|
| Homepage | A1, A12, A14 |
| Search results | A2, A3, A12, A13 |
| Vehicle detail | A5, A6, A7, A15 |
| Vehicle images (lightbox) | A5 (`photos[]`) |
| Dealer directory | A8, A12 |
| Dealer portfolio | A9, A10, A11, A7, A15 |
| Saved cars | A4 |
| Enquiry sent | A15 (response) |
| Sign in | B1, B2, B3 |
| Sign up & OTP | B1, B2, B3 |
| Onboarding | C1, C2, C3, C4, C5, A13 |
| Dealer dashboard | C18, B4 |
| Inventory | C6, C10, C12, C13 |
| Add vehicle | C7, C8, C9, C11, C14, A13 |
| Enquiries | C15, C16, C17 |
| Billing & credits | C19, E1 |
| Admin dashboard | D1 |
| Moderation queue | D7, D9 |
| Review listing | D8, D9, D10, D11 |
| Admin dealers | D2, D3, D4, D5, D6 |
| *(Admin payments)* | D13 |
| *(Admin configuration)* | D14 |

Every one of the 20 designed screens is served. Two admin nav items — Payments and Configuration — have endpoints but no design; they need screens before launch.
