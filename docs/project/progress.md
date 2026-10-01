# Reconstruction progress

The single place a feature's reconstruction status is recorded. **Nothing else
in the repository tracks progress** — not `CLAUDE.md`, not `CONTEXT.md`, not
`README.md`. One line, one file, so 97 branches do not fight over the same
paragraph in three documents.

**A feature PR ticks its own line and nothing else here.** A conflict on this
file is one line and resolves in seconds; a conflict on a prose paragraph does
not.

Legend — `[ ]` not started · `[~]` PR open · `[x]` merged to `main` · `[⏸]` deferred by a
revision · `[⛔]` withdrawn

> Note the `Status: implemented` field on every entry in `feature-map.md` means
> _"exists in the baseline"_, which is true of all 97. It is not a
> reconstruction status. This file is.

## Tier 1 — Platform foundations

- [x] F001 — Contracts package foundation · [#1](https://github.com/shashikiran6sk/DealersDrive/pull/1)
- [x] F002 — API server bootstrap & mount table
- [x] F003 — Error taxonomy & validation middleware · ⚠️ lands after F004
- [x] F004 — Request context, logging & lifecycle · ⚠️ lands before F003
- [x] F005 — Database connection & migration harness
- [x] F006 — Health & readiness probes · cache probe restored at F028
- [x] F007 — Design tokens & base stylesheet
- [x] F008 — Web app shell & core libs
- [x] F009 — UI primitives: action & identity
- [x] F010 — UI primitives: status & feedback
- [x] F011 — UI primitives: structure
- [x] F012 — UI primitives: states
- [x] F013 — Form primitives

## Tier 2 — Identity & the first dealer-facing surface

- [x] F014 — User & session data model
- [x] F015 — Session service & cookies
- [x] F016 — Auth guards & authorization model
- [x] F017 — Auth shell UI
- [x] F018 — Dealer sign-in with Google OAuth ⭐
- [x] F019 — Admin sign-in
- [x] F020 — Sign-out & session revocation

## Tier 3 — CI/CD

- [x] F021 — Docker images
- [x] F022 — CI pipeline
- [x] F023 — Security scanning & dependency automation
- [x] F024 — Release & image promotion
- [x] F025 — Deployment infrastructure

## Tier 4 — Platform services

- [⛔] F026 — City & location reference data · **withdrawn by D6** — the `cities` table, the `locations` module and `GET /v1/cities` are removed; a dealership's city is text it types
- [x] F027 — Rate limiting · ⚠️ pulled forward, ahead of Tier 2
- [x] F028 — Caching layer · ⚠️ pulled forward, ahead of Tier 2
- [x] F029 — Platform config & feature flags
- [x] F030 — Audit log · ⚠️ pulled forward, ahead of Tier 2
- [x] F031 — Events, outbox & background jobs · ⚠️ pulled forward, ahead of Tier 2

## Tier 5 — Storage & media

- [x] F032 — Storage port & adapters · ⚠️ pulled forward, ahead of Tier 2
- [x] F033 — Presigned upload & commit · [#50](https://github.com/shashikiran6sk/DealersDrive/pull/50)
- [x] F098 — API reference — OpenAPI & Swagger UI · ⚠️ added by D5, pulled out of F096 · [#52](https://github.com/shashikiran6sk/DealersDrive/pull/52)

> F034 and F035 moved to Tier 9 (decision D4) — they serve vehicle galleries,
> and nothing in Tier 6 or 7 depends on them.

## Tier 6 — Dealer onboarding

- [x] F036 — Dealer entity & tenant isolation · ⚠️ pulled forward, ahead of Tier 2
- [x] F037 — Onboarding shell & step routing · [#53](https://github.com/shashikiran6sk/DealersDrive/pull/53)
- [x] F038 — Onboarding — account step · [#54](https://github.com/shashikiran6sk/DealersDrive/pull/54)
- [x] F039 — Onboarding — business details step · [#55](https://github.com/shashikiran6sk/DealersDrive/pull/55)
- [x] F040 — Dealer document model & types · [#56](https://github.com/shashikiran6sk/DealersDrive/pull/56)
- [x] F041 — Onboarding — document upload step · [#57](https://github.com/shashikiran6sk/DealersDrive/pull/57)
- [x] F042 — Onboarding — review & submit step · [#59](https://github.com/shashikiran6sk/DealersDrive/pull/59)
- [x] F043 — Onboarding completeness tracking · [#58](https://github.com/shashikiran6sk/DealersDrive/pull/58)
- [x] F044 — Admin document verification · [#61](https://github.com/shashikiran6sk/DealersDrive/pull/61) + the console's verify/reject controls
- [x] F045 — Dealer approval, rejection & suspension · [#62](https://github.com/shashikiran6sk/DealersDrive/pull/62) + the console's approve/reinstate controls

## Tier 7 — Consoles

- [x] F046 — Dealer profile management · [#68](https://github.com/shashikiran6sk/DealersDrive/pull/68)
- [x] F047 — Dealer console shell & navigation · pulled forward as R31 · [#104](https://github.com/shashikiran6sk/DealersDrive/pull/104)
- [x] F048 — Dealer dashboard · also lands `/admin` and makes `AdminNav` honest · [#134](https://github.com/shashikiran6sk/DealersDrive/pull/134) · listing counts wait on F064
- [x] F049 — Admin console shell & navigation · ⚠️ pulled forward, ahead of Tier 7 — F044 depends on it · [#60](https://github.com/shashikiran6sk/DealersDrive/pull/60)

## Tier 8 — Billing & credits

> Deferred behind the marketplace core by **R47**. The listing lifecycle lands
> without a ledger; the credit movements attach to its transitions later.

- [ ] F050 — Credit ledger & balance
- [ ] F051 — Credit packs & purchase orders
- [ ] F052 — Payment verification
- [ ] F053 — Invoices & PDF delivery
- [ ] F054 — Admin credit grants & payments view

## Tier 9 — Vehicle intake

- [⏸] F034 — Image derivative pipeline · ⚠️ moved from Tier 5, D4 · **deferred by R45** — StudioCar produces the finished image
- [x] F035 — Media ordering & primary photo · ⚠️ moved from Tier 5, D4 · **reinterpreted by R45** — admin-only upload, removal, ordering and primary on the review screen
- [x] F055 — Vehicle data model · manual entry, no image columns (R45/R46)
- [x] F056 — Plate input & normalisation · state, BH and legacy series; one registration per dealership
- [⏸] F057 — RC lookup port, mock adapter & caching · **deferred by R46**
- [⏸] F058 — Attestr RC adapter · **deferred by R46**
- [⏸] F059 — RC lookup UI & registration step · **deferred by R46**
- [x] F060 — Vehicle basics — RC-prefilled or manual ⚠️ · **manual only, R46** · suggest-existing make/model
- [x] F061 — Vehicle details · manual, no vehicle location (the dealership's is used)
- [⛔] F062 — Vehicle photo upload UI · **withdrawn by R45** — dealers never upload listing photos
- [x] F063 — Vehicle wizard shell & step routing · **no Photos step, R45** · API [#148](https://github.com/shashikiran6sk/DealersDrive/pull/148) + wizard; submit lands with F065

## Tier 10 — Listing lifecycle

- [x] F064 — Listing model & state machine · **states revised, R47** · one `transition()`, race-safe, audited
- [x] F065 — Listing submission & resubmission · **no credit hold, R47** · plate claimed across dealerships on submit
- [x] F066 — Dealer inventory list · status tabs with counts, plate/make/model search; the dashboard counts the same listings
- [~] F067 — Mark sold, remove & renew · as revised by **R69**/**R70** — reserve, reactivate, mark sold, withdraw, relist landed; renew waits on listing expiry, which waits on billing (F050–F054)
- [⏸] F068 — Vehicle history report · **deferred by R46**

## Tier 11 — Moderation

- [x] F069 — Moderation queue · **revised by R45** · oldest first, no one-click approve; the operations overview counts it
- [x] F070 — Listing review & decisions · **revised by R45** — review screen, checklist, photography status, images, request changes, reject and guarded approval
- [ ] F071 — Listing takedown
- [x] F072 — Admin platform config editor · ⚠️ pulled forward, ahead of Tier 11 — the settings screen the console's nav already links at · [#128](https://github.com/shashikiran6sk/DealersDrive/pull/128)

## Tier 12 — Public marketplace

- [x] F073 — Public shell — header & footer · [#69](https://github.com/shashikiran6sk/DealersDrive/pull/69)
- [ ] F074 — City selector
- [x] F075 — Vehicle card · grid variant, no save or sold state yet (R45, F087 deferred) · with `GET /v1/vehicles`
- [x] F076 — Search API & facets ⚠️ · one route answers page, total and facets; the portfolio's goes through the same `search()` · [#168](https://github.com/shashikiran6sk/DealersDrive/pull/168)
- [x] F077 — Search results page · district, filters, chips, search, sort and paging, all in the URL
- [x] F078 — Filter panel · twelve URL-driven groups with counted facets, the chip row, and a dimming results region; desktop rail (the sheet is F079) · [#171](https://github.com/shashikiran6sk/DealersDrive/pull/171)
- [x] F079 — Mobile filter sheet · the same panel in `Dialog variant="sheet"`, an applied-count badge, and a live Show N cars · [#173](https://github.com/shashikiran6sk/DealersDrive/pull/173)
- [x] F080 — Search toolbar & sort · debounced search (replace while typing, push on Enter) and the five sorts · [#172](https://github.com/shashikiran6sk/DealersDrive/pull/172)
- [x] F081 — Homepage & hero search · as revised by **R72** — hero search into `/cars`, four discovery rows
- [x] F082 — Vehicle detail page · `/car/[slug]`, ACTIVE only, 404 otherwise; no enquiry, report or save (deferred)
- [x] F083 — Vehicle gallery & lightbox · **R48, R49** — the §2.9 strip under a blueprint main image, and the §2.10 lightbox with its numbered rail, on the `Dialog` primitive
- [x] F084 — Similar vehicles · as revised by **R73** — by slug, available cars only, the grid card
- [~] F085 — Dealer directory
- [x] F086 — Dealer portfolio · header, info row, the live inventory (R48), and its filter rail, sheet and sort through the same search as `/cars` · [#174](https://github.com/shashikiran6sk/DealersDrive/pull/174)
- [x] F087 — Saved cars · as revised by **R74**/**R75** — server-backed, per customer, not `localStorage`

## Tier 13 — Enquiries

- [ ] F088 — Enquiry model & submission API
- [ ] F089 — Public enquiry form
- [ ] F090 — Contact reveal
- [ ] F091 — Dealer enquiry inbox
- [ ] F092 — SMS notifications

## Tier 14 — Surface polish

- [ ] F093 — Error boundaries & error pages
- [ ] F094 — Loading & not-found states
- [~] F095 — SEO & metadata · production SEO for the public marketplace — one origin, per-page metadata and Open Graph, faceted-URL policy, `Car`/`Offer`/`AutoDealer`/`BreadcrumbList`/`Organization`/`WebSite` JSON-LD, `GET /v1/sitemap` + `sitemap.xml`, `robots.txt`, favicon set; see `docs/seo.md`
- [ ] F096 — Postman collection · ⚠️ reduced by D5; OpenAPI moved to F098
- [ ] F097 — Seed data & developer bootstrap

---

## Revisions — product changes after the reconstruction

Not slices of the baseline: changes to the product itself, asked for after the
reconstruction started. Numbered `R` so a reviewer can tell them from a feature
at a glance, and written up in `feature-map.md` under **REVISIONS**.

- [~] R1 — Duplicate phone returns the wizard to step 1 · revises F038/F039 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R2 — District on the business step · revises F039/F043/F045 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R3 — Admin dealer filters: city, district, state · revises F045 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R4 — Admin sign-in is Google + an allow-list (**D8**) · revises F019 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R5 — `deploy-dev` paused until Vercel and AWS exist · revises F024 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R6 — The yard on a map: `mapsUrl` for the portfolio's directions link · revises F039/F043, consumed by F086 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R7 — The contact number is editable again · revises F038/F046 · [#65](https://github.com/shashikiran6sk/DealersDrive/pull/65)
- [~] R8 — One folder per dealership, named after the dealership · revises F038/F040/F041/F047 · [#75](https://github.com/shashikiran6sk/DealersDrive/pull/75)
- [~] R9 — The yard photograph reaches the public pages · revises F033/F085/F086 · [#76](https://github.com/shashikiran6sk/DealersDrive/pull/76)
- [~] R10 — The yard on a map, not only in a link · revises F038/F041/F086 · [#77](https://github.com/shashikiran6sk/DealersDrive/pull/77)
- [~] R11 — Districts in the header, and city chips that multi-select · revises F085 · [#78](https://github.com/shashikiran6sk/DealersDrive/pull/78)
- [~] R12 — A write clears the public page it changed · revises F041/F046/F049/F085/F086 · [#79](https://github.com/shashikiran6sk/DealersDrive/pull/79)
- [ ] R13 — Whatever the share panel gives, and the yard at the foot of the header · revises F038/F046/F086
- [ ] R14 — A map of the dealership, not a dot on a map · revises F038/F046/F086
- [ ] R15 — One card of details, and a yard photograph that lines up · revises F086
- [ ] R16 — The registered name, and a phone row nothing could reveal · revises F085/F086
- [ ] R17 — A directory card that keeps its height · revises F085
- [ ] R18 — Services are a set, not a list · revises F046/F085/F086
- [ ] R19 — The district menu, as the baseline drew it, and reachable by keyboard · revises R11/F073
- [ ] R20 — A Maps link that names the place · revises F046/R14
- [ ] R21 — The directory card is one fixed size · revises R17
- [~] R22 — States group the districts, in a dialog · revises R11/R19/F085
- [ ] R23 — Select a district, rather than being told you have every one · revises R11/R22/F085
- [~] R24 — The logo tile stays at the top when the name wraps · revises F085/R21 · [#97](https://github.com/shashikiran6sk/DealersDrive/pull/97)
- [~] R25 — The tagline is the portfolio's prose, and About is not · revises F085/F086/R15 · [#98](https://github.com/shashikiran6sk/DealersDrive/pull/98)
- [~] R26 — Onboarding asks for a line and a service list, not an essay · revises F037/F046/R25 · [#99](https://github.com/shashikiran6sk/DealersDrive/pull/99)
- [~] R27 — A dealer edits three things about themselves · revises F041/F046/R2/R6/R7
- [~] R28 — The directory card, as the UI reference draws it · revises F085/R21/R24 · [#101](https://github.com/shashikiran6sk/DealersDrive/pull/101)
- [~] R29 — The card is one click target, and the first chip takes the accent · revises R28 · [#102](https://github.com/shashikiran6sk/DealersDrive/pull/102)
- [~] R30 — A refused service list answers in the dealer's own words · revises R26 · [#103](https://github.com/shashikiran6sk/DealersDrive/pull/103)
- [~] R31 — The dealer console gets its shell, early · lands F047 · [#104](https://github.com/shashikiran6sk/DealersDrive/pull/104)
- [~] R32 — The review screen judges the tagline and the services, not About · revises F045/R25/R26 · [#105](https://github.com/shashikiran6sk/DealersDrive/pull/105)
- [~] R33 — The paragraph is dropped, column and all · revises R25/R26/R32 · ⚠️ deletes data · [#106](https://github.com/shashikiran6sk/DealersDrive/pull/106)
- [~] R34 — A dealer's public words are proposed, not published · revises F041/F046/R26/R27/R32 · [#107](https://github.com/shashikiran6sk/DealersDrive/pull/107)
- [~] R35 — One door for a dealership, not two · revises F073 · [#109](https://github.com/shashikiran6sk/DealersDrive/pull/109)
- [~] R36 — The contact's job title is not a field · revises F038/F041/F046 · ⚠️ deletes data · [#110](https://github.com/shashikiran6sk/DealersDrive/pull/110)
- [~] R37 — Services are added one at a time, and shown as chips · revises F037/F046/R18/R26 · [#111](https://github.com/shashikiran6sk/DealersDrive/pull/111)
- [~] R38 — PAN is unique across the platform, as GSTIN already was · revises F038/F041/F045/F046 · [#112](https://github.com/shashikiran6sk/DealersDrive/pull/112)
- [~] R39 — The mobile number is proved, not typed · revises F014/F018/F037/F038/F046/R27/R34 · MSG91 OTP widget, no new package
- [ ] R40 — Emails are queued, and a separate process sends them · revises F031/F038/F045/R34 · ⚠️ new table
- [~] R41 — A dealership suspension closes a seat, not an account · revises F014/F016/F019/F045 · ⚠️ new table
- [~] R42 — An admin can grant admin access, by email · revises F019/F072 · lands with F072
- [ ] R43 — The directory search recommends, and the old input is gone · revises F085 · lands the typeahead F077 reuses
- [x] R44 — A footer worth having, and the social links live in configuration · revises F073 · adds six `social.*` config keys · [#133](https://github.com/shashikiran6sk/DealersDrive/pull/133)
- [x] R45 — Dealers-Drive photographs the car; the dealer never uploads a photo · revises F035/F062/F063/F069/F070 · defers F034 · photography status, admin upload, order and primary, guarded approval, public images only while ACTIVE
- [x] R46 — Vehicle details are entered by hand; RC lookup is deferred · revises F056/F060/F061/F063 · defers F057/F058/F059/F068
- [x] R47 — The listing lifecycle, before billing exists · revises F064/F065/F067/F069/F070 · defers F050–F054 · submit, review, request changes, reject and approve landed; mark sold and remove (F067) landed as R69/R70
- [x] R48 — The dealer surfaces meet the listings · revises F066/F085/F086/F082/F083 · console nav, directory and portfolio counts, portfolio inventory, and the gallery
- [x] R49 — The VDP gallery is the one the spec draws · revises F083/R48 · strip, rail and lightbox header back, per §2.9/§2.10
- [x] R50 — `/cars` takes the header's district · revises F074/F077/R23 · `?district=` on `/v1/vehicles`, the dialog counts cars on `/cars` · [#167](https://github.com/shashikiran6sk/DealersDrive/pull/167)
- [x] R51 — A marketplace worth searching: 320 dev cars · revises F097 (part) · `pnpm db:seed:dev` writes dealerships then cars, deterministic and re-runnable · [#169](https://github.com/shashikiran6sk/DealersDrive/pull/169)
- [x] R52 — A car's colour is one of twelve families · revises F061/F076/F078/R51 · ⚠️ enum column, old text kept in `legacyColor`, conservative backfill · [#175](https://github.com/shashikiran6sk/DealersDrive/pull/175)
- [x] R53 — Filters offer only what can be chosen · revises F076/F078/R52 · Dealer needs a district like City / Town; zero-count options are disabled, not grey · [#176](https://github.com/shashikiran6sk/DealersDrive/pull/176)
- [x] R54 — Car search suggestions · revises F077/F080 · `GET /v1/search/vehicles` + `CarSearchBox` on the shared typeahead; typing no longer writes the URL · [#177](https://github.com/shashikiran6sk/DealersDrive/pull/177)
- [x] R55 — `/cars` controls read like `/dealers` · revises F080/R50/R54 · search, district, then sort on the right, one row · [#178](https://github.com/shashikiran6sk/DealersDrive/pull/178)
- [x] R56 — The filter rail scrolls on its own · revises F078/F086 · sticky, viewport-bounded, own scroller; results keep the page scroll · [#179](https://github.com/shashikiran6sk/DealersDrive/pull/179)
- [x] R57 — Results update in place, without a flash · revises F078/F079/F080 · measured no remounts; the dim waits 200 ms, so ordinary updates do not flicker
- [x] R58 — One proof of a handset, for every purpose · revises R39 · `normaliseIndianMobile` is the one canonical number; the MSG91 proof moves out of onboarding into `phone-proof.service.ts` with `DEALER_PHONE_LINK` / `DEALER_LOGIN` / `CUSTOMER_LOGIN` purposes
- [x] R59 — A phone and a Google account are two ways into one account · revises F014/F018/R39 · `identity.service.ts` owns every identity write; linking refuses, never merges (`IDENTITY_ALREADY_LINKED`); `users_phone_canonical` CHECK
- [x] R60 — Dealers sign in with their phone, and land where Google would have sent them · revises F018/R39 · `POST /v1/auth/sign-in/phone/dealer`, `GET /v1/auth/sign-in/phone/widget`; one `resolveDealerPostAuthDestination` for Google, phone and `/me`
- [x] R61 — A new dealer starts with either identity and completes the other on step 1 · revises F037/F038/R39/R60 · phone-first provisional dealers; `GET /v1/auth/google/link/start`; `ONBOARDING_IDENTITY_INCOMPLETE`; step 1 shows and requires both
- [x] R62 — Customer accounts, by phone alone · supersedes DESIGN-SPEC §4.10 for enquiries · ⚠️ two enum values · `CUSTOMER` session scope and seat; prove → name → create; one user for a dealer's number
- [x] R63 — One Login, with Customer and Dealer tabs · revises F017/F018/F073/R35 · header `Login` → `/login` (Customer default); Dealer tab is Google + phone; `/dealer/login` redirects; the session cookie is relayed by Server Actions
- [x] R64 — Enquiries come from signed-in customers · revises F088 · ⚠️ new table `enquiries` · `POST /v1/enquiries` takes a listing slug and an optional message; identity from the session, dealership from the listing; live listings only; one per customer per car per day
- [x] R65 — Enquire from the vehicle page, through sign-in and back · revises F089 · `Enquire now` on `/car/[slug]`; anonymous → Customer login and back with `?enquire=1`; name and verified mobile read-only; the page stays static
- [x] R66 — The dealer's enquiry inbox · revises F091 · `GET /v1/dealer/enquiries` (+ `/counts`), `PATCH /v1/dealer/enquiries/:id`; New / Contacted / Closed / Spam; tenant-scoped, a 404 for another dealership's; `/dealer/enquiries` in the console nav
- [x] R67 — Enquiry counts on the dashboard, and the signed-in header · revises F048/F073 · dashboard tile, recent panel and `counts.newEnquiries` read `enquiries`; header shows "Hi, name" + Logout for a customer; mobile header fits at 375
- [x] R68 — Customers track their enquiries, and ask again once one is closed · revises R64/R65/R67 · `GET /v1/enquiries` + `/enquiries` (Sent / Contacted / Closed; spam shown as Closed); one open enquiry per car replaces the 24-hour rule; "Requires login" under Enquire
- [x] R69 — The listing lifecycle a buyer can see: Active, Reserved, Sold, Withdrawn · revises F064/F067/R47 · ⚠️ `REMOVED` renamed `WITHDRAWN`, `RESERVED` added · five dealer routes; `SOLD` is final; a withdrawn car keeps its plate · [#192](https://github.com/shashikiran6sk/DealersDrive/pull/192)
- [x] R70 — The dealer reserves, sells, withdraws and relists from the console · revises F067/R69 · confirmation dialogs, a reason to withdraw, the moves on every inventory row and the vehicle page · [#193](https://github.com/shashikiran6sk/DealersDrive/pull/193)
- [x] R71 — A reserved car stays on show; a sold or withdrawn one leaves every public surface · revises F075/F076/F082/F086/R48/R64/R69 · visible vs available predicates, `availability` on card and page, `available` count, reserved card with no link, `409 LISTING_RESERVED` · [#194](https://github.com/shashikiran6sk/DealersDrive/pull/194)
- [x] R72 — The homepage searches the marketplace, and shows what is on it · lands F081 · hero District/Brand/Model/Budget → `/cars` URL; four `/v1/vehicles` rows, available cars only · [#195](https://github.com/shashikiran6sk/DealersDrive/pull/195)
- [x] R73 — Similar vehicles on the vehicle page · lands F084 · `GET /v1/vehicles/:slug/similar`, available only, deterministic score, newest-available fallback · [#196](https://github.com/shashikiran6sk/DealersDrive/pull/196)
- [x] R74 — Saved cars live on the server, and survive the lifecycle · revises F087 · ⚠️ new table `saved_vehicles` · `/v1/saved-vehicles` (list, slugs, PUT/DELETE by slug), customer guard, never deleted by the lifecycle · [#197](https://github.com/shashikiran6sk/DealersDrive/pull/197)
- [x] R75 — The heart, the sign-in that completes it, and the Saved cars page · revises F087/F075/F082 · heart on every card and the VDP, optimistic with rollback, `?save=` login intent, `/saved` grouped Available / Reserved / No longer available · [#198](https://github.com/shashikiran6sk/DealersDrive/pull/198)
- [x] R76 — The customer's account menu · revises R67/R68/F073 · one round avatar with initials; a menu with name, masked mobile, Saved cars, My enquiries, Logout; keyboard and screen-reader complete · [#199](https://github.com/shashikiran6sk/DealersDrive/pull/199)
- [x] R77 — Every surface agrees on the lifecycle · revises F066/R69–R76 · audit matrix in feature-map; dealer dashboard gains a Reserved tile · [#200](https://github.com/shashikiran6sk/DealersDrive/pull/200)
- [x] R78 — The homepage never says how many cars there are · revises R72 · every row's link reads "View all →"; `total` leaves `DiscoveryRow` · [#202](https://github.com/shashikiran6sk/DealersDrive/pull/202)
- [x] R79 — One search bar on the homepage, the same as `/cars` · revises R72/F081 · `CarSearchBox` replaces District/Brand/Model/Budget; suggestions open `/cars`, Enter opens `/cars?q=`; `HeroSearch` removed · [#203](https://github.com/shashikiran6sk/DealersDrive/pull/203)
- [x] R80 — A stale cached read is asked for again, not shown as an error · revises R22 · `apiGetParsed` refetches once with `no-store` when a cached payload fails its contract; a live mismatch still throws · [#205](https://github.com/shashikiran6sk/DealersDrive/pull/205)
- [~] R81 — The UI revamp: production behaviour, the revamped prototype's look · neutral tokens, Manrope, header/footer/cards/login/console re-skinned; directory cards drop the tagline; `/contact` with admin-configurable `support.*` contacts; a single hero banner whose photograph is admin-configurable (`home.heroImage*`)
- [x] R82 — A reserved or withdrawn car goes back on sale only on an admin's approval · revises R69/R70/R77 · ⚠️ new table `listing_reactivation_requests` · `reactivate`/`relist` admin-only; `POST /v1/dealer/vehicles/:id/request-reactivation` replaces the dealer's `reactivate`/`relist`; `GET /v1/admin/reactivation-requests` + `/:id/approve`·`/reject`; one pending request per listing (partial unique index); a sale closes a pending request; a reserved car is no longer withdrawable
- [x] R83 — Cars and information take turns down the homepage · revises R72/R81 · `HOME_FLOW` order: Recently added → journey → SUVs → why Dealers-Drive → automatic → built for both sides → under ₹10 lakh; the explainers become `JourneySection`/`TrustSection`/`AudienceSection`; `DiscoveryBand` leaves no gap for an empty row; same four reads
- [x] R84 — A selected filter chip keeps its label on hover · fixes `.dd-chip` (dealer inventory, dealer enquiries): the hover rule no longer out-ranks the selected state; selected hover darkens the ground only
- [x] R85 — Dealer Login in the customer's account menu · revises R76 · a `Link` to `/dealer` between separators, after My enquiries and before Logout; no auth logic of its own
- [x] R86 — The login's Customer/Dealer switch is aligned to the left of the form · layout only (`justify-end` → `justify-start` on the tablist); no auth change
- [x] R87 — Previous / next arrows on the vehicle page's main photograph · revises R49 · one gallery `index` drives the hero, the strip's current thumbnail and the lightbox; the hero arrows reuse the lightbox's wrapping `step`; none for a single photo
- [x] R88 — The card and vehicle-page titles no longer repeat the year the plate shows · `VehicleName` + contracts `titleWithoutYear`; the year stays in the accessible name; `title` unchanged everywhere else (SEO, alt, console)
- [~] R89 — Admins see every enquiry, read-only · revises R64/R66/R68 · `GET /v1/admin/enquiries` (status tabs, search by customer/mobile/dealer/car/plate, dealer, IST day range, keyset paging) + `/:id` (customer, dealer, car, audit-trail history); `admin:enquiry:read`; two indexes; `/admin/enquiries` + detail; no admin write, the dealer's inbox stays the only place status moves

---

## Sandbox steps

Tracked here too, because they gate UI features rather than following them.

- [x] S0 — `apps/sandbox` skeleton, `pnpm sandbox` working
- [x] S1 — the 16 primitives (ships inside F009–F013)
- [ ] S2 — decorators + mock factories
- [ ] S3 — `Combobox`, `PlateInput`, `VehicleCard`, `DirectoryCard`
- [ ] S4 — `VehicleGallery`, `MobileFilterSheet`, `FilterPanel`
- [ ] S5 — `@storybook/addon-vitest` wired
- [ ] S6 — the five missing primitives
- [ ] S7 — feature components
