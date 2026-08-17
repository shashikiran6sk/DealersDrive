# Dealers-Drive — Agent Context

> This file is the primary instruction set for Claude Code and other coding agents working on this repository.
>
> **Goal:** Build the Dealers-Drive application end-to-end from the existing product specifications, UI screenshots, and interactive HTML prototype. The application should be runnable locally as a complete working product.
The current implementation must focus exclusively on the website experience. Do not implement mobile or tablet-specific layouts at this stage.
>
> Before writing code, read **all source-of-truth files listed below**. Do not start implementation based only on this file.

---

# 1. What this is

**Dealers-Drive** is a B2B2C used-car marketplace for Tamil Nadu.

* Independent dealers list their own vehicle inventory.
* Buyers can browse vehicles publicly without creating an account.
* Dealers manage their inventory through a dealer dashboard.
* Dealers use credits for actions that require credits.
* Dealers-Drive is the technology and marketplace layer.
* Dealers-Drive does **not** own the vehicles.

For the current local development version, prioritize demonstrating the complete product workflow rather than production payment/authentication integrations.

---

# 2. SOURCE-OF-TRUTH FILES

The repository contains the following product-definition files:

```text
docs/
├── API-SPEC.md
├── ARCHITECTURE.md
├── DESIGN-SPEC.md
│
├── screens/
│
└── Dealers-Drive-UI/
```

There may be an interactive HTML prototype such as:

```text
Dealers-Drive-UI.html
```

or an equivalent interactive UI file.

## Read ALL of them before implementation.

### `docs/ARCHITECTURE.md`

Defines:

* system architecture
* database design
* entities and relationships
* state machines
* security model
* tenancy/isolation
* deployment architecture
* server/client boundaries
* infrastructure decisions

### `docs/API-SPEC.md`

Defines:

* API endpoints
* HTTP methods
* request schemas
* response schemas
* error responses
* query parameters
* path parameters
* authentication expectations

### `docs/DESIGN-SPEC.md`

Defines:

* design tokens
* typography
* colors
* spacing
* components
* layouts
* responsive behavior
* screen requirements
* loading states
* empty states
* error states
* accessibility requirements

### `screens/`

Contains the visual references/screenshots.

Use these to verify the implementation visually.

### Interactive HTML UI

The interactive HTML prototype is the **visual interaction reference**.

Use it to understand:

* navigation
* interactions
* dropdowns
* modals
* forms
* filters
* tabs
* vehicle interactions
* dealer dashboard interactions
* responsive behavior

If the written design specification is ambiguous about visual behavior, inspect the interactive prototype.

---

# 3. DOCUMENT PRIORITY

When implementing the application, use this priority:

```text
ARCHITECTURE.md
       ↓
API-SPEC.md
       ↓
DESIGN-SPEC.md
       ↓
Interactive HTML prototype
       ↓
Screenshots
```

However, visual implementation should use the prototype and screenshots together.

If two documents directly contradict each other:

**STOP and report the conflict.**

Do not silently choose one interpretation for:

* database structure
* API behavior
* permissions
* authentication
* money
* credits
* listing states
* dealer ownership
* security

For purely visual ambiguity, prefer the interactive prototype.

---

# 4. CURRENT DEVELOPMENT SCOPE

This is currently a **local development/testing version**.

Do NOT spend implementation effort on production integrations that are explicitly deferred below.

The goal is:

> **A fully working local Dealers-Drive application where a developer can run the project, use the dealer dashboard, manage vehicles, browse vehicles publicly, perform credit-based actions, and experience the intended UI/UX end-to-end.**

---

# 5. AUTHENTICATION — TEMPORARILY BYPASS

For the current local version:

## DO NOT IMPLEMENT

* dealer signup
* dealer signin
* OTP verification
* OTP resend
* password authentication
* production session authentication
* production identity verification

These can be implemented later.

## Instead

Create a **local development dealer/session mechanism**.

The application should behave as if a dealer is authenticated.

For example:

```text
Current Local Dealer
--------------------
Dealer ID: dealer-demo-001
Dealer Name: Demo Motors
Phone: +91 98400 12345
Status: ACTIVE
Credits: determined from database
```

The exact implementation should follow the architecture where possible, but authentication can be mocked/bypassed for local development.

### Important

Even though authentication is bypassed:

**Do NOT weaken tenant isolation.**

The application should still behave as though:

```text
dealerId = current authenticated dealer
```

and server-side code must derive the dealer from the local development session/context rather than accepting arbitrary `dealerId` values from clients.

---

# 6. PAYMENTS — TEMPORARILY MOCKED

Razorpay is **NOT required for the current version**.

Do not implement:

* Razorpay checkout
* payment gateway callbacks
* payment verification
* production payment webhooks
* real payment transactions

Instead, implement a **development credit purchase flow**.

When the dealer clicks:

```text
Buy credits
```

the application should immediately add the selected number of credits to the dealer's wallet.

Example:

```text
Buy 100 credits
        ↓
Development purchase
        ↓
CreditTransaction created
        ↓
Dealer wallet updated
        ↓
Success message
        ↓
Wallet balance refreshed
```

There should be **no Razorpay page**.

---

# 7. CREDIT SYSTEM

Although payment is mocked, the underlying credit accounting should remain production-quality.

Credits must NOT simply be incremented by:

```ts
dealer.credits += 100
```

Instead follow the architecture's credit transaction model.

Every credit movement should create a:

```text
CreditTransaction
```

and update the wallet/balance according to the architecture.

The operation must remain atomic.

Use:

```text
SELECT ... FOR UPDATE
```

where required by `ARCHITECTURE.md`.

The mocked purchase should therefore behave like:

```text
Dealer clicks Buy Credits
        ↓
Create development purchase
        ↓
Create CreditTransaction
        ↓
Update dealer credit balance
        ↓
Commit transaction
```

This allows Razorpay to be added later without redesigning the credit system.

---

# 8. DO NOT BUILD PRODUCTION FEATURES THAT ARE DEFERRED

For this version, do not spend time implementing:

* Razorpay
* production authentication
* OTP provider integration
* production SMS
* production email flows
* unnecessary admin functionality not required by the existing specs
* unnecessary infrastructure
* unnecessary microservices
* unnecessary abstractions

Implement the product defined in the documents, but use mocks/stubs where the current scope explicitly says to do so.

---

# 9. STACK — DO NOT SUBSTITUTE

Use the stack defined by the architecture specification.

Unless the source-of-truth documents explicitly require otherwise:

| Layer               | Choice                                             |
| ------------------- | -------------------------------------------------- |
| Language            | TypeScript                                         |
| TypeScript          | `strict` + `noUncheckedIndexedAccess`              |
| Web                 | Next.js 15, App Router, RSC                        |
| Styling             | Tailwind CSS v4 + CVA                              |
| UI                  | Radix UI, styled locally                           |
| API                 | Express 5 + TypeScript                             |
| ORM                 | Prisma 6                                           |
| Database            | PostgreSQL 16                                      |
| Jobs                | pg-boss                                            |
| Storage             | Cloudflare R2 / Cloudflare Images                  |
| Email               | Resend                                             |
| SMS                 | MSG91                                              |
| Payments            | Razorpay — **deferred/mocked for current version** |
| Monorepo            | Turborepo + pnpm                                   |
| Validation          | Zod                                                |
| Public server state | RSC fetch                                          |
| Dashboard state     | TanStack Query                                     |
| Forms               | react-hook-form + Zod                              |

Do not introduce:

* MongoDB
* Redis
* Elasticsearch
* GraphQL
* NestJS
* microservices
* Redux
* another global state manager

unless the source-of-truth architecture explicitly changes.

---

# 11. THE NINE CORE RULES

These rules are mandatory.

## Rule 1 — dealerId

`dealerId` must always come from the current dealer session/context.

Never accept it from:

* request body
* query parameter
* URL path

A DTO containing a client-provided `dealerId` is a bug.

For local development, use the mocked dealer session/context.

---

## Rule 2 — Zod

All API input must use strict Zod schemas.

```ts
schema.strict()
```

Unknown:

* body fields
* query parameters
* request fields

must be rejected.

Do not silently ignore unknown fields.

---

## Rule 3 — Money

Money must use:

```text
BigInt paise
```

Never use floating point numbers for money.

Never store rupees as floating-point values.

Formatting happens only at the application boundary.

---

## Rule 4 — Credit Transactions

Every credit movement must create a `CreditTransaction`.

Credit movement and the operation it pays for must occur in the same database transaction where required.

Lock the dealer row using:

```sql
SELECT ... FOR UPDATE
```

Never directly mutate a credit balance without the corresponding transaction record.

---

## Rule 5 — Listing State

Listing state changes must go through:

```ts
transition(listing, event, actor)
```

Never directly assign:

```ts
listing.status = ...
```

---

## Rule 6 — Public Listings

Only listings satisfying:

```text
listing.status === APPROVED
AND
dealer.status === ACTIVE
```

can be publicly visible.

Counts and search results must follow the architecture's `listing_search` rules.

Never hard-code marketplace counts.

---

## Rule 7 — Dealer Phone Numbers

The public API must never expose a dealer's phone number in ordinary public vehicle responses.

Phone reveal must happen only through:

```text
POST /v1/vehicles/:id/reveal-contact
```

and follow the API specification.

---

## Rule 8 — Server by Default

Prefer:

```text
Server Components
RSC
URL state
server-side fetching
```

Use client components only where interactivity requires them.

Do not turn entire pages into client components unnecessarily.

Follow the screen-level server/client guidance in `ARCHITECTURE.md`.

---

## Rule 9 — Environment Variables

Do not introduce unnecessary `NEXT_PUBLIC_*` variables.

Server configuration should be read at runtime where required.

Preserve build-once-promote-many behavior.

---

# 12. DESIGN RULES

The visual design must closely match the existing prototype and screenshots.

## Corners

Square corners are the default.

Do not casually add rounded corners.

Do not use:

```css
border-radius: 50%;
```

Avatars are square.

Only use rounded corners where explicitly defined by `DESIGN-SPEC.md`.

---

## Shadows

Use shadows only where specified by the design system.

Do not add shadows to:

* cards
* tables
* headers
* sidebars
* badges
* buttons

Depth should primarily come from:

* borders
* 1px hairlines
* background contrast

---

## Blueprint

Whenever a `.blueprint` component is used, it must contain all four corner elements:

```html
<i class="corner tl"></i>
<i class="corner tr"></i>
<i class="corner bl"></i>
<i class="corner br"></i>
```

---

## Plate Motif

The plate motif has exactly the uses defined by the design specification.

Do not invent additional uses.

---

## Color

Cobalt is the primary decorative color.

Semantic colors are reserved for:

```text
green  → published/captured/success
amber  → pending/under review
red    → rejected/failed
```

Do not use semantic colors as decorative emphasis.

---

## Numeric values

Use:

```css
font-variant-numeric: tabular-nums;
```

for:

* prices
* EMI
* kilometres
* credit counts
* statistics
* filter counts
* table numeric columns
* invoice amounts

Do not apply it to normal prose.

---

## Currency

Use:

```text
₹6.45 Lakh
```

for displayed vehicle prices.

Raw amounts should use:

```ts
toLocaleString("en-IN")
```

Dates:

```text
02 Aug 2026
```

Phones:

```text
+91 98400 12345
```

---

# 13. UI IMPLEMENTATION REQUIREMENT

The screenshots and interactive HTML prototype are not optional references.

They are part of the implementation specification.

For every screen:

1. Read the relevant section in `DESIGN-SPEC.md`.
2. Inspect the corresponding screenshot.
3. Inspect the interactive HTML prototype.
4. Identify all visible states.
5. Implement the screen.
6. Implement responsive behavior.
7. Implement loading state.
8. Implement empty state.
9. Implement error state.
10. Compare the result against the screenshot.

Do not create a generic dashboard that merely contains the same information.

The actual visual structure should match the provided design.

---

# 14. IMPLEMENT THE COMPLETE PRODUCT

This is a **single-prompt full implementation task**.

Do not stop after scaffolding.

Read the specifications and implement the complete application described by them.

This includes, where specified:

### Public marketplace

* home page
* vehicle search
* filters
* sorting
* vehicle listing
* vehicle details
* image gallery
* enquiry/contact flows
* public navigation
* responsive layouts

### Dealer experience

* dealer dashboard
* inventory
* vehicle creation
* vehicle editing
* vehicle publishing workflow
* vehicle details
* dealer statistics
* credits/wallet
* credit transactions
* buy credits
* mocked credit purchase
* contact reveal
* other dealer features defined in the documents

### Admin

Implement only the admin functionality explicitly defined in the source-of-truth documents.

### Authentication

Use the local mocked dealer session instead of production signup/signin.

### Payments

Use the local mocked credit purchase instead of Razorpay.

---

# 15. MOCK DATA VS DATABASE

Use the real PostgreSQL/Prisma data model wherever the architecture specifies persistent data.

Do not build the entire application around static frontend mock data.

Mock only external services that are intentionally deferred:

```text
Authentication
Payment gateway
SMS
Email
```

The core application data should use the actual database.

---

# 16. LOCAL DEVELOPMENT EXPERIENCE

A developer should be able to clone the repository and run the application locally.

The final experience should be approximately:

```bash
pnpm install
pnpm dev
```

Then:

```text
Public marketplace
        ↓
Browse vehicles
        ↓
Open vehicle
        ↓
Dealer dashboard
        ↓
Manage inventory
        ↓
Use credits
        ↓
Buy credits
        ↓
Credits immediately added
        ↓
Continue using dealer features
```

No production payment page should interrupt this workflow.

No dealer signup/signin should block access.

---

# 17. LOCAL DEALER

Create a deterministic development dealer.

Example:

```text
ID: dealer-demo-001
Name: Demo Motors
Status: ACTIVE
```

The exact database fields must follow the architecture schema.

The development dealer should be seeded automatically or through the project's existing seed mechanism.

If a seed mechanism does not exist, create one appropriate to the existing architecture.

Do not hard-code the dealer directly into every service.

Use a development session/context abstraction so production authentication can replace it later.

---

# 18. DEVELOPMENT PAYMENT ADAPTER

Keep the payment architecture extensible.

Use a payment abstraction similar to:

```text
PaymentProvider
      |
      +-- RazorpayProvider
      |
      +-- DevelopmentPaymentProvider
```

For now:

```text
DevelopmentPaymentProvider
```

should be active.

The development provider should immediately report a successful purchase.

Do not remove the payment abstraction if the architecture already defines one.

The purpose is to make replacing the development implementation with Razorpay later straightforward.

---

# 19. ERROR HANDLING

Use RFC 9457 `application/problem+json`.

Use the shared error classes defined by the architecture.

Never do:

```ts
res.status(500).send("error");
```

Never leak stack traces or internal implementation details to clients.

---

# 20. TYPESCRIPT

Strict TypeScript is mandatory.

```text
strict: true
noUncheckedIndexedAccess: true
```

Never use:

```ts
any
```

Avoid:

```ts
@ts-ignore
```

If absolutely necessary, add a comment explaining the exact reason.

Prefer correct types over type assertions.

---

# 21. API RULES

Do not invent endpoints.

Every API endpoint must exist in:

```text
docs/API-SPEC.md
```

If the application requires functionality that does not have an API specification:

1. Check whether it can be implemented using an existing endpoint.
2. Check the architecture.
3. If no valid endpoint exists, report the missing specification instead of silently inventing an API.

However, for the explicitly approved local development behavior such as mocked authentication/payment, implement the minimum local adapter/mock necessary without changing the public API contract unless the specification requires it.

---

# 22. DATA ACCESS

Follow the repository pattern and architecture.

Keep responsibilities separated:

```text
route
  ↓
controller
  ↓
service
  ↓
repository
  ↓
Prisma
```

Do not put business logic directly into route handlers.

Do not access Prisma directly from React components.

---

# 23. SECURITY

Even in local development, preserve the security architecture.

Do not:

* trust dealerId from the frontend
* expose private dealer data publicly
* bypass tenant checks
* expose internal database fields
* expose phone numbers in public responses
* skip authorization checks simply because authentication is mocked

The only thing being bypassed locally is the **identity verification mechanism**.

The application should still enforce the resulting identity and permissions.

---


# 25. RESPONSIVE DESIGN

Implement the responsive behavior specified in:

```text
docs/DESIGN-SPEC.md
```

Do not assume desktop-only behavior.

Test:

```text
mobile
tablet
desktop
```

The provided screenshots/prototype determine the expected behavior.

---

# 26. TESTING

Tests must cover:

### Business logic

* happy paths
* validation errors
* authorization errors
* documented API errors
* state transitions
* credit transactions
* credit purchases
* contact reveal
* listing visibility

### Tenant isolation

Every dealer-scoped operation must prove:

```text
Dealer A cannot access Dealer B's data.
```

### API contracts

Implementation must satisfy the Zod schemas in:

```text
packages/contracts
```

---

# 27. DEFINITION OF DONE

The application is not considered complete merely because it compiles.

Before declaring the implementation complete:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

must pass.

Additionally:

* [ ] API contracts pass
* [ ] Database migrations work
* [ ] Seed data works
* [ ] Development dealer works
* [ ] Public marketplace works
* [ ] Dealer dashboard works
* [ ] Inventory workflow works
* [ ] Credit wallet works
* [ ] Buy-credit development flow works
* [ ] No Razorpay page is required
* [ ] Dealer signup/signin does not block local usage
* [ ] Tenant isolation works
* [ ] Loading states exist
* [ ] Empty states exist
* [ ] Error states exist
* [ ] Keyboard navigation works
* [ ] No console errors
* [ ] Responsive layouts work
* [ ] Screens visually match the provided references

---

# 28. VISUAL QA

Before claiming a UI feature is complete:

1. Run the application.
2. Navigate to the implemented screen.
3. Compare it with the matching screenshot in `screens/`.
4. Compare interactions against the interactive HTML prototype.
5. Fix differences.

Pay special attention to:

* spacing
* typography
* borders
* corner radius
* shadows
* colors
* icon sizes
* button sizes
* table layouts
* responsive behavior
* empty states
* modal behavior
* navigation
* vehicle cards
* dealer dashboard layout

Do not claim visual completion without actually checking the reference.

---

# 29. IMPLEMENTATION STRATEGY

When starting from an empty or partially implemented repository:

## Phase 1 — Understand

Read:

```text
docs/ARCHITECTURE.md
docs/API-SPEC.md
docs/DESIGN-SPEC.md
```

Then inspect:

```text
screens/
Dealers-Drive-UI/
```

Build a mental model of:

```text
Database
API
Frontend
Authentication
Dealer workflow
Vehicle workflow
Credit workflow
Public marketplace
```

---

## Phase 2 — Inspect existing repository

Before creating files:

* inspect existing package.json files
* inspect pnpm workspace
* inspect Turborepo configuration
* inspect Prisma schema
* inspect existing apps
* inspect existing components
* inspect existing contracts
* inspect environment configuration

Reuse existing code when it already follows the architecture.

Do not rewrite working infrastructure unnecessarily.

---

## Phase 3 — Infrastructure

Ensure:

* workspace works
* web app works
* API works
* database connection works
* Prisma works
* migrations work
* contracts work
* local development configuration works

---

## Phase 4 — Database and seed

Implement the schema defined in the architecture.

Create development seed data for:

* dealer
* vehicles/listings
* credits
* required supporting entities

Seed enough data to make the UI meaningful.

---

## Phase 5 — API

Implement the APIs defined in:

```text
docs/API-SPEC.md
```

Use:

```text
Zod
contracts
controllers
services
repositories
mappers
```

---

## Phase 6 — Public marketplace

Implement the public user journey first:

```text
Home
  ↓
Search
  ↓
Filters
  ↓
Vehicle results
  ↓
Vehicle details
  ↓
Contact/reveal flow
```

---

## Phase 7 — Dealer application

Implement:

```text
Dealer dashboard
  ↓
Inventory
  ↓
Vehicle management
  ↓
Listing workflow
  ↓
Credits
  ↓
Buy credits
  ↓
Credit-dependent actions
```

Use the development dealer session.

---

## Phase 8 — UI refinement

Compare every screen against:

```text
screens/
```

and:

```text
Dealers-Drive-UI
```

Fix visual discrepancies.

---

## Phase 9 — Testing

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Fix failures rather than weakening tests.

---

# 30. WHAT NOT TO DO

Do NOT:

* invent APIs
* invent database models without architectural justification
* create unnecessary microservices
* add Redux
* add MongoDB
* add Redis
* add Elasticsearch
* add GraphQL
* add unnecessary dependencies
* build Razorpay now
* build production authentication now
* create a generic UI instead of following the prototype
* use arbitrary mock data instead of the database
* accept dealerId from the client
* expose dealer phone numbers publicly
* directly modify listing status
* directly modify credit balances
* use floating-point money
* use `any`
* weaken tests
* hide errors
* silently ignore specification conflicts
* stop at scaffolding

---

# 31. WHEN SOMETHING IS AMBIGUOUS

Use this decision process:

### Architecture/data/security ambiguity

STOP and ask.

### API ambiguity

Check:

```text
API-SPEC.md
ARCHITECTURE.md
```

If still unresolved, ask.

### UI ambiguity

Check:

```text
DESIGN-SPEC.md
screens/
interactive HTML prototype
```

Prefer the prototype for purely visual behavior.

### Implementation detail

Use the simplest implementation consistent with the architecture.

Do not over-engineer.

---

# 32. FINAL AGENT BEHAVIOR

You are expected to behave as a senior full-stack engineer implementing an existing product specification.

Do not ask unnecessary questions.

Before asking a question, inspect:

```text
ARCHITECTURE.md
API-SPEC.md
DESIGN-SPEC.md
screens/
interactive HTML prototype
existing source code
```

If the answer can be determined from those sources, make the decision and implement it.

Only stop and ask when the decision materially affects:

* database schema
* API contract
* security
* permissions
* money
* credit accounting
* listing state
* tenant isolation
* conflicting specifications

For everything else, make the most reasonable implementation consistent with the existing product.

---

# 33. FIRST ACTION

When starting a new implementation session, do this before writing application code:

```text
1. Read docs/ARCHITECTURE.md completely.
2. Read docs/API-SPEC.md completely.
3. Read docs/DESIGN-SPEC.md completely.
4. Inspect every file under screens/.
5. Open and inspect the interactive Dealers-Drive HTML prototype.
6. Inspect the existing repository structure.
7. Inspect package.json / pnpm workspace / turbo configuration.
8. Inspect the Prisma schema.
9. Identify what is already implemented.
10. Create an implementation plan internally.
11. Implement the application end-to-end.
12. Run tests, typecheck, lint and build.
13. Run the application and perform visual QA.
14. Fix issues found during QA.
15. Only then report completion.

Do not begin by creating random scaffolding.

The existing specifications and prototype define the product.
The codebase should be built to match them.
```
