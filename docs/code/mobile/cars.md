# Native car discovery and detail

F102 reuses existing public /v1/vehicles, /v1/locations, /v1/search/vehicles, /v1/vehicles/:slug and /similar APIs. No BFF, backend, visibility, schema response or inventory database is duplicated. Search helpers and titleWithoutYear are moved unchanged into platform-neutral contracts and re-exported under existing web names; the original behavior tests also run in contracts. Public transport sends no credential/cookie.

## Search and filters

Explore is the single car-discovery destination; /cars app links redirect there with validated known query parameters. Search/district/filter/sort state stays in the mounted tab when a detail screen is pushed. Existing CSV, inclusive paise ranges, dependent model behavior and pagination reset rules are preserved. Native typeahead is debounced 350ms, scoped by district/town/dealer and accepts only the echoed current search. Explicit submit applies free text. Stale requests are cancelled/ignored by query keys and signals.

Inventory uses a virtualized FlatList, stable slug keys, six-item render batches, bounded windows and existing offset pages. Next-page requests use cancelRefetch=false to avoid duplicate/cancel/restart loops. Available counts come from response.available, not page.total or rendered length: Reserved cards remain visible but are unclickable; sold/withdrawn detail is 404. Skeletons match card proportions. Empty, failed, refresh and next-page states remain explicit.

Filters use a native modal with draft/apply/cancel behavior and debounced authoritative facet/count preview. District changes clear town/dealer/page only; all-district selection preserves other filters. Unticking a brand removes orphaned models. All web groups are represented: location/town/dealer, brand/model, price/year/kilometers, fuel/transmission/body/color/owners and sort. Large groups initially show six rows plus selected extras. District search limits rendered matches while retaining search access. Whole-rupee custom prices are converted using BigInt into integer paise; strict shared range validation refuses inversions/overflow before applying. The backend remains authoritative for filter validation and counts.

## Detail and images

Reference: post-PR #311 mobile car-detail source/capture, with gallery before year/title/summary, price panel, specs, description, dealership/trust and similar inventory. Preserve the actual /car/:slug route. Back returns to the incoming car/dealer/search context rather than discarding its filters/scroll. Navigation uses navigate for existing destinations to avoid repeated same-car stacking. Sharing uses the canonical public website URL and contains no session credential.

API card images already use the 640px derivative and details 1024px. Expo Image uses memory/disk cache and recycling keys; no full original is fetched. The gallery clamps primary index and swipes inline and full-screen (F113 replaced the next/previous buttons; see [galleries](gallery-dealer.md)), budgets one initial/two batch/three-window photos and handles failed/missing images. Dark viewer uses the approved white DD symbol and a light status bar. These source adaptations require installed-device back/gesture/inset/rotation/quality validation; no performance or real-device claim is made.

Removed/invalid details show unavailable even when old data was cached, and matching pending protected context is cleared. Related inventory loads independently and may fail without blanking the main detail. Dealer navigation is completed in F103. Saved controls/effects and enquiry/consent submission arrive in F104/F105; this milestone does not simulate those mutations or expose dealer phone numbers.
