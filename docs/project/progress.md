# Reconstruction progress

The single place a feature's reconstruction status is recorded. **Nothing else
in the repository tracks progress** — not `CLAUDE.md`, not `CONTEXT.md`, not
`README.md`. One line, one file, so 97 branches do not fight over the same
paragraph in three documents.

**A feature PR ticks its own line and nothing else here.** A conflict on this
file is one line and resolves in seconds; a conflict on a prose paragraph does
not.

Legend — `[ ]` not started · `[~]` PR open · `[x]` merged to `main`

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

- [x] F026 — City & location reference data
- [x] F027 — Rate limiting · ⚠️ pulled forward, ahead of Tier 2
- [x] F028 — Caching layer · ⚠️ pulled forward, ahead of Tier 2
- [x] F029 — Platform config & feature flags
- [x] F030 — Audit log · ⚠️ pulled forward, ahead of Tier 2
- [x] F031 — Events, outbox & background jobs · ⚠️ pulled forward, ahead of Tier 2

## Tier 5 — Storage & media

- [x] F032 — Storage port & adapters · ⚠️ pulled forward, ahead of Tier 2
- [x] F033 — Presigned upload & commit · [#50](https://github.com/shashikiran6sk/DealersDrive/pull/50)

> F034 and F035 moved to Tier 9 (decision D4) — they serve vehicle galleries,
> and nothing in Tier 6 or 7 depends on them.

## Tier 6 — Dealer onboarding

- [x] F036 — Dealer entity & tenant isolation · ⚠️ pulled forward, ahead of Tier 2
- [ ] F037 — Onboarding shell & step routing
- [ ] F038 — Onboarding — account step
- [ ] F039 — Onboarding — business details step
- [ ] F040 — Dealer document model & types
- [ ] F041 — Onboarding — document upload step
- [ ] F042 — Onboarding — review & submit step
- [ ] F043 — Onboarding completeness tracking
- [ ] F044 — Admin document verification
- [ ] F045 — Dealer approval, rejection & suspension

## Tier 7 — Consoles

- [ ] F046 — Dealer profile management
- [ ] F047 — Dealer console shell & navigation
- [ ] F048 — Dealer dashboard
- [ ] F049 — Admin console shell & navigation

## Tier 8 — Billing & credits

- [ ] F050 — Credit ledger & balance
- [ ] F051 — Credit packs & purchase orders
- [ ] F052 — Payment verification
- [ ] F053 — Invoices & PDF delivery
- [ ] F054 — Admin credit grants & payments view

## Tier 9 — Vehicle intake

- [ ] F034 — Image derivative pipeline · ⚠️ moved from Tier 5, D4
- [ ] F035 — Media ordering & primary photo · ⚠️ moved from Tier 5, D4
- [ ] F055 — Vehicle data model
- [ ] F056 — Plate input & normalisation
- [ ] F057 — RC lookup port, mock adapter & caching
- [ ] F058 — Attestr RC adapter
- [ ] F059 — RC lookup UI & registration step
- [ ] F060 — Vehicle basics — RC-prefilled or manual ⚠️
- [ ] F061 — Vehicle details
- [ ] F062 — Vehicle photo upload UI
- [ ] F063 — Vehicle wizard shell & step routing

## Tier 10 — Listing lifecycle

- [ ] F064 — Listing model & state machine
- [ ] F065 — Listing submission & resubmission
- [ ] F066 — Dealer inventory list
- [ ] F067 — Mark sold, remove & renew
- [ ] F068 — Vehicle history report

## Tier 11 — Moderation

- [ ] F069 — Moderation queue
- [ ] F070 — Listing review & decisions
- [ ] F071 — Listing takedown
- [ ] F072 — Admin platform config editor

## Tier 12 — Public marketplace

- [ ] F073 — Public shell — header & footer
- [ ] F074 — City selector
- [ ] F075 — Vehicle card
- [ ] F076 — Search API & facets ⚠️
- [ ] F077 — Search results page
- [ ] F078 — Filter panel
- [ ] F079 — Mobile filter sheet
- [ ] F080 — Search toolbar & sort
- [ ] F081 — Homepage & hero search
- [ ] F082 — Vehicle detail page
- [ ] F083 — Vehicle gallery & lightbox
- [ ] F084 — Similar vehicles
- [ ] F085 — Dealer directory
- [ ] F086 — Dealer portfolio
- [ ] F087 — Saved cars

## Tier 13 — Enquiries

- [ ] F088 — Enquiry model & submission API
- [ ] F089 — Public enquiry form
- [ ] F090 — Contact reveal
- [ ] F091 — Dealer enquiry inbox
- [ ] F092 — SMS notifications

## Tier 14 — Surface polish

- [ ] F093 — Error boundaries & error pages
- [ ] F094 — Loading & not-found states
- [ ] F095 — SEO & metadata
- [ ] F096 — API documentation — OpenAPI & Postman
- [ ] F097 — Seed data & developer bootstrap

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
