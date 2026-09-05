# Component Map

Every exported React component in `apps/web/src`, audited at `f05acdc`.
**65 components across 36 files.** Nothing was modified to produce this.

> This document describes the code **as it exists today**, so it still records
> the `catalog: CatalogBundle` prop on `VehicleWizard`, `RegistrationStep`,
> `BasicsStep`, `BasicsFields` and `DetailsFields`, and `Combobox`'s
> 344-model justification. **Decision D1 removes the seeded catalogue**
> (`feature-map.md` §D1). Five components change shape as a result — see the
> D1 impact table below — so do not build a sandbox story against `catalog`
> without reading that entry first. F-numbers throughout are the post-D2
> 97-feature scheme.

## Ownership vocabulary

| Ownership            | Meaning                                                            | Where it lives        |
| -------------------- | ------------------------------------------------------------------ | --------------------- |
| **Primitive**        | Knows nothing about the domain. Promotable to `packages/ui` as-is. | `components/ui/`      |
| **Shared**           | Used by three or more features.                                    | `components/`         |
| **Feature-shared**   | Used by two features that are not the same feature.                | `components/`         |
| **Feature-specific** | One feature. Not reusable without changes.                         | `features/`           |
| **Page-specific**    | Rendered by exactly one route.                                     | `features/` or inline |
| **Legacy**           | Exists but nothing imports it.                                     | —                     |
| **Unclear**          | Ownership is a judgement call.                                     | —                     |

## Sandbox priority

| Priority | Rule                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| **P0**   | Reused by 3+ features, or has 4+ visual states, and has no test. Build first. |
| **P1**   | Reused by 2 features, or has non-trivial interaction.                         |
| **P2**   | Single-consumer, low state count.                                             |
| **P3**   | Static or trivial; a sandbox entry is documentation, not verification.        |

---

## Layer 1 — Primitives (`components/ui/`)

These import nothing from `features/`, nothing from the API, and only one type
(`StatusTone`) from contracts. **All 16 render in the sandbox with zero
decorators.** They are the correct first slice of sandbox work.

### C001 — `Button`

|                      |                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/ui/button.tsx:52`                                                                                                                             |
| **Purpose**          | The single button component. Wraps the `.btn` CSS layer through CVA.                                                                                                   |
| **Props**            | `variant`, `size`, `block`, `loading`, `disabled`, `className`, plus all `ButtonHTMLAttributes`                                                                        |
| **Prop types**       | `variant: 'primary' \| 'secondary' \| 'ghost' \| 'destructive' \| 'danger'`; `size: 'default' \| 'sm' \| 'md' \| 'lg' \| 'hero'`; `block: boolean`; `loading: boolean` |
| **Defaults**         | `variant='secondary'`, `size='default'`, `block=false`, `loading=false`                                                                                                |
| **Variants**         | 5 × 5 sizes × block = **50 combinations**                                                                                                                              |
| **States**           | default, hover, active, focus-visible, disabled, loading (`aria-busy`, keeps width, swaps label for `Spinner`)                                                         |
| **Dependencies**     | `cva`, `cn`, `next/link` (for `ButtonLink`)                                                                                                                            |
| **Consumers**        | **13 files import it; 29 `<Button>` JSX usages** — against 88 raw `className="btn …"` sites                                                                            |
| **Features**         | F018 onward (nearly all)                                                                                                                                               |
| **Tests**            | ✅ `apps/web/tests/unit/components/ui/button.test.tsx` — the only component test in the repo                                                                           |
| **Ownership**        | Primitive                                                                                                                                                              |
| **Reusable?**        | Yes                                                                                                                                                                    |
| **Sandbox priority** | **P0** — the reference entry; every other scenario copies its shape                                                                                                    |
| **Confidence**       | HIGH                                                                                                                                                                   |

### C002 — `ButtonLink`

|                      |                                                             |
| -------------------- | ----------------------------------------------------------- |
| **Location**         | `apps/web/src/components/ui/button.tsx:76`                  |
| **Purpose**          | A `next/link` styled as a button.                           |
| **Props**            | `href`, `variant`, `size`, `block`, `className`, `children` |
| **Consumers**        | **none**                                                    |
| **Ownership**        | **Legacy**                                                  |
| **Sandbox priority** | P1 — _the sandbox is how this gets found and used_          |
| **Confidence**       | HIGH                                                        |

> ⚠️ **Finding D-1.** `ButtonLink` is exported and never imported. Meanwhile
> `<Link className="btn btn-primary …">` is hand-written across the app. See the
> duplication register below.

### C003 — `Blueprint` · C004 — `Corners`

|                      |                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/primitives.tsx:26`, `:38`                                                                                                                  |
| **Purpose**          | The signature frame with four registration marks. `Corners` exists separately for the one case the frame must be a `<button>` (the gallery's main image). |
| **Props**            | `Blueprint`: `as?: 'div' \| 'section' \| 'article'`, `className`, `children`, all `HTMLAttributes`. `Corners`: none                                       |
| **Defaults**         | `as='div'`                                                                                                                                                |
| **States**           | one; the visual variation comes from the background the caller applies                                                                                    |
| **Consumers**        | `Blueprint` 11 files, `Corners` 1 file                                                                                                                    |
| **Tests**            | none                                                                                                                                                      |
| **Ownership**        | Primitive                                                                                                                                                 |
| **Sandbox priority** | **P0** — DESIGN-SPEC §4.4 names "a `.blueprint` missing a corner" as the one defect it calls out by name. A sandbox entry is how that stays true.         |
| **Confidence**       | HIGH                                                                                                                                                      |

### C005 — `Plate`

|                      |                                                                                          |
| -------------------- | ---------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/primitives.tsx:68`                                                        |
| **Purpose**          | The registration-plate motif — the product's signature element.                          |
| **Props**            | `size`, `className`, `children`, all `HTMLAttributes<HTMLSpanElement>`                   |
| **Prop types**       | `size: 'year' \| 'logo' \| 'chip' \| 'marker'`                                           |
| **Defaults**         | `size='year'`                                                                            |
| **Variants**         | 4 — and DESIGN-SPEC §4.5 says the plate appears in **exactly four places**, one per size |
| **States**           | one; never interactive                                                                   |
| **Consumers**        | 10 files                                                                                 |
| **Features**         | F047 & F073 (`logo`), F035 (`marker`), F075 (`year`), F085 (`chip`)                      |
| **Tests**            | none                                                                                     |
| **Ownership**        | Primitive                                                                                |
| **Sandbox priority** | **P0** — four variants, a spec rule about where each is allowed, zero tests              |
| **Confidence**       | HIGH                                                                                     |

### C006 — `StatusTag` · C007 — `Tag`

|                      |                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/primitives.tsx:94`, `:110`                                                                                                                                             |
| **Purpose**          | `StatusTag` renders a domain status with an accessible tone; `Tag` is the decorative sibling.                                                                                         |
| **Props**            | `StatusTag`: `tone: StatusTone`, `children`, `className`. `Tag`: `variant: 'neutral' \| 'accent' \| 'outline'`, `children`, `className`                                               |
| **Prop types**       | `StatusTone = 'ok' \| 'warn' \| 'err' \| 'neutral' \| 'accent'` (from contracts)                                                                                                      |
| **Defaults**         | `Tag.variant='neutral'`                                                                                                                                                               |
| **Variants**         | 5 tones + 3 tag variants                                                                                                                                                              |
| **States**           | one each                                                                                                                                                                              |
| **Consumers**        | `StatusTag` 16 files, `Tag` 9 files                                                                                                                                                   |
| **Tests**            | none                                                                                                                                                                                  |
| **Ownership**        | Primitive                                                                                                                                                                             |
| **Sandbox priority** | **P0** for `StatusTag` — DESIGN-SPEC §4.15: _status is never conveyed by colour alone_. Scenarios generated from the `StatusTone` enum make a new tone show up as a missing scenario. |
| **Confidence**       | HIGH                                                                                                                                                                                  |

> ⚠️ **Finding D-2.** `.tag-draft`, `.tag-expired` and `.tag-sold` exist in
> `globals.css` but no React prop reaches them. They are applied by hand or not
> at all. `StatusTag`'s `tone` union does not cover them.

### C008 — `Avatar` · C009 — `LogoTile`

|                      |                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/primitives.tsx:127`, `:151`                                                                                 |
| **Purpose**          | Square monogram tiles. `border-radius: 50%` appears nowhere in this product (DESIGN-SPEC §4.3).                            |
| **Props**            | both: `initials: string`, `size?: number`, `className?: string`                                                            |
| **Defaults**         | `Avatar.size=20`, `LogoTile.size=42`                                                                                       |
| **States**           | one each; font size is derived from `size`                                                                                 |
| **Consumers**        | `Avatar` 3 files, `LogoTile` 5 files                                                                                       |
| **Tests**            | none                                                                                                                       |
| **Ownership**        | Primitive                                                                                                                  |
| **Sandbox priority** | P1 — worth a scenario at 20/22/42/44 px and with 1-, 2- and 3-letter initials, which is where the derived font size breaks |
| **Confidence**       | HIGH                                                                                                                       |

### C010 — `StatCard`

|                      |                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/primitives.tsx:175`                                                                    |
| **Props**            | `label: string`, `value: string`, `delta?: string`, `deltaTone?: StatusTone`, `className?`            |
| **Defaults**         | `deltaTone='neutral'`                                                                                 |
| **Variants**         | 5 delta tones × delta present/absent = 10                                                             |
| **Consumers**        | **1 file** — `dealer/page.tsx`. The billing page renders the same stat block from raw markup instead. |
| **Tests**            | none                                                                                                  |
| **Ownership**        | Primitive                                                                                             |
| **Sandbox priority** | P1 — long values overflow the 34 px tabular figure; a scenario is the only way that gets seen         |
| **Confidence**       | HIGH                                                                                                  |

### C011 — `EmptyState` · C012 — `ErrorState`

|                      |                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/primitives.tsx:207`, `:229`                                                                                                            |
| **Purpose**          | DESIGN-SPEC §2.20 — every list has one: a blueprint shell, one sentence, one recovery action.                                                         |
| **Props**            | `EmptyState`: `title`, `message`, `action?: ReactNode`, `className?`. `ErrorState`: `title?` (default `'Something went wrong'`), `message`, `action?` |
| **Variants**         | action present / absent                                                                                                                               |
| **Consumers**        | `EmptyState` 11 files, `ErrorState` 5 files                                                                                                           |
| **Tests**            | none                                                                                                                                                  |
| **Ownership**        | Primitive                                                                                                                                             |
| **Sandbox priority** | P1 — the `max-w-[46ch]` clamp needs a long-message scenario                                                                                           |
| **Confidence**       | HIGH                                                                                                                                                  |

### C013 — `SkeletonLines`

`components/ui/primitives.tsx:250`. Props: `className?`. Static bars at the
widths §2.20 specifies, no shimmer. 2 consumers. No tests. Primitive. **P3.**

### C014 — `Banner`

|                      |                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ |
| **Location**         | `components/ui/primitives.tsx:263`                                                         |
| **Purpose**          | DESIGN-SPEC §2.15 — cleared on navigation, never auto-dismissed.                           |
| **Props**            | `tone: 'ok' \| 'warn' \| 'err'`, `title?`, `children?`, `action?: ReactNode`, `className?` |
| **Variants**         | 3 tones × title? × children? × action? = **24 combinations**                               |
| **Consumers**        | **22 files — the most-imported component in the product**                                  |
| **Tests**            | none                                                                                       |
| **Ownership**        | Primitive                                                                                  |
| **Sandbox priority** | **P0**                                                                                     |
| **Confidence**       | HIGH                                                                                       |

> ⚠️ **Finding D-3.** `Banner.tone` is `'ok' \| 'warn' \| 'err'` — a _different_
> union from `StatusTone` (`'ok' \| 'warn' \| 'err' \| 'neutral' \| 'accent'`).
> Two overlapping tone vocabularies. Do not merge them in this phase; the
> sandbox is where the divergence becomes visible.

### C015 — `Stepper`

`components/ui/primitives.tsx:296`. Props: `steps: readonly string[]`,
`current: number`, `className?`. Shared by F037 (onboarding, 4 steps) and F063
(vehicle wizard, 4 steps).
No tests. Primitive. **P1** — needs a scenario per position and a
`current` out-of-range scenario, which currently renders every bar filled. 4 consumers.

### C016 — `ImageSlot`

`components/ui/primitives.tsx:329`. Props: `label: string`, `className?`. The
placeholder panel with `role="img"`. 7 consumers. No tests. Primitive. **P2** —
one short-label and one long-label scenario.

### C066 — `Table` · C067 — `NumericCell`

|                      |                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/table.tsx:49`, `:92`                                                                                                                                                                           |
| **Purpose**          | DESIGN-SPEC §2.13. **New at F045** — the first of the five hand-rolled `.table` sites in finding D-B, created rather than copied.                                                                             |
| **Props**            | `Table`: `columns: TableColumn[]`, `caption?`, `containerClassName?`, `children`, plus every `<table>` attribute. `NumericCell`: every `<td>` attribute.                                                      |
| **States**           | many rows, single row (no dangling rule), overflowing, no rows                                                                                                                                                |
| **Consumers**        | 1 (`admin/dealers`) — the other four arrive at F054, F066, F069 and F072                                                                                                                                      |
| **Tests**            | none — the sandbox scenarios are the check                                                                                                                                                                    |
| **Ownership**        | Primitive                                                                                                                                                                                                     |
| **Sandbox priority** | **P0** — the **Overflow** scenario is the point: the scroll container is inside the component so a caller cannot forget it, and a sideways-scrolling page is invisible on the desktop the console is built on |
| **Confidence**       | HIGH                                                                                                                                                                                                          |

---

## Layer 2 — Forms (`components/forms/`)

### C017 — `Field`

|                      |                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/forms/field.tsx:11`                                                                                                                |
| **Purpose**          | DESIGN-SPEC §2.3 label/control/error wrapper. Also exports `errorId()` and `invalidProps()` so callers wire `aria-describedby` without a second convention. |
| **Props**            | `id: string`, `label: string`, `hint?`, `error?`, `children: ReactNode`, `className?`                                                                       |
| **Variants**         | hint? × error? = 4                                                                                                                                          |
| **Consumers**        | 10 files                                                                                                                                                    |
| **Tests**            | none (its helpers are exercised indirectly)                                                                                                                 |
| **Ownership**        | Shared                                                                                                                                                      |
| **Sandbox priority** | **P0** — it is the accessibility contract for every form in the product                                                                                     |
| **Confidence**       | HIGH                                                                                                                                                        |

### C018 — `Combobox`

|                      |                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Location**         | `apps/web/src/components/forms/combobox.tsx:44`                                                                                                                                                                                            |
| **Purpose**          | Type-to-filter select for the 344-model catalogue. Hand-rolled to the WAI-ARIA combobox pattern; Radix has no combobox primitive.                                                                                                          |
| **Props**            | `id`, `label`, `name?`, `options: ComboboxOption[]`, `value`, `onChange`, `placeholder?`, `emptyLabel?`, `disabled?`, `disabledLabel?`, `required?`, `error?`, `hint?`                                                                     |
| **Prop types**       | `ComboboxOption = { value: string; label: string; hint?: string; keywords?: string }`                                                                                                                                                      |
| **Defaults**         | `emptyLabel='No matches.'`, `disabled=false`, `required=false`                                                                                                                                                                             |
| **States**           | closed, open, filtering, no-matches, option-active (mouse), option-active (keyboard), selected, disabled-with-`disabledLabel`, error                                                                                                       |
| **Dependencies**     | `Field`, `invalidProps`, `cn`                                                                                                                                                                                                              |
| **Consumers**        | 2 files (`BasicsFields`, `DetailsFields`)                                                                                                                                                                                                  |
| **Tests**            | none                                                                                                                                                                                                                                       |
| **Ownership**        | Shared                                                                                                                                                                                                                                     |
| **Sandbox priority** | **P0** — 9 states, full keyboard contract (↑↓/Enter/Esc/Tab), a focus-trap-adjacent outside-click handler, `aria-activedescendant`, a live result count, and **zero tests**. The single highest-risk untested component in the repository. |
| **Confidence**       | HIGH                                                                                                                                                                                                                                       |

### C019 — `PlateInput`

|                      |                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/forms/plate-input.tsx:26`                                                            |
| **Purpose**          | The number-plate field. Accepts `TN 09 BX 1234`, `TN-09-BX-1234` and `tn09bx1234`; normalises on the way out. |
| **Props**            | `value: string`, `onChange: (next: string) => void`, `error?: string \| undefined`, `disabled?`, `autoFocus?` |
| **Defaults**         | `disabled=false`, `autoFocus=false`                                                                           |
| **Also exports**     | `validatePlate(raw)`, `normalisePlate(raw)`                                                                   |
| **Dependencies**     | `Field`, `REGISTRATION_NUMBER` from contracts                                                                 |
| **Consumers**        | 1 (`RegistrationStep`)                                                                                        |
| **Tests**            | ✅ `apps/web/tests/unit/features/vehicle/plate-input.test.ts` (logic only, not render)                        |
| **Ownership**        | Shared                                                                                                        |
| **Sandbox priority** | P1                                                                                                            |
| **Confidence**       | HIGH                                                                                                          |

> ✅ **This is the model component.** Pure props, no context, validation
> exported and tested separately, a comment explaining _why_ it is a component
> rather than an `<input pattern>`, and the schema imported from contracts so
> browser and server agree by construction. Every new component should look
> like this. Use it as the sandbox's worked example.

---

## Layer 3 — Layout & navigation

| ID   | Component            | Location                                   | Props                                | States                                                | Consumers | Ownership | Priority |
| ---- | -------------------- | ------------------------------------------ | ------------------------------------ | ----------------------------------------------------- | --------- | --------- | -------- |
| C020 | `CustomerHeader`     | `components/layout/customer-header.tsx:18` | `cities: CitiesResponse`             | 3 nav-active states × saved-count 0/n × pre-hydration | 1 layout  | Shared    | **P0**   |
| C021 | `CustomerFooter`     | `components/layout/customer-footer.tsx:9`  | none                                 | 1                                                     | 1 layout  | Shared    | P3       |
| C022 | `AuthShell`          | `components/auth/auth-shell.tsx:19`        | `eyebrow?`, `children`, `className?` | 1                                                     | 3 pages   | Shared    | P2       |
| C023 | `AuthHeading`        | `components/auth/auth-shell.tsx:44`        | `title`, `children?`                 | subtitle present/absent                               | 3 pages   | Shared    | P3       |
| C024 | `AdminNav`           | `components/admin/admin-nav.tsx:23`        | none — reads `usePathname()`         | 1 per admin route                                     | 1 layout  | Shared    | P2       |
| C025 | `ConsoleNav`         | `components/dealer/console-nav.tsx:38`     | `items: NavItem[]`                   | 1 per route active                                    | 1 layout  | Shared    | P2       |
| C026 | `ConsoleTabBar`      | `components/dealer/console-nav.tsx:58`     | `items: NavItem[]`                   | 1 per tab active; mobile-only (`md:hidden`)           | 1 layout  | Shared    | **P1**   |
| C039 | `GoogleSignInButton` | `components/auth/google-button.tsx:16`     | `href`, `label?`, `disabled?`        | default, disabled                                     | 1 page    | Shared    | P2       |

**Coupling note.** `CustomerHeader` (C020), `AdminNav` (C024), `ConsoleNav`
(C025) and `ConsoleTabBar` (C026) all call `usePathname()`. In the sandbox each
needs the router stubbed and the pathname settable _as a control_ — which is
exactly what makes "which nav item is active" testable for the first time.

---

## Layer 4 — Search (`components/search/`)

### C027 — `FilterPanel`

|                      |                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/search/filter-panel.tsx:45`                                                                                                                    |
| **Purpose**          | DESIGN-SPEC §3.3 — faceted filters that write to the **URL**, not to a store, so every filter state is server-renderable, shareable and indexable.                      |
| **Props**            | `facets: FacetsResponse`, `params: Record<string,string>`, `basePath: string`, `dimZeroRows?: boolean`, `groups?: readonly FilterGroupKey[]`, `onNavigate?: () => void` |
| **Prop types**       | `FilterGroupKey = 'fuel' \| 'bodyType' \| 'transmission' \| 'dealer'`                                                                                                   |
| **Defaults**         | `dimZeroRows=false`, `groups=ALL_GROUPS`                                                                                                                                |
| **States**           | nothing selected, one group selected, multiple groups, zero-count options (rendered **disabled, never hidden** — §11.2), price range active, portfolio subset           |
| **Dependencies**     | `next/navigation`, `lib/url`                                                                                                                                            |
| **Consumers**        | `cars/page.tsx`, `dealers/[slug]/page.tsx`, `SearchToolbar`                                                                                                             |
| **Features**         | F078, F086                                                                                                                                                              |
| **Tests**            | none (its `lib/url` helpers are tested)                                                                                                                                 |
| **Ownership**        | **Feature-shared**                                                                                                                                                      |
| **Sandbox priority** | **P0**                                                                                                                                                                  |
| **Confidence**       | HIGH                                                                                                                                                                    |

> ✅ **The canonical "existing component + props" success case.** F086 (dealer
> portfolio) needed a
> filter panel without a dealer group. Rather than a `PortfolioFilterPanel`
> duplicate, it added `groups` and `dimZeroRows`. That is exactly the outcome
> the reuse rule is written to produce, and this entry is the precedent to cite.

### C028 — `SearchToolbar` · C029 — `MobileFilterSheet`

Both in `components/search/search-toolbar.tsx` (`:11`, `:82`).

- `SearchToolbar` — `params`, `basePath`, `showSearch?` (default `true`). Free-text field + sort `<select>`, both writing to the URL. Consumers: 2. **P1.**
- `MobileFilterSheet` — `facets`, `params`, `basePath`, `resultCount`, `groups?`, `dimZeroRows?`. Bottom sheet; body-scroll lock, Escape-to-close, sticky CTA with a live count. Consumers: 2. **P0** — it is the only mobile-specific component in the product and there is no way to see it today without resizing a real browser against a real API.

### C030 — `HeroSearch`

`components/search/hero-search.tsx:13`. Props: `cityName: string`,
`citySlug?: string`. One consumer (homepage). **P2.**

### C031 — `DirectoryFilters`

`components/dealers/directory-filters.tsx:16`. Props:
`cities: DealerDirectoryResponse['cities']`, `city?`, `q?`. One consumer. **P2.**

---

## Layer 5 — Vehicle (`components/vehicle/`)

### C032 — `VehicleCard`

|                      |                                                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/vehicle/vehicle-card.tsx:20`                                                                                                                                              |
| **Purpose**          | DESIGN-SPEC §2.8. The product's most important component: 4:3 image, year plate, save button, title, tabular price, meta row, and — without exception — the **dealer strip** below a 1 px divider. |
| **Props**            | `vehicle: VehicleCardDto`, `variant?: 'grid' \| 'compact' \| 'list'`, `showSave?: boolean`                                                                                                         |
| **Defaults**         | `variant='grid'`, `showSave=true`                                                                                                                                                                  |
| **Variants**         | 3 (`list` delegates to an internal `VehicleRow`)                                                                                                                                                   |
| **States**           | default, sold (grayscale veil + badge + no link + no save + no enquire), saved, unsaved, pre-hydration, with image, without image (`ImageSlot`), verified dealer, unverified dealer, long title    |
| **Dependencies**     | `Avatar`, `ImageSlot`, `Plate`, `Tag`, **`useSavedCars`**, `next/link`                                                                                                                             |
| **Consumers**        | 5 files                                                                                                                                                                                            |
| **Features**         | F075, F077, F084, F086, F087                                                                                                                                                                       |
| **Tests**            | **none**                                                                                                                                                                                           |
| **Ownership**        | **Feature-shared**                                                                                                                                                                                 |
| **Reusable?**        | Yes — but see coupling C-1                                                                                                                                                                         |
| **Sandbox priority** | **P0 — the single highest-value entry in the whole sandbox**                                                                                                                                       |
| **Confidence**       | HIGH                                                                                                                                                                                               |

At least **3 variants × 2 sold × 2 saved × 2 image × 2 verified = 48 states**,
none of which any test or tool can currently exercise.

### C033 — `VehicleImage` · C034 — `VehicleCardSkeleton`

Same file, `:196` and `:243`. `VehicleImage` takes
`vehicle: Pick<VehicleCardDto,'primaryImage'|'title'|'year'>` and `sizes: string`;
falls back to `ImageSlot` when there is no image. `VehicleCardSkeleton` takes no
props. Both **P2**.

### C035 — `VehicleGallery`

|                      |                                                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Location**         | `apps/web/src/components/vehicle/gallery.tsx:20`                                                                                                                                                                   |
| **Purpose**          | DESIGN-SPEC §2.9/§2.10 — the strip and the fullscreen lightbox.                                                                                                                                                    |
| **Props**            | `photos: VehiclePhoto[]`, `title: string`, `photoCountLabel: string`                                                                                                                                               |
| **Internal parts**   | `Strip` (±240 px scroll, arrows disable at both ends), `Lightbox` (Esc, ←/→ with wrap, **focus trap**, focus returns to the exact opener, body-scroll lock, active rail cell scrolls itself centred), `PhotoImage` |
| **States**           | 0 photos, 1 photo (no strip), 2+ photos, strip at start / middle / end, lightbox open at index n, lightbox first / last (wrap)                                                                                     |
| **Consumers**        | 1 (`car/[slug]/page.tsx`)                                                                                                                                                                                          |
| **Tests**            | **none**                                                                                                                                                                                                           |
| **Ownership**        | Feature-specific — but the most complex component in the product                                                                                                                                                   |
| **Sandbox priority** | **P0**                                                                                                                                                                                                             |
| **Confidence**       | HIGH                                                                                                                                                                                                               |

> ⚠️ **Finding D-4.** `apps/web/vitest.config.ts` documents choosing jsdom over
> happy-dom _specifically so this component's focus management, keyboard
> handling and `scrollIntoView` could be asserted on_. That test was never
> written. The infrastructure decision was made and the payoff never taken.

### C036 — `VdpCtaStack` · C037 — `RevealContactButton`

|                      |                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/vehicle/vdp-cta.tsx:22`, `:59`                                                                                                                       |
| **Props**            | `VdpCtaStack`: `vehicleId`, `dealerBrandName`, `formId`. `RevealContactButton`: `vehicleId`, `dealerBrandName`, `className?`, `label?` (default `'Call dealer'`) |
| **States**           | idle, pending, revealed (phone + WhatsApp links), captcha (warn banner), error (err banner)                                                                      |
| **Dependencies**     | `Button`, `Banner`, **`revealContactAction`** (server action), **`useSavedCars`**                                                                                |
| **Consumers**        | 2 (`car/[slug]`, `dealers/[slug]`)                                                                                                                               |
| **Tests**            | none for the component; ✅ `apps/web/tests/unit/features/enquiry/actions.test.ts` for the action                                                                 |
| **Ownership**        | Feature-shared                                                                                                                                                   |
| **Sandbox priority** | **P1**                                                                                                                                                           |
| **Confidence**       | HIGH                                                                                                                                                             |

> ⚠️ **Finding D-5 — the one isolation break in `components/`.**
> `vdp-cta.tsx` is the **only** file under `components/` that imports a server
> action. Everything else in that directory is pure. Rendering it in the sandbox
> requires stubbing `@/features/enquiry/actions`. Worth knowing before the
> reuse rule is applied to it; do not "fix" it in this phase.

### C038 — `DirectoryCard`

`components/dealers/dealer-card.tsx:14`. Props: `dealer: DealerCardDto`.
States: verified/unverified, cover/no cover, tagline/none, 0–3+ services (sliced
at 3), long brand name. Deps: `Blueprint`, `ImageSlot`, `LogoTile`, `Plate`,
`Tag`. One consumer. No tests. Feature-specific. **P1.**

> ⚠️ **Finding D-6 — naming.** The file is `dealer-card.tsx`; the export is
> `DirectoryCard`. Nothing named `DealerCard` exists in the UI — `DealerCard` is
> a _contracts DTO type_. A component search for "DealerCard" today returns a
> type, not a component. This is precisely the discovery failure the sandbox
> registry is meant to remove.

---

## Layer 6 — Feature components (`features/`)

Compressed to one row each. All are `'use client'` unless noted, all are
`features/`-owned, and — with the exceptions marked ✅ — **none has a test.**

| ID    | Component                            | Location                                    | Key props                                                                                                   | States                                                                                                               | Feature   | Priority                                  |
| ----- | ------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------- |
| C040  | `OnboardingWizard`                   | `features/auth/onboarding-wizard.tsx:57`    | `step`, `session`, `documents`, `dealer`, `completeness`, `yardPhoto` — ⚠️ `cities` removed by **D6**       | 4 steps × valid/invalid/submitting, name-taken                                                                       | F037–F043 | **P0** ✅                                 |
| C041  | `DocumentUploader`                   | `features/auth/document-uploader.tsx:48`    | `document: DealerDocumentDto`                                                                               | empty, uploading, deleting, uploaded, verified, rejected, >5 MB, wrong MIME                                          | F041      | **P0** ✅                                 |
| C041b | `YardPhotoUploader`                  | `features/auth/yard-photo-uploader.tsx:28`  | `photo: YardPhotoDto`                                                                                       | empty, uploaded, uploading, deleting, error                                                                          | F041      | **P0** ✅                                 |
| C042  | `AdminLoginForm`                     | `features/auth/admin-login-form.tsx:18`     | `initialMessage?`                                                                                           | idle, error, submitting                                                                                              | F019      | P1                                        |
| C043  | `SignOutButton`                      | `features/auth/sign-out.tsx:10`             | `scope?: 'dealer'\|'admin'`, `className?`                                                                   | 2 scopes                                                                                                             | F020      | P3                                        |
| C044  | `DealerProfileForm`                  | `features/dealer/profile-form.tsx:23`       | `dealer: DealerProfile`                                                                                     | empty, populated, field errors, saved, server error                                                                  | F046      | **P1**                                    |
| C045  | `VehicleWizard`                      | `features/vehicle/wizard.tsx:53`            | `vehicle`, `catalog`, `step`, `minPhotos`                                                                   | 4 steps × validation                                                                                                 | F063      | **P0**                                    |
| C046  | `RegistrationStep`                   | `features/vehicle/registration-step.tsx:33` | `catalog: CatalogBundle`                                                                                    | idle, looking-up, found, not-found, manual fallback, error                                                           | F059      | **P0**                                    |
| C047  | `BasicsStep`                         | `features/vehicle/basics-step.tsx:33`       | `catalog`, `lookup?`, `prefillPlate?`                                                                       | from-RC, manual, errors                                                                                              | F060      | P1                                        |
| C048  | `BasicsFields`                       | `features/vehicle/basics-fields.tsx:61`     | `catalog`, `value`, `onChange`, `errors`, `disabled?`                                                       | empty, prefilled, all-errors, disabled                                                                               | F060      | **P0** ✅ (logic tested)                  |
| C049  | `DetailsFields`                      | `features/vehicle/details-fields.tsx:96`    | `catalog`, `value`, `onChange`, `errors`, `disabled?`                                                       | same, 8 required fields                                                                                              | F061      | **P0** ✅ (logic tested)                  |
| C050  | `PhotoUploader`                      | `features/vehicle/photo-uploader.tsx:42`    | `vehicleId`, `media`, `minPhotos`                                                                           | empty, below-min, at-min, uploading, error, reorder, primary marker, delete                                          | F062      | **P0**                                    |
| C051  | `RcSummary`                          | `features/vehicle/rc-summary.tsx:25`        | `lookup: RcLookupResponse`                                                                                  | full match, partial, no alias match, cached                                                                          | F059      | P1                                        |
| C052  | `InventoryActions`                   | `features/vehicle/inventory-actions.tsx:25` | `row: InventoryRow`                                                                                         | menu closed/open, sold dialog, remove dialog, pending, error, notice                                                 | F067      | **P1**                                    |
| C053  | `EnquiryForm`                        | `features/enquiry/enquiry-form.tsx:21`      | `id`, `source`, `vehicleId?`, `dealerSlug?`, `dealerBrandName`, `heading?`, `intro?`, `messagePlaceholder?` | idle, field errors, submitting, rate-limited, sent                                                                   | F089      | **P0** ✅ (actions tested)                |
| C054  | `EnquiryInbox`                       | `features/enquiries/inbox.tsx:24`           | `initialCounts`, `initialStatus`, `initialData`                                                             | per-status tab × empty/loading/loaded/error                                                                          | F091      | **P1**                                    |
| C055  | `SavedCarsList`                      | `features/saved/saved-list.tsx:19`          | `activeCount: number`                                                                                       | pre-hydration, empty, loading, loaded, some unavailable, error                                                       | F087      | **P1**                                    |
| C056  | `SavedCarsProvider` / `useSavedCars` | `features/saved/saved-store.tsx:43`, `:89`  | `children`                                                                                                  | — (provider)                                                                                                         | F087      | **P0** _(as a decorator, not a scenario)_ |
| C057  | `CreditPacks`                        | `features/billing/credit-packs.tsx:19`      | `packs: CreditPacksResponse`                                                                                | list, buying, success + invoice, failure                                                                             | F051      | **P1**                                    |
| C058  | `ReportPanel`                        | `features/report/report-panel.tsx:21`       | `report`, `onRefresh?`, `refreshing?`, `refreshError?`                                                      | clean, warning, blacklisted, refreshing, refresh error                                                               | F068      | **P1**                                    |
| C059  | `ReportSummary`                      | `features/report/report-summary.tsx:29`     | `report: VehicleReportSummary`                                                                              | per verdict tone                                                                                                     | F068      | **P1**                                    |
| C060  | `ReviewActions`                      | `features/admin/review-actions.tsx:24`      | `listing: AdminListingDetail`                                                                               | per listing status × pending × error; uses **Radix Dialog**                                                          | F070      | **P0**                                    |
| C061  | `QueueApproveButton`                 | `features/admin/queue-actions.tsx:15`       | `listingId`, `title`                                                                                        | idle, pending, error                                                                                                 | F069      | P2                                        |
| C062  | `DealerAdminActions`                 | `features/admin/dealer-actions.tsx:36`      | `dealer: AdminDealerDetail`                                                                                 | per dealer status × approve (enabled/disabled) × suspend form × reinstate × pending × error — grant form at **F054** | F045      | **P0** ✅                                 |
| C062b | `DocumentReview`                     | `features/admin/document-review.tsx:32`     | `documents: AdminDealerDetail['documents']`                                                                 | awaiting decision, verified, rejected, not uploaded, rejecting, in flight, empty                                     | F044      | **P0** ✅                                 |
| C063  | `ModerationStrip`                    | `features/admin/moderation-strip.tsx:12`    | `photos: {id,position,label,url}[]`                                                                         | 0, 1, 12 photos                                                                                                      | F070      | P2                                        |
| C064  | `ConfigRow`                          | `features/admin/config-editor.tsx:12`       | `entry: ConfigEntry`                                                                                        | boolean/number/string × clean/dirty/saving/saved/error                                                               | F072      | **P1**                                    |
| C065  | `QueryProvider`                      | `features/query/query-provider.tsx:16`      | `children`                                                                                                  | — (provider)                                                                                                         | F091      | _(decorator)_                             |

---

## Component dependency map

```text
lib/cn ──────────────────────────────────────────┐
contracts (StatusTone, DTOs, Zod schemas) ───────┤
                                                 ▼
                       ┌──────────── components/ui/ ────────────┐
                       │  Button ─── Spinner                    │
                       │  ButtonLink ─→ next/link   [UNUSED]    │
                       │  Blueprint ─── Corners                 │
                       │  Plate · StatusTag · Tag               │
                       │  Avatar · LogoTile                     │
                       │  StatCard ──→ Blueprint                │
                       │  EmptyState ─→ Blueprint               │
                       │  ErrorState ─→ Blueprint               │
                       │  SkeletonLines · Banner · Stepper      │
                       │  ImageSlot                             │
                       └────────────────┬───────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  components/forms/            components/layout/             components/vehicle/
   Field                        CustomerHeader ─→ Plate        VehicleCard ─→ Avatar,
    ├─ Combobox ─→ Field          └─→ CitySelector                          ImageSlot,
    └─ PlateInput ─→ Field        └─→ useSavedCars ⚠                        Plate, Tag
         └─→ contracts            └─→ usePathname ⚠             └─→ useSavedCars ⚠
             REGISTRATION_NUMBER                                 └─→ VehicleRow (internal)
                                 CustomerFooter ─→ Plate         └─→ VehicleImage ─→ ImageSlot
                                                                 └─→ VehicleCardSkeleton
        ▼                               ▼
  components/search/           components/dealers/            VehicleGallery ─→ Corners,
   FilterPanel ─→ lib/url       DirectoryCard ─→ Blueprint,                     ImageSlot
    └─→ useRouter ⚠                              ImageSlot,     └─→ Strip (internal)
   SearchToolbar ─→ FilterPanel                  LogoTile,      └─→ Lightbox (internal)
   MobileFilterSheet ─→ FilterPanel              Plate, Tag     └─→ PhotoImage (internal)
   HeroSearch ─→ Blueprint      DirectoryFilters ─→ useRouter ⚠
                                                               VdpCtaStack ─→ Button, Banner
        ▼                                                       └─→ RevealContactButton
  components/auth/             components/admin/                    └─→ revealContactAction ⚠⚠
   AuthShell ─→ Plate           AdminNav ─→ usePathname ⚠           └─→ useSavedCars ⚠
   AuthHeading                 components/dealer/
   GoogleSignInButton           ConsoleNav ─→ usePathname ⚠
                                ConsoleTabBar ─→ usePathname ⚠

                                        │
                                        ▼
                    ─────────── features/ (25 components) ───────────
                    all consume components/ui and components/forms
                    all consume server actions or fetch()  ⚠⚠
```

**Legend.** `⚠` needs a stub or decorator in the sandbox. `⚠⚠` calls a server
action or `fetch()` and must be stubbed to render at all.

**Depth is 3.** `components/ui` → `components/{forms,layout,search,vehicle,dealers,auth,admin,dealer}` →
`features/`. Nothing in `components/ui` imports anything from a layer above it.
There are no cycles. That is a healthy graph and it means the sandbox can be
built strictly bottom-up.

---

## Coupling register

| ID      | Coupling                                                          | Affected components                                                                                                                                                        | Sandbox impact                                                                                                 | Risk     |
| ------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| **C-1** | `useSavedCars()` **throws** outside `SavedCarsProvider`           | `VehicleCard`, `VdpCtaStack`, `RevealContactButton`'s sibling `SaveButton`, `CustomerHeader`, `SavedCarsList`                                                              | A `SavedCarsProvider` decorator is mandatory before **any** vehicle scenario renders                           | MEDIUM   |
| **C-2** | `@tanstack/react-query`                                           | `EnquiryInbox`                                                                                                                                                             | Needs a `QueryProvider` decorator with retries off                                                             | LOW      |
| **C-3** | `next/navigation` (`useRouter`, `usePathname`, `useSearchParams`) | `CustomerHeader`, `AdminNav`, `ConsoleNav`, `ConsoleTabBar`, `FilterPanel`, `SearchToolbar`, `MobileFilterSheet`, `HeroSearch`, `DirectoryFilters`, + 8 feature components | Framework-level; `@storybook/nextjs-vite` provides these. Pathname/params should be **controls**, not fixtures | LOW      |
| **C-4** | Server actions                                                    | `vdp-cta.tsx` (in `components/`!) + 19 files in `features/`                                                                                                                | Each needs a module stub. The pattern already exists in `apps/web/tests/setup.ts`                              | **HIGH** |
| **C-5** | Direct `fetch()` to BFF routes                                    | `DocumentUploader`, `PhotoUploader`, `SavedCarsList`                                                                                                                       | Needs request interception (MSW or a `fetch` stub)                                                             | MEDIUM   |
| **C-6** | `localStorage`                                                    | `SavedCarsProvider`                                                                                                                                                        | Sandbox state leaks between scenarios unless cleared per-render                                                | LOW      |
| **C-7** | `server-only` import                                              | `lib/session.ts`, `lib/config.ts`, `lib/client-ip.ts`                                                                                                                      | Not imported by any component — **no sandbox impact**. Verified.                                               | NONE     |

---

## Duplication register

**Do not merge any of these in this phase.** Documented so a later decision is
informed.

### D-A — `Button` is bypassed 88 times

|                    |                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Similarity**     | Identical output. `className="btn btn-primary"` produces exactly what `<Button variant="primary">` produces.                                                                                                                                                                                                                |
| **Scale**          | `<Button>` appears **29** times, imported by 13 files. Raw `className="btn …"` appears **88 times across 39 files** — a **75 % bypass rate** — including inside `components/` itself (`vehicle-card.tsx`, `gallery.tsx`, `vdp-cta.tsx`, `dealer-card.tsx`, `search-toolbar.tsx`, `hero-search.tsx`, `customer-header.tsx`). |
| **Consumers**      | 39 files                                                                                                                                                                                                                                                                                                                    |
| **Differences**    | Raw usage sidesteps `loading`, the `aria-busy` contract, `disabled ?? loading`, and the `Spinner`.                                                                                                                                                                                                                          |
| **Risk**           | **HIGH.** A change to the loading contract reaches only a quarter of the buttons in the product; the other three quarters silently keep the old behaviour. `ButtonLink` exists for the link case and is used **zero** times.                                                                                                |
| **Recommendation** | The reuse rule must be enforced at review, and every new button must go through `Button`/`ButtonLink`. Migrating the existing 88 is a separate, later, mechanical PR — **not** part of any feature PR.                                                                                                                      |

### D-B — Five DESIGN-SPEC components exist only as CSS

| Spec section   | CSS class                      | React wrapper                 | Hand-rolled call sites |
| -------------- | ------------------------------ | ----------------------------- | ---------------------- |
| §2.3 Input     | `.input`                       | **none**                      | **70**                 |
| §2.7 Card      | `.card`                        | **none**                      | **32** (30 files)      |
| §2.13 Table    | `.table`                       | `Table` — **created at F045** | **5** pages            |
| §2.4 Segmented | `.seg` / `.seg-opt`            | **none**                      | 2 files                |
| §2.14 Dialog   | `.dialog` / `.dialog-backdrop` | **none** — Radix used instead | **0**                  |

**Risk: HIGH.** These are the components a sandbox registry would have surfaced.
The 5 `.table` implementations across dealer inventory, billing, admin payments,
admin listings and admin dealers are five independent renderings of the same
design-spec component — the exact duplication the reuse rule exists to prevent.

**Recommendation.** Not a fix for this phase. But when the sandbox is built,
`Input`, `Card`, `Table`, `Segmented` and `Dialog` should be **the first new
components created**, each entering with a sandbox entry, and existing call
sites migrated opportunistically rather than in one sweep.

**Progress.** `Input` was created at **F013**, before any of its 70 call sites
were reconstructed; `Table` at **F045**, at the first of its five. Neither was
a migration — each landed at the moment its first consumer did, which is the
only point at which this costs nothing. `Segmented` is due at **F091** (its
`.seg` CSS arrived at F045 with the dealer status tabs, which are `<Link>`s and
not the control); `Card` and `Dialog` are still open.

### D-C — `.dialog` CSS is dead; Radix is the real implementation

`.dialog` and `.dialog-backdrop` (24 lines of `globals.css`) have **zero**
consumers. `ReviewActions` uses `@radix-ui/react-dialog` instead. Two dialog
strategies, one of them dead. **Risk: MEDIUM** — the next developer who needs a
dialog will pick the wrong one.

### D-D — `ReportPanel` vs `ReportSummary`

Two components rendering `VehicleReport` at two privilege levels: `ReportSummary`
(117 lines, read-only, public VDP) and `ReportPanel` (205 lines, interactive with
refresh, admin). Genuinely different — but they duplicate the verdict/tone
rendering. **Risk: LOW.** **Recommendation:** leave split; extract a shared
verdict row only if a third consumer appears.

### D-E — `VehicleCard` grid vs `VehicleRow` list

`VehicleCard` dispatches `variant='list'` to a private 70-line `VehicleRow` that
re-implements the image block, plate, sold overlay and dealer strip. **Risk:
MEDIUM** — a change to the sold overlay must be made twice in the same file.
**Recommendation:** a sandbox scenario for each variant makes the divergence
visible. Do not refactor now.

### D-F — Two save-button implementations

`SaveButton` exists privately in **both** `vehicle-card.tsx:246` and
`vdp-cta.tsx:117`. Different sizes and markup; same store, same semantics.
**Risk: LOW–MEDIUM.** `aria-pressed` is handled correctly in both today. That is
luck, not structure.

### D-G — `StatusTone` vs `Banner.tone`

Two overlapping tone unions (see finding D-3). **Risk: LOW.**

---

## Dead code register

| Item                                      | Location                           | Evidence                  |
| ----------------------------------------- | ---------------------------------- | ------------------------- |
| `ButtonLink`                              | `components/ui/button.tsx:76`      | zero imports              |
| `.dialog`, `.dialog-backdrop`             | `globals.css:620–650`              | zero consumers            |
| `.tag-draft`, `.tag-expired`, `.tag-sold` | `globals.css`                      | no prop path reaches them |
| `react-hook-form`                         | `apps/web/package.json` dependency | **zero** imports in `src` |
| `@hookform/resolvers`                     | `apps/web/package.json` dependency | **zero** imports in `src` |
| `@radix-ui/react-popover`                 | `apps/web/package.json` dependency | **zero** imports in `src` |
| `docs/startup-pitch/`                     | directory                          | empty                     |
| `docs/mobile-handoff/mock/{data,lib}/`    | directories                        | empty                     |
| `.storage-test/`                          | repo root                          | empty, untracked          |

Three unused **production** dependencies ship in the web image. Not a
correctness bug; worth a cleanup PR of its own, after the reorganisation.

---

## Test coverage by component

| Component                   | Test                                                   | Kind               |
| --------------------------- | ------------------------------------------------------ | ------------------ |
| `Button`                    | `tests/unit/components/ui/button.test.tsx`             | ✅ render          |
| `PlateInput`                | `tests/unit/features/vehicle/plate-input.test.ts`      | ⚠️ logic only      |
| `BasicsFields`              | `tests/unit/features/vehicle/basics-fields.test.ts`    | ⚠️ validation only |
| `DetailsFields`             | `tests/unit/features/vehicle/details-fields.test.ts`   | ⚠️ validation only |
| `EnquiryForm`               | `tests/unit/features/enquiry/{actions,shared}.test.ts` | ⚠️ actions only    |
| **All other 60 components** | —                                                      | ❌ **none**        |

`apps/web/vitest.config.ts` sets a 90 % coverage threshold and documents that it
is deliberately **not** wired into `pnpm test`, because doing so would stop the
web suite running in CI at all. Actual: **13.83 % lines, 9.32 % functions.**

The gap between 13.83 % and 90 % is, almost exactly, the component layer.
Closing it is the sandbox's job.

---

## D1 impact — components affected by removing the catalogue

`feature-map.md` §D1 removes the `Make`/`Model`/`Variant`/`Color`/`Rto` models,
`modules/catalog/**`, the two catalogue endpoints, `prisma/seed/catalog/**` and
the `CatalogBundle` contract. Six component entries above describe props that
disappear or change with it.

| Component               | Today                                                                         | After D1                                                                                                                                                                                                                                |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C018 `Combobox`         | "Type-to-filter select for the 344-model catalogue" — its whole justification | The justification goes. Decide at **F060** whether it survives as a suggest-from-existing-values input or is replaced by `Input`. Build the story either way (`component-sandbox.md` §12, S3) so the decision is made by looking at it. |
| C045 `VehicleWizard`    | `catalog: CatalogBundle` prop                                                 | Prop removed. Steps take free-text values.                                                                                                                                                                                              |
| C046 `RegistrationStep` | `catalog: CatalogBundle`                                                      | Prop removed. The RC lookup already supplies `makerModel`; the step no longer needs a vocabulary.                                                                                                                                       |
| C047 `BasicsStep`       | `catalog`, `lookup?`, `prefillPlate?`                                         | `catalog` removed; `lookup` becomes the only prefill source, with manual entry as the fallback.                                                                                                                                         |
| C048 `BasicsFields`     | `catalog` drives make → model → variant cascading selects                     | **The largest change.** Three dependent selects become free-text fields with a suggest-existing guard rail. This is where facet fragmentation is prevented or created (`feature-map.md` F060 ⚠️).                                       |
| C049 `DetailsFields`    | `catalog` supplies colour and RTO options                                     | `catalog` removed; colour and RTO become free text or a static constant list.                                                                                                                                                           |

**Not affected by D1:** nothing in `components/` reads `rc-aliases.ts`, which
survives unchanged.

⚠️ **`CitySelector` and everything reading `City` — reassessed by D6.** This
table said they were untouched because `City` survived D1 as its own feature
(F026). It does not survive **D6**: the table, the module and `GET /v1/cities`
are gone, and a dealership's city is text it typed.

| Component                 | Today                                              | After D6                                                                                                                                       |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| C020 `CustomerHeader`     | `cities: CitiesResponse`                           | The list comes from the search facets (**F076**) — the cities dealers actually trade in, rather than five seeded rows with nothing behind them |
| C040 `OnboardingWizard`   | `cities` prop, a `<select>` and a disabled `State` | Prop removed. City and state are two required text inputs, normalised on write                                                                 |
| C049 `DetailsFields`      | `catalog` supplies a city for the vehicle location | Free text like the dealership's, sharing F060's suggest-existing control                                                                       |
| `CitySelector` (**F074**) | reads `GET /v1/cities`                             | reads the facets. Its behaviour — short list / long list / none selected / open / fallback — is unchanged; only where the list comes from is   |

`C018 Combobox` gains back some of the justification D1 took from it: the
suggest-from-existing-values input now has city and state as consumers as well
as make and model.

**Sandbox consequence.** These six are the only entries whose props are known to
be wrong for the target state. Their stories should be written **after** F060
settles the input shape, not before — or written now against free text, which is
the decided direction. Everything else in this map is stable under D1.
