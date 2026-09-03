# Component Sandbox — Design

**Status: design only. Nothing here has been built.** Do not implement any of
this until Phase 1 is approved.

The sandbox is not a component gallery. It is the **registry, the workbench and
the test harness** for the UI layer, and it is a required step in the feature
workflow — a UI component is not done until it has an entry here.

---

## 1. Why this repository needs one

Four facts from the audit, each of which the sandbox addresses directly:

| Fact                                                                                                                           | Consequence                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 64 of 65 components have no test; web coverage is **13.83 %** against a declared target of 90 %                                | There is no way to see a component in a state without producing that state through a real database |
| `<Button>` is used **29** times; raw `className="btn …"` appears **88** times across 39 files — a 75 % bypass rate             | There is no registry to search, so people write the class                                          |
| Five DESIGN-SPEC components (Input, Card, Table, Segmented, Dialog) exist **only as CSS** — `.table` is hand-rolled in 5 pages | Duplication happened precisely because discovery was impossible                                    |
| `dealer-card.tsx` exports `DirectoryCard`; `DealerCard` is a _contracts type_                                                  | Searching for a component by its obvious name returns the wrong thing                              |

The sandbox is the fix for the discovery problem, and the harness that makes the
coverage problem solvable.

---

## 2. Architecture

### Recommended: Storybook 9 (`@storybook/nextjs-vite`) in its own workspace package

```text
apps/sandbox/                      ← new workspace package, local-only
├── package.json                   ← @dealers-drive/sandbox, "private": true
├── tsconfig.json
├── .storybook/
│   ├── main.ts                    ← stories glob, framework, viteFinal alias
│   └── preview.tsx                ← imports apps/web/src/styles/globals.css
│                                     + global decorators (§7)
├── src/
│   ├── registry.ts                ← the searchable component index (§5)
│   ├── mocks/                     ← contract-validated fixtures (§8)
│   │   ├── vehicle.ts
│   │   ├── dealer.ts
│   │   ├── vocabulary.ts             ← makes/models/variants (see D1)
│   │   ├── enquiry.ts
│   │   └── index.ts
│   ├── decorators/                ← SavedCarsProvider, QueryProvider, viewport
│   └── stories/                   ← mirrors apps/web/src/components + features
│       ├── ui/button.stories.tsx
│       ├── ui/primitives.stories.tsx
│       ├── forms/combobox.stories.tsx
│       ├── vehicle/vehicle-card.stories.tsx
│       └── …
└── README.md
```

### Why a separate package rather than `apps/web/.storybook`

This was the one genuinely contested decision in the audit. The evidence
decided it:

- `apps/web/tsconfig.json` includes `**/*.tsx`, and `apps/web/next.config.ts`
  sets `typescript: { ignoreBuildErrors: false }`. **Stories placed under
  `apps/web/src` would be type-checked by `next build`** — so a broken story
  would fail the production Docker image build. That violates _"must not affect
  production builds"_ outright.
- Storybook's devDependencies would land in `apps/web/package.json`. The
  production image is safe either way (the runner stage runs
  `pnpm install --frozen-lockfile --prod`, verified in `apps/web/Dockerfile:63`),
  but the **build** stage installs devDependencies and would get slower.

A separate package gives hard isolation at the cost of one Vite alias.

**Precedent that this is safe:** the web Dockerfile's deps stage copies only 4
of the workspace's 5 manifests and runs `pnpm install --frozen-lockfile`
successfully today — `apps/api/package.json` is never copied. Adding a fifth
workspace does not change that pattern. _(Verify on the first CI run regardless.)_

### Why Storybook rather than a hand-rolled Next app

| Requirement                                        | Storybook 9 + `@storybook/nextjs-vite`                                        | Hand-rolled Next app       |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------- |
| Separate process & port                            | built in (default 6006)                                                       | yes                        |
| Prop controls from TS types                        | automatic via `react-docgen`                                                  | hand-written per component |
| `next/link`, `next/navigation`, `next/image` stubs | provided by the framework — solves coupling **C-3** for 17 components         | hand-written               |
| Responsive viewports                               | built-in viewport toolbar                                                     | hand-written               |
| Interaction tests                                  | `play()` functions                                                            | hand-written               |
| **Runs stories as Vitest component tests**         | `@storybook/addon-vitest` — reuses the existing jsdom + Testing Library setup | no                         |
| Cost                                               | ~large devDependency tree                                                     | small                      |

The last row is decisive. The repo already runs Vitest with jsdom, Testing
Library and `@vitejs/plugin-react` in `apps/web`. Storybook's Vitest addon turns
every scenario into a component test in that same runner — so the sandbox is not
_adjacent_ to closing the 13.83 % coverage gap, it **is** the mechanism.

### Alternative, if the dependency footprint is unacceptable

A minimal Vite + React app in `apps/sandbox` with a hand-written control panel
driven by `registry.ts`. It satisfies every isolation requirement and roughly
half the workflow value. `next/navigation` and `next/link` would need manual
aliases — but `apps/web/tests/setup.ts` already contains exactly those stubs and
they can be reused verbatim. Choose this only if Storybook is rejected on
principle; the audit recommends Storybook.

---

## 3. Process and port

| Service                  | Port            | Source                                            |
| ------------------------ | --------------- | ------------------------------------------------- |
| Web (Next.js)            | **3000**        | `apps/web/package.json`, `docker-compose.yml:259` |
| API (Express)            | **4000**        | `.env.example:27`, `docker-compose.yml:222`       |
| Postgres                 | **5432**        | `docker-compose.yml:122`                          |
| MinIO (S3 API / console) | **9000 / 9001** | `docker-compose.yml:144–145`                      |
| Mailpit (SMTP / UI)      | **1025 / 8025** | `docker-compose.yml:164–165`                      |
| **Sandbox**              | **6006**        | ← proposed                                        |

`6006` was chosen because it is Storybook's convention **and** because a
repo-wide search confirms nothing in this project uses it or any port in
`6000–6009`. It collides with nothing above.

The sandbox runs as its **own foreground process**. It is started by a person,
never by the web app, never by the API, never by `docker compose`, and never by
CI's deploy path.

---

## 4. Startup command

Root `package.json` gains exactly one script:

```jsonc
{
  "scripts": {
    "sandbox": "pnpm --filter @dealers-drive/sandbox dev",
  },
}
```

and `apps/sandbox/package.json`:

```jsonc
{
  "name": "@dealers-drive/sandbox",
  "private": true,
  "scripts": {
    "dev": "storybook dev -p 6006 --no-open",
    "build": "storybook build -o storybook-static",
    "test": "vitest run",
  },
}
```

```text
pnpm sandbox      → http://localhost:6006
```

**`sandbox` must NOT be added to `turbo.json`'s `dev` task.** `pnpm dev` at the
root runs `turbo run dev`, which would otherwise start the sandbox alongside the
web app and the API — breaking the "not started by the frontend" requirement.
Keeping it a plain filtered pnpm script is what enforces the isolation.

`storybook build` exists so CI can typecheck and test the stories. Its output
(`storybook-static/`) must be `.gitignore`d and must never be deployed.

---

## 5. Component discovery and the registry

`apps/sandbox/src/registry.ts` is the searchable index — the thing "search the
sandbox" actually means:

```ts
export interface RegistryEntry {
  id: string; // 'C032'
  name: string; // 'VehicleCard'
  source: string; // 'apps/web/src/components/vehicle/vehicle-card.tsx'
  category: Category; // see §6
  ownership: Ownership; // Primitive | Shared | Feature-shared | …
  purpose: string; // one line
  aliases: string[]; // ['CarCard','ListingCard','DealerCard'] ← the D-6 fix
  features: string[]; // ['F075','F077','F084','F086','F087']
  props: string[];
  states: string[];
  reusable: boolean;
  storyId: string; // Storybook id, for deep links
}
```

`aliases` is the answer to finding **D-6**: `dealer-card.tsx` exports
`DirectoryCard`, so a search for "DealerCard" must still find it. Every entry
lists the names someone might plausibly reach for.

**Adding a component to the sandbox:**

```text
1. Create the component in apps/web/src/components/<category>/
2. Add a story file at apps/sandbox/src/stories/<category>/<name>.stories.tsx
3. Add a RegistryEntry (id, aliases, features, states)
4. Add a row to docs/project/component-map.md
5. pnpm sandbox — verify every state renders
6. pnpm --filter @dealers-drive/sandbox test — the play() assertions pass
```

Steps 3 and 4 are what keep the registry honest. A CI check can assert that
every `*.stories.tsx` has a registry entry and vice versa — cheap, and it stops
the registry rotting the way undocumented registries always do.

---

## 6. Categories

Derived from the **actual** directory structure and DESIGN-SPEC §2, not assumed:

```text
Component Sandbox

├── Primitives              (components/ui/ — DESIGN-SPEC §2)
│   ├── Button · ButtonLink
│   ├── Plate · StatusTag · Tag
│   ├── Avatar · LogoTile
│   ├── Banner
│   ├── SkeletonLines
│   └── ImageSlot
│
├── Layout                  (the structural frame)
│   ├── Blueprint · Corners
│   ├── StatCard
│   ├── EmptyState · ErrorState
│   └── Stepper
│
├── Forms                   (components/forms/)
│   ├── Field
│   ├── Combobox
│   └── PlateInput
│
├── Navigation              (components/{layout,admin,dealer,auth}/)
│   ├── CustomerHeader · CustomerFooter · CitySelector
│   ├── AdminNav
│   ├── ConsoleNav · ConsoleTabBar
│   └── AuthShell · AuthHeading · GoogleSignInButton
│
├── Search                  (components/search/)
│   ├── FilterPanel
│   ├── SearchToolbar
│   ├── MobileFilterSheet
│   ├── HeroSearch
│   └── DirectoryFilters
│
├── Vehicle                 (components/vehicle/)
│   ├── VehicleCard · VehicleImage · VehicleCardSkeleton
│   ├── VehicleGallery
│   └── VdpCtaStack · RevealContactButton
│
├── Dealer                  (components/dealers/ + features/dealer/)
│   ├── DirectoryCard
│   └── DealerProfileForm
│
├── Dealer console          (features/vehicle/, features/billing/, features/enquiries/)
│   ├── VehicleWizard · BasicsFields · DetailsFields
│   ├── RegistrationStep · RcSummary
│   ├── PhotoUploader
│   ├── InventoryActions
│   ├── CreditPacks
│   └── EnquiryInbox
│
├── Onboarding              (features/auth/)
│   ├── OnboardingWizard
│   ├── DocumentUploader
│   └── AdminLoginForm · SignOutButton
│
├── Public                  (features/{enquiry,saved,report}/)
│   ├── EnquiryForm
│   ├── SavedCarsList
│   └── ReportSummary
│
├── Admin                   (features/admin/ + features/report/)
│   ├── ReviewActions · QueueApproveButton
│   ├── DealerAdminActions
│   ├── ModerationStrip
│   ├── ConfigRow
│   └── ReportPanel
│
└── Missing — to be created (DESIGN-SPEC §2.3, §2.4, §2.7, §2.13, §2.14)
    ├── Input       — 70 raw call sites
    ├── Card        — 32 raw call sites
    ├── Table       —  5 raw call sites
    ├── Segmented   —  2 raw call sites
    └── Dialog      — .dialog CSS is dead; Radix used instead
```

The last group is deliberate. The sandbox's first measurable win is turning five
CSS classes into five registered, tested components.

---

## 7. Prop controls

Storybook infers controls from the TypeScript prop types via `react-docgen`, so
CVA-based components produce useful controls with almost no configuration:

```tsx
// apps/sandbox/src/stories/vehicle/vehicle-card.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { VehicleCard } from '@web/components/vehicle/vehicle-card';
import { vehicleCard } from '../../mocks/vehicle';
import { withSavedCars } from '../../decorators/saved-cars';

const meta = {
  title: 'Vehicle/VehicleCard',
  component: VehicleCard,
  decorators: [withSavedCars], // coupling C-1
  argTypes: {
    variant: { control: 'inline-radio', options: ['grid', 'compact', 'list'] },
    showSave: { control: 'boolean' },
  },
  args: { vehicle: vehicleCard(), variant: 'grid', showSave: true },
} satisfies Meta<typeof VehicleCard>;
export default meta;

export const Grid: StoryObj<typeof meta> = {};
export const Compact: StoryObj<typeof meta> = { args: { variant: 'compact' } };
export const List: StoryObj<typeof meta> = { args: { variant: 'list' } };
export const Sold: StoryObj<typeof meta> = {
  args: { vehicle: vehicleCard({ isSold: true, soldLabel: 'Sold in March' }) },
};
export const NoImage: StoryObj<typeof meta> = {
  args: { vehicle: vehicleCard({ primaryImage: null }) },
};
export const Unverified: StoryObj<typeof meta> = {
  args: { vehicle: vehicleCard({ dealer: { isVerified: false } }) },
};
export const LongTitle: StoryObj<typeof meta> = {
  args: {
    vehicle: vehicleCard({
      title: 'Maruti Suzuki Grand Vitara Alpha Plus Intelligent Hybrid eCVT',
    }),
  },
};
```

Rendering:

```text
VehicleCard                                     [ Grid ▾ ]

  variant     ( grid ) ( compact ) ( list )
  showSave    [✓]
  vehicle     { object — edit in the JSON panel }

  ── Scenarios ──────────────────────────────────
  Grid · Compact · List · Sold · NoImage
  Unverified · LongTitle
```

**Rules for controls:**

- Expose every prop the component actually declares. Never invent one.
- Every union prop becomes a `select` or `inline-radio` whose options come from
  the **type**, not a hand-written list — so adding a `StatusTone` makes the
  control grow automatically.
- Every boolean prop becomes a checkbox.
- Object props (`vehicle`, `dealer`, `facets`) get a mock-factory
  default plus named scenarios for the interesting shapes. Do not ask a person
  to hand-type a `VehicleCardDto` in a JSON control.
- Callback props (`onChange`, `onRefresh`, `onNavigate`) become Storybook
  actions so their firing is visible.

---

## 8. Mock data

**The rule: every fixture is parsed by the contract that defines it.**

`packages/contracts` exports Zod _schemas_, not just types. That is the strongest
asset this repo has for mock data — a fixture can be validated at author time:

```ts
// apps/sandbox/src/mocks/vehicle.ts
import { VehicleCard } from '@dealers-drive/contracts';

const BASE = {
  id: '7c3f2f1e-0000-4000-8000-000000000001',
  slug: '2021-maruti-swift-vxi-vellore',
  title: '2021 Maruti Suzuki Swift VXi',
  year: 2021,
  priceLabel: '₹6,45,000',
  emiLabel: '₹12,400/mo',
  kmLabel: '38,200 km',
  fuelLabel: 'Petrol',
  transmissionLabel: 'Manual',
  city: { slug: 'vellore', name: 'Vellore' },
  isSold: false,
  soldLabel: null,
  primaryImage: {
    url: '/mock/swift-640.webp',
    srcset: '/mock/swift-320.webp 320w, /mock/swift-640.webp 640w',
    alt: '2021 Maruti Suzuki Swift VXi — front three-quarter',
  },
  dealer: {
    slug: 'sri-balaji-cars',
    brandName: 'Sri Balaji Cars',
    initials: 'SB',
    isVerified: true,
  },
};

/** Parsed, not cast — a fixture that drifts from the contract fails here. */
export function vehicleCard(overrides: DeepPartial<typeof BASE> = {}) {
  return VehicleCard.parse(merge(BASE, overrides));
}
```

A `.parse()` rather than an `as VehicleCard` is the whole point: when the API
contract changes, the sandbox breaks loudly instead of showing a component
rendering data the API will never send.

**Sources of realistic values.** `apps/api/prisma/seed/catalog/*` at
`f05acdc` contains 41 makes and 344 models with real Indian-market names, prices
and variants. **Decision D1 removes that seed from the reconstruction**, so the
vocabulary must be lifted into `src/mocks/vocabulary.ts` as a static sandbox
fixture _before_ the catalogue is dropped — it is the only surviving record of
what real values look like, and it is exactly the kind of thing a sandbox should
own rather than a database. `apps/api/src/platform/rc/rc-aliases.ts` survives D1
untouched and is the other source: it is the committed VAHAN-maker → brand map,
so mock `RcSpecs.makerModel` strings should be drawn from its keys.

Mocks should draw from the same vocabulary — Tamil Nadu cities, `₹` formatting,
`TN 09 BX 1234` plates — so the sandbox looks like the product rather than like
`foo`/`bar`. Under D1 the mocks must also cover the _unnormalised_ shapes that
F060 now has to handle: `Maruti`, `Maruti Suzuki` and `MARUTI SUZUKI INDIA LTD`
as three separate values, and `SWIFT VXI` with model and trim run together.

**Images.** Committed WebP files under `apps/sandbox/public/mock/`, a handful at
most, plus `ImageSlot` for the no-image cases. Never a remote URL: the sandbox
must render with the network off.

**Network.** Components that `fetch()` (coupling **C-5**: `DocumentUploader`,
`PhotoUploader`, `SavedCarsList`) get MSW handlers under
`apps/sandbox/src/mocks/handlers.ts`. Components that call server actions
(coupling **C-4**) get module stubs via Vite aliases — the pattern already
proven in `apps/web/tests/setup.ts`.

**Decorators** (`apps/sandbox/src/decorators/`):

| Decorator            | Solves                                                      | Applies to                                                      |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- |
| `withSavedCars`      | C-1 (`useSavedCars` throws outside its provider)            | `VehicleCard`, `VdpCtaStack`, `CustomerHeader`, `SavedCarsList` |
| `withQueryClient`    | C-2 (`@tanstack/react-query`, retries off)                  | `EnquiryInbox`                                                  |
| `withRouter`         | C-3 — exposes `pathname` and `searchParams` as **controls** | the 17 components reading `next/navigation`                     |
| `withClearedStorage` | C-6 (`localStorage` leaking between scenarios)              | global                                                          |

`withRouter` deserves emphasis: making the pathname a control is what turns "is
the right nav item highlighted?" into something a person can check in two
seconds and a `play()` function can assert.

---

## 9. States to cover

Only states the component actually supports. From the audit, the states that
matter here:

| State                         | Components it genuinely applies to                                                                                                                                                                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| default                       | all                                                                                                                                                                                                              |
| loading / pending             | `Button`, `QueueApproveButton`, `ReviewActions`, `DealerAdminActions`, `CreditPacks`, `RevealContactButton`, `RegistrationStep`, `ConfigRow`, `InventoryActions`                                                 |
| empty                         | `EmptyState`, `SavedCarsList`, `EnquiryInbox`, `PhotoUploader`, `Combobox` (no matches), `VehicleGallery` (0 photos)                                                                                             |
| error                         | `ErrorState`, `Banner(err)`, `Field(error)`, `Combobox`, and every form                                                                                                                                          |
| disabled                      | `Button`, `Combobox`, `PlateInput`, `BasicsFields`, `DetailsFields`, `GoogleSignInButton`, `FilterPanel` zero-count rows, gallery arrows at either end                                                           |
| selected / active             | `FilterPanel`, `DirectoryFilters`, `ConsoleNav`, `AdminNav`, `ConsoleTabBar`, `Combobox`, `VehicleGallery` rail                                                                                                  |
| approved / rejected / pending | `StatusTag`, `ReviewActions`, `DealerAdminActions`, `DocumentUploader`, `ReportSummary`                                                                                                                          |
| sold                          | `VehicleCard` (both variants)                                                                                                                                                                                    |
| with / without image          | `VehicleCard`, `VehicleImage`, `DirectoryCard`, `VehicleGallery`                                                                                                                                                 |
| long text                     | `VehicleCard` title, `DirectoryCard` brand name, `StatCard` value, `EmptyState` message (`max-w-[46ch]`), `Combobox` option labels                                                                               |
| missing optional data         | `DirectoryCard` (no tagline, 0 services), `StatCard` (no delta), `Field` (no hint), `VehicleCard` (no `emiLabel`)                                                                                                |
| pre-hydration                 | `VehicleCard` save button, `CustomerHeader` badge, `SavedCarsList` — all read `hydrated` from `useSavedCars`                                                                                                     |
| mobile / tablet / desktop     | `MobileFilterSheet` (`lg:hidden`), `ConsoleTabBar` (`md:hidden`), `CustomerHeader` (nav is `hidden md:flex`), `VehicleCard` save button (44 px below 768, 30 px above), `VehicleGallery` strip (88 px below 375) |

Viewport presets should be **the breakpoints this codebase actually uses**, read
out of the class names: `375`, `768`, `1024`, `1280`. Not Storybook's defaults.

---

## 10. Feature integration

The sandbox is a gate in the feature workflow, not a side quest.

```text
Feature requirement
        ↓
Identify UI requirements
        ↓
Identify required components
        ↓
SEARCH THE SANDBOX  ─────────────────────────┐
  · registry.ts by name, alias and category  │  ← the D-6 / D-A fix
  · docs/project/component-map.md            │
  · the running sandbox at :6006             │
        ↓                                    │
┌───────────────────────────────┐            │
│ Does a suitable component     │            │
│ already exist?                │            │
└───────────────┬───────────────┘            │
        ┌───────┴────────┐                   │
       YES               NO                  │
        │                │                   │
        ↓                ↓                   │
  Can props/variants   Create component      │
  satisfy it?            ↓                   │
   ┌────┴─────┐        Add story             │
  YES         NO         ↓                   │
   │           │       Define props          │
   ↓           ↓         ↓                   │
 REUSE     MODIFY      Define states         │
 as-is     shared        ↓                   │
   │       component   Add RegistryEntry ────┤
   │           │         ↓                   │
   │      Document:    Update component-map ─┘
   │      · consumers
   │      · existing scenarios
   │      · new props
   │      · back-compat
   │      · affected features
   │      · tests to update
   │           │
   └─────┬─────┘
         ↓
  Implement feature
         ↓
  Component tests  (play() functions in the sandbox)
         ↓
  Feature tests
         ↓
  Sandbox verification — every state renders
         ↓
  Screenshots for the PR
         ↓
  Feature PR → HUMAN REVIEW → merge
```

**Worked precedent, from this repository.** F086 (dealer portfolio) needed a
filter panel without a dealer group. It did **not** create
`PortfolioFilterPanel`. It added `groups` and `dimZeroRows` to the existing
`FilterPanel` — and the code comment explains why. That is the target behaviour,
and it happened without a sandbox. The sandbox exists to make it the default
rather than the exception, because the same repository produced **five separate
hand-rolled `.table` implementations** when discovery was hard.

**Every feature's PR description must carry its sandbox table:**

```text
F0XX — <name>

Component            Sandbox        Status     Props        States  Tests
-------------------------------------------------------------------------
Button               Primitives/    Reused     —            —       ✅
Field                Forms/         Reused     —            —       ✅
Combobox             Forms/         Modified   +groupBy     9       ✅
ImageUploader        Vehicle/       New        7            8       ✅
```

---

## 11. Isolation

| Requirement                       | How it is met                                                                                                                      | Enforced by                                                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Runs only locally                 | Storybook dev server bound to localhost; never in a Dockerfile or workflow                                                         | absence from `deploy/`, `.github/workflows/{release,promote,_deploy}.yml`                                                                     |
| Different port                    | 6006 — verified unused across the repo                                                                                             | `storybook dev -p 6006`                                                                                                                       |
| Separate process                  | its own foreground process                                                                                                         | started only by `pnpm sandbox`                                                                                                                |
| Own dev command                   | `pnpm sandbox`                                                                                                                     | root `package.json`                                                                                                                           |
| Not required for the frontend     | web imports nothing from `apps/sandbox`                                                                                            | dependency direction: sandbox → web, never back. Add an ESLint `no-restricted-imports` rule in `apps/web` forbidding `@dealers-drive/sandbox` |
| Not required for the API          | API is Node/Express and shares no code with the web app                                                                            | —                                                                                                                                             |
| Not started by API or frontend    | **not registered in `turbo.json`** — this is the load-bearing detail; `pnpm dev` runs `turbo run dev` and would otherwise start it | `turbo.json`                                                                                                                                  |
| Does not affect production builds | stories live outside `apps/web`, so `next build`'s typecheck never sees them                                                       | separate `tsconfig.json`                                                                                                                      |
| Not deployed                      | `apps/{api,web}/Dockerfile` copy only their own app; `deploy/terraform` defines two ECS services                                   | —                                                                                                                                             |
| Not exposed publicly              | `deploy/nginx/dealers-drive.conf` and the ALB route 3000 and 4000 only                                                             | —                                                                                                                                             |
| No production database            | fixtures only; MSW intercepts every request                                                                                        | §8                                                                                                                                            |
| No production env vars            | no `.env` read; `PORT`/`API_BASE_URL` unused                                                                                       | §8                                                                                                                                            |
| Mock/static data                  | contract-parsed fixtures                                                                                                           | §8                                                                                                                                            |
| Components testable independently | `@storybook/addon-vitest` runs stories as jsdom component tests                                                                    | §2                                                                                                                                            |

```text
LOCAL MACHINE

┌──────────────────────────────────────┐   ┌──────────────────────────────┐
│ Main application (pnpm dev)          │   │ UI Component Sandbox         │
│                                      │   │ (pnpm sandbox)               │
│  Web      :3000  ──┐                 │   │                              │
│  API      :4000  ──┼─→ Postgres :5432│   │  Storybook :6006             │
│  MinIO    :9000    │                 │   │  fixtures only               │
│  Mailpit  :1025    │                 │   │  MSW intercepts fetch        │
└────────────────────┴─────────────────┘   │  no DB · no API · no env     │
                                           └──────────────────────────────┘
        turbo run dev                          plain pnpm --filter
        (sandbox NOT registered)               (never in turbo dev)

              ── no arrow between these two boxes, by design ──
```

**One caveat to verify on first CI run.** Adding `apps/sandbox` changes
`pnpm-lock.yaml`. Both Dockerfiles run `pnpm install --frozen-lockfile` after
copying only a subset of workspace manifests. Today that works with
`apps/api/package.json` absent from the web build, which is good evidence it
will keep working — but the first CI run after the sandbox lands must be
watched, and the fix if needed is one extra `COPY apps/sandbox/package.json`
line, not a design change.

---

## 12. Build order

Bottom-up, following the dependency graph in `component-map.md`. Each step is
its own PR.

| Step   | Contents                                                                                             | Why here                                                                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S0** | `apps/sandbox` skeleton, `globals.css` wired, one `Button` story, `pnpm sandbox` working             | Proves the Tailwind v4 + `@theme` token pipeline renders identically outside Next                                                                                                                                                                                                     |
| **S1** | All 16 primitives + `Field`                                                                          | Zero decorators needed; immediate value; establishes scenario conventions                                                                                                                                                                                                             |
| **S2** | Decorators (`withSavedCars`, `withRouter`, `withQueryClient`, `withClearedStorage`) + mock factories | Unblocks everything above the primitives                                                                                                                                                                                                                                              |
| **S3** | `Combobox`, `PlateInput`, `VehicleCard`, `DirectoryCard`                                             | The four highest-traffic non-primitives. `Combobox`'s justification (344 models) is weakened by **D1** — build the story anyway: it is the place where the "keep it or replace it with a plain `Input` + suggestions" decision at F060 gets made visually rather than in the abstract |
| **S4** | `VehicleGallery`, `MobileFilterSheet`, `FilterPanel`                                                 | The three hardest interactions — where `play()` earns its keep                                                                                                                                                                                                                        |
| **S5** | `@storybook/addon-vitest` wired; stories run as component tests in CI                                | Turns the sandbox from a viewer into a harness                                                                                                                                                                                                                                        |
| **S6** | The five missing primitives — `Input`, `Card`, `Table`, `Segmented`, `Dialog`                        | Each enters the codebase _with_ a sandbox entry, closing D-B                                                                                                                                                                                                                          |
| **S7** | Feature components, in feature-dependency order                                                      | Follows the reconstructed history                                                                                                                                                                                                                                                     |

S0–S2 is roughly the point at which the sandbox starts paying for itself.
Everything after S5 is coverage.
