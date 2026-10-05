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

### BrandLogo — reference monogram

|                      |                                                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/brand-logo/brand-logo.tsx`                                                                                                                                                |
| **Props / defaults** | `variant: 'light' \| 'dark' = 'light'`, `size: number = 30`, `className?: string`                                                                                                                  |
| **Consumers**        | CustomerHeader, CustomerFooter, AuthShell (customer/dealer/admin sign-in and onboarding), StatusShell (errors and missing pages), ComingSoon, dealer sidebar, admin navigation, GalleryViewer      |
| **States**           | Light backgrounds use black on white; admin navigation and the photo viewer use white on black. Header remains white when sticky. Dealer sidebar stays hidden on mobile.                           |
| **Compatibility**    | Plate and dealer LogoTile APIs stay intact; links, adjacent text, responsive behavior and logo footprints stay intact. Dark badges retain their 29 × 23 px footprint with a centered square image. |
| **Sandbox**          | Primitives/BrandLogo: Light, Dark, Surfaces; Layout/ComingSoon: Playground; existing header/footer/auth/gallery stories                                                                            |
| **Validation**       | Existing header/footer/auth/gallery/console and SEO tests; desktop/mobile visual inspection recorded on the `testing_evidence` branch                                                              |

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

|                      |                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Location**         | `apps/web/src/components/forms/plate-input/plate-input.tsx` — landed at F056; uncontrolled, `id`/`name`/`defaultValue` rather than `value`/`onChange`, for server-action forms |
| **Purpose**          | The number-plate field. Accepts `TN 09 BX 1234`, `TN-09-BX-1234` and `tn09bx1234`; normalises on the way out.                                                                  |
| **Props**            | `value: string`, `onChange: (next: string) => void`, `error?: string \| undefined`, `disabled?`, `autoFocus?`                                                                  |
| **Defaults**         | `disabled=false`, `autoFocus=false`                                                                                                                                            |
| **Also exports**     | `validatePlate(raw)`, `normalisePlate(raw)`                                                                                                                                    |
| **Dependencies**     | `Field`, `REGISTRATION_NUMBER` from contracts                                                                                                                                  |
| **Consumers**        | 1 (`RegistrationStep`)                                                                                                                                                         |
| **Tests**            | ✅ `apps/web/tests/unit/features/vehicle/plate-input.test.ts` (logic only, not render)                                                                                         |
| **Ownership**        | Shared                                                                                                                                                                         |
| **Sandbox priority** | P1                                                                                                                                                                             |
| **Confidence**       | HIGH                                                                                                                                                                           |

> ✅ **This is the model component.** Pure props, no context, validation
> exported and tested separately, a comment explaining _why_ it is a component
> rather than an `<input pattern>`, and the schema imported from contracts so
> browser and server agree by construction. Every new component should look
> like this. Use it as the sandbox's worked example.

### C075 — `OtpInput`

|                      |                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `apps/web/src/components/ui/otp-input.tsx`                                                                                                |
| **Purpose**          | DESIGN-SPEC §2.3 — one 52×58 box per digit of a verification code. **New at R39.**                                                        |
| **Props**            | `id`, `value: string`, `onChange: (value: string) => void`, `length?` (6), `invalid?`, `disabled?`, `autoFocus?`, `label?`, `onComplete?` |
| **States**           | empty, partly typed, filled, invalid, disabled                                                                                            |
| **Dependencies**     | `cn` only                                                                                                                                 |
| **Consumers**        | 2 (`PhoneVerification`, `PhoneSignIn` through `PhoneCodePanel`, **R63**)                                                                  |
| **Tests**            | ✅ `apps/web/tests/unit/components/ui/otp-input.test.tsx`                                                                                 |
| **Ownership**        | Shared                                                                                                                                    |
| **Sandbox priority** | **P1** — the keyboard contract is the whole component                                                                                     |
| **Confidence**       | HIGH                                                                                                                                      |

**The value is the caller's.** This renders `value`, split — there is no second
copy of the code living in six pieces of DOM state that could disagree with the
one being submitted.

`autocomplete="one-time-code"` sits on the **first** box only, and the paste
handler is what makes that work: a phone offering the code from the SMS fills
that one input with all six digits, and without spreading them the affordance
would be worse than useless. A single `<input maxlength="6">` would give the
same behaviour for nothing and is the right control for most products; the
cells are what this design asks for, so the keyboard work is paid for once.

---

## Layer 3 — Layout & navigation

| ID    | Component            | Location                                    | Props                                                        | States                                                                                                           | Consumers            | Ownership        | Priority  |
| ----- | -------------------- | ------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | -------------------- | ---------------- | --------- |
| C020  | `CustomerHeader`     | `components/layout/customer-header.tsx:37`  | none — reads `usePathname()`                                 | 5 nav-active states × mobile/tablet                                                                              | 1 layout             | Shared           | **P0** ✅ |
| C021  | `CustomerFooter`     | `components/layout/customer-footer.tsx:93`  | `social`, `supportEmail`, `supportPhone`                     | 4 — published / none published / API unreachable / mobile                                                        | 1 layout             | Shared           | P3 ✅     |
| C021c | `SocialIcon`         | `components/layout/social-icons.tsx:58`     | `network`                                                    | 6, one per network                                                                                               | 1 (`CustomerFooter`) | Feature-specific | P3 ✅     |
| C022  | `AuthShell`          | `components/auth/auth-shell.tsx:19`         | `eyebrow?`, `children`, `className?`                         | 1                                                                                                                | 3 pages              | Shared           | P2        |
| C023  | `AuthHeading`        | `components/auth/auth-shell.tsx:44`         | `title`, `children?`                                         | subtitle present/absent                                                                                          | 3 pages              | Shared           | P3        |
| C024  | `AdminNav`           | `components/admin/admin-nav.tsx:75`         | `items?` — defaults to the landed set; reads `usePathname()` | 1 per admin route, + landed-today                                                                                | 1 layout             | Shared           | P2 ✅     |
| C025  | `ConsoleNav`         | `components/dealer/console-nav.tsx:70`      | `items: NavItem[]`                                           | 1 per route active                                                                                               | 1 layout             | Shared           | P2 ✅     |
| C026  | `ConsoleTabBar`      | `components/dealer/console-nav.tsx:103`     | `items: NavItem[]`                                           | 1 per tab active; mobile-only (`md:hidden`); under-full carries the `short`-less items; **empty renders `null`** | 1 layout             | Shared           | **P1** ✅ |
| C077  | `ViewsChart`         | `components/dealer/dashboard-panels.tsx:41` | `chart`                                                      | ordinary week / no views / one spike / first day of trading                                                      | 1 page               | Shared           | P2 ✅     |
| C078  | `RecentEnquiries`    | `components/dealer/dashboard-panels.tsx:93` | `enquiries`                                                  | four leads / none yet / general enquiry / long names at phone width                                              | 1 page               | Shared           | P2 ✅     |
| C039  | `GoogleSignInButton` | `components/auth/google-button.tsx:16`      | `href`, `label?`, `disabled?`                                | default, disabled                                                                                                | 1 page               | Shared           | P2        |

**Coupling note.** `CustomerHeader` (C020), `AdminNav` (C024), `ConsoleNav`
(C025) and `ConsoleTabBar` (C026) all call `usePathname()`. In the sandbox each
needs the router stubbed and the pathname settable _as a control_ — which is
exactly what makes "which nav item is active" testable for the first time.

> **R31 — two nav lists, and the shell renders the shorter one.**
> `DEALER_NAV` is the baseline's six items and is what C025 and C026 are _for_;
> `LANDED_NAV` is the subset whose routes exist. `(dealer)/dealer/layout.tsx`
> renders `LANDED_NAV`, because a nav item onto a 404 is the console telling a
> dealer a page exists and then not having it. **F050, F051, F056 and F065 each
> delete their own line** from the `NOT_YET_BUILT` set as they land; when it is
> empty the constant goes and `DEALER_NAV` is used directly. **F048 deleted
> `/dealer`.**
>
> **F048 applies the same rule to C024.** `/admin/listings` (F069) and
> `/admin/payments` (F053) were offered from F049 onward, so two of five items
> in the operations console led to a 404; `LANDED_ADMIN_NAV` is the admin side's
> `LANDED_NAV`, and F053 and F069 each delete their own line.
>
> **C026 grew one rule at F048.** §3.11 gives the bar five items and drops
> `Dealer profile`; four of those five are still to land, and the sidebar is
> `hidden md:flex`, so applying the rule literally today gives a phone one tab
> and no way to reach `/dealer/profile` at all. While the bar is short of its
> five it also carries the items without a `short`. The accommodation removes
> itself when the fifth lands. It still returns `null` when handed nothing.
>
> The sandbox shows both: `Full` is the component as it will be,
> `AsTheConsoleRendersItToday` is what a dealer sees, and the gap between the
> two stories is the reconstruction drawn.

---

### C130 — `JsonLd`

`components/seo/json-ld/`. Props `nodes` (typed JSON-LD nodes from
`lib/seo/schemas`). Renders one `<script type="application/ld+json">` holding
an `@graph`, serialised by `serializeJsonLd` so dealer-typed text cannot close
the element; renders nothing for no nodes. Consumers: `/`, `/cars`,
`/car/[slug]`, `/dealers`, `/dealers/[slug]`. Replaces the portfolio's private
`DealerJsonLd`. **NEW with the SEO work (F095).** **No sandbox entry** — it
draws nothing; its output is asserted in `tests/unit/app/seo-routes.test.tsx`
and the page tests. See `docs/seo.md`. (Numbered C100 when it landed with F095;
C100 was already `AvailabilityNotice`.)

### C131 — `StatusPage` · `NotFoundState`

`components/errors/status-page/`. Props `code`, `title`, `description`,
`actions`, `reference`. The full-page 404 and error screen — eyebrow code, one
`<h1>`, one sentence, actions that stack full width on a phone. `NotFoundState`
is the 404's copy and its two links (Go to homepage, Browse cars). Consumers:
`app/not-found.tsx`, `app/(public)/not-found.tsx`, `RouteError`. **NEW at
F093/F094.** **P1** — sandbox `Errors/StatusPage`.

### C132 — `RouteError` · C133 — `SectionError` · C134 — `RetryButton` · C135 — `StatusShell`

`components/errors/`. `RouteError` (`error`, `reset`, `description`, `homeHref`,
`homeLabel`) is what every `error.tsx` renders: `StatusPage` with Try again and
a way home, the digest as the reference, `<title>` and `noindex`, never the
error's message. `SectionError` (`title`, `message`) is a section failing in
place — the homepage rows, a dealer's inventory. `RetryButton` refreshes the
route and runs an optional `onRetry` (a boundary's `reset`) in one transition.
`StatusShell` is a logo-only frame for the root, global and dealer boundaries.
**NEW at F093.** **P1** — sandbox `Errors/StatusPage`, `Errors/SectionError`.
`PublicShell` (`components/layout/public-shell`) is the public layout's header,
`<main>` and footer, extracted so the root `not-found.tsx` can use it; it is an
async server component with no sandbox story. See `docs/errors.md`.

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

> **As rebuilt (F078).** `components/search/filter-panel/` — `FilterPanel`,
> `FilterGroup`, `FacetRow`, `FacetCheckboxList`, `RangePresets`, `YearRange`.
> Props `facets: VehicleFacets`, `params: VehicleSearchParams`, `basePath`,
> `groups?` (default all twelve; `PORTFOLIO_FILTER_GROUPS` drops town and
> dealer), `idPrefix?`, `heading?`, `className?`. Twelve groups in the brief's
> order; price and km as counted presets, year as two selects, the rest as
> checkbox lists that collapse past six. Writes through `lib/vehicle-search.ts`
> and `SearchNavigationProvider` (C081); ticks show at once via `useOptimistic`.
> Zero-count rows are dimmed and operable (§2.4); a group with no values is
> absent. `dimZeroRows` is gone — every zero row is dimmed. Tests
> `tests/unit/components/search/filter-panel.test.tsx`. Sandbox
> `Search/FilterPanel`, eight states.

> **R53:** City / Town and Dealer appear only with a district; a zero-count
> option is a _disabled_ control (a ticked one stays enabled so it can be
> unticked); Colour shows all twelve families.

> **F086 part 2 used it exactly that way:** the portfolio passes
> `groups={PORTFOLIO_FILTER_GROUPS}` (no City / Town, no Dealer) and
> `heading="Filter inventory"` to the same component, and the same
> `MobileFilterSheet` below `lg`. No portfolio-specific panel exists.

> ✅ **The canonical "existing component + props" success case.** F086 (dealer
> portfolio) needed a
> filter panel without a dealer group. Rather than a `PortfolioFilterPanel`
> duplicate, it added `groups` and `dimZeroRows`. That is exactly the outcome
> the reuse rule is written to produce, and this entry is the precedent to cite.

### C028 — `SearchToolbar` · C029 — `MobileFilterSheet`

Both in `components/search/search-toolbar.tsx` (`:11`, `:82`).

- `SearchToolbar` — `params`, `basePath`, `showSearch?` (default `true`). Free-text field + sort `<select>`, both writing to the URL. Consumers: 2. **P1.**
  **As rebuilt (F080):** `components/search/search-toolbar/` — `SearchToolbar`,
  `SearchField`, `SortSelect`. Adds `searchPlaceholder?`, `idPrefix?`,
  `leading?` (the mobile Filters button's slot) and `className?`. The field is
  debounced (350 ms) and _replaces_ history while typing, _pushes_ on Enter,
  and follows the URL on Back. The sort offers Newest, Price ↑, Price ↓, Year,
  Km. Tests `tests/unit/components/search/search-toolbar.test.tsx`. Sandbox
  `Search/SearchToolbar`.
  **R55:** `/cars` renders it with `showSearch={false}` — sort and Filters only,
  pushed right in the page's controls row — and puts `CarSearchBox` and
  `DistrictScope` first, the order `/dealers` uses. The portfolio still uses the
  whole toolbar.
- `MobileFilterSheet` — `facets`, `params`, `basePath`, `resultCount`, `groups?`, `dimZeroRows?`. Bottom sheet; body-scroll lock, Escape-to-close, sticky CTA with a live count. Consumers: 2. **P0** — it is the only mobile-specific component in the product and there is no way to see it today without resizing a real browser against a real API.
  **As rebuilt (F079):** `components/search/mobile-filter-sheet/`. Props
  `facets`, `params`, `basePath`, `total`, `groups?`, `className?`. The same
  `FilterPanel` (`framed={false}`, `idPrefix="sheet"`) inside
  `Dialog variant="sheet"` (C070 gains the variant), so the trap, Escape, focus
  return and scroll lock are Radix's rather than hand-rolled. The trigger sits
  in `SearchToolbar`'s `leading` slot with an applied-count badge; filters apply
  as ticked and _Show N cars_ shows the live total. Tests
  `tests/unit/components/search/mobile-filter-sheet.test.tsx`. Sandbox
  `Search/MobileFilterSheet`, `Primitives/Dialog` › `Sheet`.

### C080 — `AppliedFilters`

`components/search/applied-filters/`. Props `facets`, `params`, `basePath`.
States: nothing applied (renders nothing), a few filters, ranges and search.
§3.3's chip row — one removable `tag-outline` chip per applied filter plus
_Clear all_, which keeps the district. **NEW at F078.** **P1**

### C081 — `SearchNavigationProvider` · `SearchResultsRegion`

`components/search/search-navigation/`. One transition for every search
control on a page, so the results dim (`aria-busy`) while the next page renders
instead of blanking; `useSearchNavigation` falls back to a plain router
outside it. **NEW at F078.** **P2**

**R57:** the dim waits 200 ms and is 60%, not 50% (`resultsRegionClass`), so an
ordinary ~200 ms update does not flash the grid. A measured baseline shows
nothing on the page remounts during an update; see `docs/code/web/components/search/search-navigation.md`.

### C030 — `HeroSearch`

`components/search/hero-search.tsx:13`. Props: `cityName: string`,
`citySlug?: string`. One consumer (homepage). **P2.**

### C031 — `DirectoryFilters`

`components/dealers/directory-filters.tsx:34`. Props:
`cities: DealerDirectoryResponse['cities']`, `city?: string[]`, `district?`,
`q?`. States: default, one town, several towns, searching, town and search,
within a district, no towns, many towns. One consumer. **P2** ✅

The chips are **multi-select** as of **R11** — `city` is a list, and the row
carries a counted "Clear N towns" because un-pressing four chips in turn is not
an affordance. `cities` arrives narrowed to whichever district the header
chose; this component carries the district through every navigation it makes
but never sets it.

**R23 — the row has two shapes.** With no district, `cities` is every town on
the _platform_ (44 against the dev seed, five wrapped rows), so the chips give
way to a `Select district` button that opens `DistrictPicker` (C071). The grid
underneath is unchanged: no district still means every dealership.

The exception is an **applied** town, which always renders along with its
`Clear` — `indexPolicy` names `/dealers?city=vellore` an indexable canonical, so
a buyer can arrive with a town set and no district, and a row that hid itself
would leave them a filter they can neither see nor clear.

**R43 — the search is no longer this component's.** The raw
`<input className="input">` and the `<form>` around it are gone, replaced by
`DealerSearchBox` (C074). What stays here is the URL: the box reports a chosen
term through `onSearch`, and `go()` writes `?q=` exactly as it did for the form.
The `useState`/`useEffect` pair that mirrored `q` into the input went with the
form — the box is keyed on the applied search, so a navigation resets it.

### C073 — `AutocompletePanel` · `useAutocomplete` · `HighlightedText`

`components/ui/autocomplete.tsx`. Props (`AutocompletePanel`):
`autocomplete: UseAutocomplete<T>`, `label`, `placeholder`, `groupLabel`,
`emptyMessage: (search) => string`, `name?` (the input's form name, R79),
`children: (autocomplete) => ReactNode`.
States: closed, loading, rows, nothing found, endpoint failed. **NEW at R43.**
Shared, reusable, **P1**.

**It knows nothing about what is in the list**, and that is the whole design.
The caller supplies an `AutocompleteSource<T>` — `suggest`, `keyOf`, `valueOf` —
and a row renderer; everything else is here: the 300 ms debounce
(`lib/use-debounced-value.ts`), the `AbortController`, the stale-answer guard,
the first row highlighted after every fresh answer, ↑/↓ with wrapping, Escape,
the outside-pointerdown close, and the ARIA 1.2 combobox wiring
(`role="combobox"` + `aria-activedescendant`, so focus never leaves the input).

`DealerSearchBox` (C074) is the first consumer. **`CarSearchBox` (C082, R54) is
the second**, and it did not write a second one of these — that is the D-6
failure caught before the duplicate exists rather than after. R54 added
`reset(next)` (set the value without opening or asking) and made the hook skip
asking about the value it was mounted with, and drop any answer that arrives
after its request was cancelled.

`HighlightedText` marks every occurrence of the search, case-insensitively, in
`<mark>`. It renders the text unmarked when it does not contain the search,
which is the correct answer for a row matched on something other than the label
being drawn.

### C074 — `DealerSearchBox`

`components/dealers/dealer-search-box.tsx`. Props: `q?`, `district?`,
`city?: string[]`, `districtName?`, `onSearch: (term: string | null) => void`,
`className?`. States: empty, typing, loading, recommendations (first
highlighted), arrowed, matched on a place, nothing found, endpoint failed, a
search already applied. One consumer (C031). **NEW at R43.** **P1**

The dealer half of the typeahead, and nothing else: the source (`fetch` against
`/api/search/dealers`, passing the page's own `district` and `city` through so a
suggestion cannot vanish when it is chosen), the row, and what choosing one
means — `onSearch(brandName)`, which `DirectoryFilters` turns into `?q=`.

The row draws `DealerSuggestion`: a 28px initials tile, the name with the typed
characters marked, a meta line, a verified tag, and `Select ↵` on the
highlighted row — the one affordance that explains the default highlight.
**`matchedOn` decides which of the two lines is marked**: a dealership offered
because its _town_ matched has none of the typed characters in its name.

### C082 — `CarSearchBox`

`components/search/car-search-box/`. Props: `params`, `basePath`,
`districtName?`, `action?`, `className?`. States: empty, loading, suggestions
(first highlighted), arrowed, nothing found, endpoint failed, a search already
applied, on the homepage. Two consumers: `/cars`, first in the page's controls
row since R55, and the homepage hero since **R79**, with no params and
`basePath` and `action` both `/cars`. **NEW at R54.** **P1**

`action` makes the form a real `<form action method="get">` and names the input
`q`, so Enter before the script loads still lands on `/cars?q=…`. `/cars` does
not pass it and is unchanged.

The second consumer of `Autocomplete` (C073), as C073 required — no second
typeahead. The source is `fetch` against `/api/search/vehicles`, passing the
page's `district`, `city` and `dealer` through. A row draws `CarSuggestion`: a
kind tile (B, M or V), the label with the typed characters marked, and a meta
line.

**Typing only asks; it never writes the URL.** Choosing a row writes canonical
filters (`suggestionParams`): a brand replaces `brand=` and drops `model=`, a
model sets both, and a variant sets both plus the variant as `q=`. Every other
filter and the district are kept, and the page is dropped. Enter with no row to
take searches the typed words as `q=`, and × clears `q=`. The box follows the
URL's `q` (the hook's `reset`), so removing the search chip empties it without
opening the panel or asking again.

### C068 — `LocationCard`

`components/dealers/location-card.tsx:47`. Props:
`address: DealerPublicProfile['address']`, `brandName: string`. States: place
card, pin only, directions only, map only, neither. One consumer (the
portfolio), where it was inline until **R10**.

The states are the component's whole reason for existing as one: the map is
`address.embedUrl` and the button is `address.mapsUrl`, and the two are
independently nullable because a share link carries neither a pin nor a place
until it is followed and following it is best-effort. Neither is ever composed
from the address. A server component — a Google embed in an `<iframe>` needs no
JavaScript of ours. **P2** ✅

Which map is in the frame is **not this component's decision**. `embedUrl` is
composed by the API (**R14**), so the card renders one `<iframe>` and cannot
tell a place card from a bare pin — which is what let the map gain the yard's
name, rating and an in-frame directions control without the card changing shape.

### C071 — `DistrictPicker`

`components/layout/district-picker.tsx`. Props: `locations: PublicLocations`,
`children: (chosen: DistrictChip | null) => ReactNode`. States: header trigger,
directory trigger, one chosen, many states, searching, state filtered, no state
recorded, no districts. Three consumers (`LocationSelector`, `DirectoryFilters`,
`DistrictScope`). **Reusable.**

**New at R23**, extracted whole out of C069. Two openers is the moment the
dialog stops belonging to the header — and what is shared is not only the markup
but the **selection rule** (drop `city`, drop `page`, go to `/dealers` from
anywhere else), which a second copy of would let the header and the directory
disagree about what choosing a district means.

The trigger is a **render prop** because the two callers say different things
about the same state: the header names the chosen district, and the directory's
button exists precisely when there is none. `useDistrictSelection` is exported
beside the component so a third opener — a "near you" suggestion, say —
inherits the rule rather than restating it.

The dialog's own design is R22's and unchanged: a state is a heading nothing can
select, a district is a button, the state row filters and never selects, and
search is a flat list where every row names its state.

### C079 — `DistrictScope`

`components/search/district-scope/`. Props: `locations: PublicLocations`.
States: every district, one chosen, no districts. One consumer (`/cars`).
**NEW at R50.** **P2**

The `/cars` page's own opener for `DistrictPicker` (C071): a `Select district`
button with a hint when nothing is chosen, `Change district` beside
`District: Ranipet, Tamil Nadu` when something is. It adds no selection logic —
the header's selector and this button write the same `?district=` through the
same `useDistrictSelection`.

**R50 — the rule learned which page it is on.** `useDistrictSelection` now keeps
a buyer on `/cars` (and sends one on `/car/<slug>` there), and sends everything
else — home, a portfolio — to `/dealers`. Leaving the district drops `city`,
`dealer` and `page`, the three parameters that belonged to it. On `/cars` the
dialog counts **cars** (`PublicLocations.cars`) instead of dealerships.

### C069 — `LocationSelector`

`components/layout/location-selector.tsx`. Props: `locations: PublicLocations`.
States: all districts, one chosen, many states, many districts, searching,
state filtered, no state recorded, no districts. One consumer
(`CustomerHeader`).

The baseline's header switcher, restored as **districts** rather than cities —
see R11 for why that is the better question and not merely the one D6 left
available. A client component for two reasons, both unavoidable: the dialog's
open state, and `useSearchParams`, which is why it sits behind its own
`Suspense` boundary so the rest of the header still renders on the server.

**R23 — the trigger, and only the trigger.** The dialog and the selection rule
moved to `DistrictPicker` (C071) when the directory became a second opener. The
button reads **`Select district`** until one is chosen, where it read
`All districts`: a true description of what is on screen, and a poor description
of what the button is for. `All districts` is now the dialog's footer button,
where it is the way back and carries its count.

Choosing a district drops `city` and `page` from the query string, because
`?district=ranipet&city=katpadi` is an empty page. The choice applies
immediately and closes the dialog — there is no confirm step, and R22
deliberately did not add one.

**R19 — the rows, and the keys.** This was the only consumer of `.dd-nav-item`,
and it used the class for two revisions before the class existed: it was never
ported out of the baseline, so every option rendered unstyled and the chosen
row's `aria-current` had no rule to colour it.

**R22 — a dialog, grouped by state.** R19 also wrote down the panel's cost:
past ~15 districts it grew past the fold. That turned out to be the smaller
half of the problem. 38 districts in one flat column asks the reader to already
know which state each is in, and the reader who would ask is the one who does
not.

The component now renders a `Dialog` (C070) instead of an absolutely-positioned
panel, and the layout carries the hierarchy:

- a **state** is a heading — not focusable, no hover, no cursor change, nothing
  pressable. A state is not a place the product can be filtered to, so anything
  that looked clickable would be an invitation to a dead end. Its RTO code sits
  on a `Plate`, which stretches §4.5's enumeration of four plate uses by one and
  does so on the one motif that means "a registration authority said this";
- a **district** is a `<button>`, and the only selectable thing in the dialog.
  `aria-pressed`, a ✓ and the cobalt fill each say which one is chosen, so none
  of them is load-bearing alone (§4.15);
- the **state row** at the top filters and never selects, and is drawn only when
  there are two states or more;
- **search** switches to a flat list in which every row names its state.
  Grouping already makes the pairing visible; a flat filtered list of
  `Tirupattur / Mysuru / Bengaluru Urban` under four one-row headings would not.

`.dd-nav-item` has **no consumer** as of R22 — it went with the menu rows. It is
still the class the design spec defines for a menu row and the admin sidebar is
its next likely user, so it stays in `globals.css` rather than being deleted and
re-ported; it belongs in the dead-code register until then.

The state each district belongs to comes from `DistrictChip.state` on the
payload (**R22**), off the dealership's own address. Nothing in the UI infers a
state from a district's name, and there is nothing it could infer one from — D6
removed the table that held the pair. `lib/state-codes.ts` maps a state _name_
to its RTO code and returns `null` for anything it does not recognise; it adds
no place and no count.

### C070 — `Dialog`

|                      |                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/dialog.tsx`                                                                                                                                                                                           |
| **Purpose**          | DESIGN-SPEC §2.14. **New at R22** — the resolution of finding **D-C**, at the first consumer.                                                                                                                        |
| **Props**            | `open`, `onOpenChange`, `trigger` or `onCloseAutoFocus` (R49), `title`, `description?`, `closeLabel?`, `className?`, `contentClassName?`, `header?`, `footer?`, `children`, `variant?` (`card` \| `fullscreen`, R48) |
| **States**           | default 440px, with description, wide + scrolling, no footer, fullscreen (R48, the photo viewer)                                                                                                                     |
| **Consumers**        | `LocationSelector`, `DecisionDialog`, `ApproveDialog`, `GalleryViewer` (fullscreen)                                                                                                                                  |
| **Tests**            | `tests/unit/components/ui/dialog.test.tsx` — the contract only: modal, named, focus in, focus trapped, document inert, focus restored, close button named                                                            |
| **Ownership**        | Primitive                                                                                                                                                                                                            |
| **Sandbox priority** | **P0** — the trap and the focus restore are invisible with a mouse, and the width override is the thing a caller gets wrong                                                                                          |
| **Confidence**       | HIGH                                                                                                                                                                                                                 |

Radix underneath, the design system's classes on top. That direction matters: the
alternative is a hand-rolled trap, and every item on the list a modal has to get
right is a bug only a keyboard or screen-reader user meets.

**The trigger goes through Radix**, which is the one thing a caller can get
wrong. A modal `Content` cancels the focus-scope's own restore and focuses _its_
trigger, so a dialog opened by a button Radix does not know about closes with
focus on `<body>` and the next Tab starts at the top of the document. `trigger`
is a required prop for that reason. Open state stays the caller's, because most
dialogs close for a reason of their own.

**§2.14's `min(440px, 100%)` is a default, not a rule.** It is the right width
for the two dialogs the spec draws — a confirmation and a rejection reason. A
dialog whose content is a grid overrides it through `className`, which is what
`LocationSelector` does at 880px.

### C072 — `ServiceInput`

|                      |                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Location**         | `components/ui/service-input.tsx`                                                                                                                                                       |
| **Purpose**          | DESIGN-SPEC §2.5. **New at R37** — the services list entered one service at a time, as removable chips. Replaces the comma-separated `Input` on both screens that write `specialities`. |
| **Props**            | `id`, `name?`, `value: string[]`, `placeholder?`, `disabled?`, `required?`, `max?` (12), `maxLength?` (60), `aria-invalid?`, `aria-describedby?`                                        |
| **States**           | empty, one chip, several, wrapping to two rows, duplicate refused, over-length refused, at the 12 limit, disabled (R34), aria-invalid                                                   |
| **Dependencies**     | `Input` (C017), `Button` (C001), `Tag` (C011)                                                                                                                                           |
| **Consumers**        | 2 — `OnboardingWizard`'s business step (F037) and `DealerProfileForm` (F046)                                                                                                            |
| **Tests**            | `tests/unit/components/ui/service-input.test.tsx` — 14 cases, split between what the dealer sees and what the form submits                                                              |
| **Ownership**        | Shared                                                                                                                                                                                  |
| **Sandbox priority** | **P0** — Enter-does-not-submit, paste-splitting and the commit-on-submit are all invisible outside a real `<form>`                                                                      |
| **Confidence**       | HIGH                                                                                                                                                                                    |

**The hidden input is the whole compatibility story.** It carries
`services.join(', ')` under `name`, which is byte-for-byte what the comma box
submitted, so `servicesOf()` in the server actions is unchanged and the contract,
the route and the API never learn that the editor changed. A screen that has not
adopted it cannot disagree with one that has.

**The visible box has no `name`.** It is the draft, not the value, and a draft
must not be submittable — the same rule `LockedField` relies on at R27, and the
reason `required` sits on the _visible_ control: a browser cannot focus or
message a hidden one, so putting `required` there would produce a form that
silently refuses to submit with nothing highlighted.

**A draft the dealer typed but did not add is committed on submit.** Without it,
the most natural mistake on the screen — type a service, press Continue — loses
the last entry, and the loss is invisible until the dealer looks at their own
public page. It writes the hidden input's `value` directly, because a `setState`
in a submit handler has not flushed by the time the form serialises.

**The chip row is a `group`, not a `list`.** Every onboarding step already
contains one `<ol>` — the stepper — and a second list role makes
`getByRole('list')` ambiguous on a screen whose only list is meant to be the
progress indicator. The directory card's chip row is not a list either.

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

> ⚠️ **As landed (F075, scoped by R45).** `components/vehicle/vehicle-card/`
> — `VehicleCard`, `VehicleImage`, `DealerStrip`, `VehicleCardSkeleton`, one
> file each. Props are `vehicle: VehicleCardDto`, `variant?`, `priority?`,
> `className?`: **grid** and, since R48, **compact** (the portfolio card, no
> dealer strip) — no list variant, and **no save button and no sold state**. Saved
> cars (F087) are deferred, and a sold car is not public at all in this phase
> — only ACTIVE listings reach a buyer — so neither state is reachable yet.
> There is therefore no `useSavedCars` coupling (C-1). `VehicleImage` takes the
> DTO's `image: { url, alt } | null` and a `priority` flag rather than `sizes`:
> F034 is deferred, so there is one rendition per image and no srcset to size.
> Tested in `tests/unit/components/vehicle/vehicle-card.test.tsx`; sandbox
> `Vehicle/VehicleCard`.

> ⚠️ **R71 — the unavailable states.** `VehicleCardDto.availability` is
> `AVAILABLE`, `RESERVED`, `SOLD` or `UNAVAILABLE`. Anything but `AVAILABLE` is
> drawn greyed (`grayscale` + 60% opacity on the photograph, muted text), with
> `AvailabilityBadge` (C099) over the photograph, **and no link**: the title is
> plain text with a visually hidden "— Reserved for another buyer", so there is
> nothing to focus, tab to or press. The hover border is dropped with the link.
> `/cars` and the portfolio can only ever send `RESERVED`; `SOLD` and
> `UNAVAILABLE` exist for saved cars (R75). Stories `Reserved`, `Sold`,
> `NoLongerAvailable`, and a reserved card in `Grid`.

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
>
> **As landed (R48).** `components/vehicle/vehicle-gallery/` —
> `VehicleGallery` (`title`, `images`, `primaryIndex`), `GalleryViewer`,
> `GalleryArrow`. No strip; wrapping arrows and ←/→ on the page; the lightbox is
> `Dialog variant="fullscreen"`. Focus trap, return, Escape and scroll lock are
> now tested.
>
> **As corrected (R49).** The strip and the rail are back, per §2.9/§2.10:
> `GalleryStrip` (±240px, arrows disable at the ends), `GalleryViewer` (`DD`
> chip, title, counter, `Close ✕`, 4:3 stage, caption), `GalleryRail`
> (numbered cells, active one accented and scrolled into view), `GalleryArrow`
> (`placement`: `strip` | `stage`). The main image is a `.blueprint` with a
> "N photos · view all" tag. Focus returns to the exact opener.

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

`components/dealers/dealer-card.tsx:118`. Props: `dealer: DealerCardDto`.
States: verified/unverified, cover/no cover, tagline/none/overlong, 0–3+
services (sliced at 3), 0/1/n cars, long brand name. Deps: `ImageSlot`,
`LogoTile`, `Plate`, `Tag`. One consumer. Shared. **P1** ✅

> **R28 — the composition is `docs/Dealers-Drive-UI/Dealer-Card`.** A 128px
> cover carrying a `YARD VERIFIED` mark; an identity row of the 48px white logo
> tile and the `VERIFIED DEALER` plate, pulled up 24px so it straddles the
> cover's bottom edge; the name at full width underneath it; the tagline as a
> tinted pledge panel with an accent rule and `aria-hidden` quotation marks;
> the first service chip accented **by position, not by value** (**R29**; R28
> accented the third); and a footer that runs to the card's edges on a tint.
>
> Two things the reference asks for that the card deliberately does not do: it
> carries **no verification year** (nothing on the platform records when a yard
> was audited — see the `DealerCard` contract), and it **does not lift or cast a
> shadow on hover** (§4.1 gives shadows to the city dropdown, the dialog and the
> mobile sheet, and to nothing else). The border takes the accent instead.
>
> `Blueprint` left the card with R28 — the cover is a plain band now, and the
> four registration marks were never reserved for one (§2.6 is explicit that
> the frame is not for plain content cards).

> **R29 — the card is one click target, with no holes in it.** The heading's
> anchor is stretched over the card with `after:absolute after:inset-0`, and
> **nothing inside the card may carry a `z-index`**: two things did, and both
> were holes in the link rather than parts of it. The "View inventory →"
> affordance did nothing when clicked, and the identity row's 24px band did
> nothing either. The plate row still needs `relative` — it has to draw over the
> cover, which is positioned — but not a lift; document order does the rest. A
> `directory.test.tsx` case asserts the absence of `z-[` anywhere in the card,
> because that is the property a future decoration would quietly break.

> **R21 — the height is the card's own, and it is a constant.** `CARD_HEIGHT`
> is a hard `h-[400px]` (`h-[368px]` before R28 re-measured it for the taller
> cover and the pledge panel's padding); the name and the tagline are clamped to
> two lines each and the prose sits in a `flex-1 min-h-0 overflow-hidden` box. A
> consumer needs no row rule and should add none — R17's `grid-auto-rows: 1fr`
> was removed with the floor, because equal rows are now what the card produces
> rather than something a grid arranges. Changing the type scale or the tag
> padding means re-measuring the number against the `Fullest` sandbox story.

> **R34 — a dealer's public words are proposed, not published.** `C062d`
> `ProfileChangeReview` is the gate: the tagline and the service list are the
> only free text a dealer writes that a buyer reads, so on an ACTIVE dealership
> they go to a moderator rather than to the dealership row. Three components
> changed shape for it:
>
> · **`DealerProfileForm` (C044)** gained `ReviewPanel` — what is waiting, what
> is still live, on a refusal the moderator's sentence, and **`Cancel this
change`**. While a change waits the tagline and services boxes are `disabled`
> and hold the _proposed_ text, and carry no `name` — the R27 shape, so a locked
> box cannot reach the action even by accident. Cancel is the only way out:
> withdraw, and they unlock on the live values. A _refused_ change locks nothing
> and is not put back in the box, because the point is to write something
> different.
> · **`ProfileChangeReview` (C062d)** renders old beside new. A field the edit
> does not touch reads `unchanged` rather than blank — `[]` means "not part of
> this edit", and a blank row would read as _clearing the services_.
> · The **admin dealer list** gained a `Profile edit waiting` line under the
> name and a `Waiting on review` toggle, so the queue can be found from the
> page a moderator is already on.

> ⚠️ **Finding D-6 — naming.** The file is `dealer-card.tsx`; the export is
> `DirectoryCard`. Nothing named `DealerCard` exists in the UI — `DealerCard` is
> a _contracts DTO type_. A component search for "DealerCard" today returns a
> type, not a component. This is precisely the discovery failure the sandbox
> registry is meant to remove.

---

## Layer 6 — Feature components (`features/`)

Compressed to one row each. All are `'use client'` unless noted, all are
`features/`-owned, and — with the exceptions marked ✅ — **none has a test.**

| ID    | Component                            | Location                                                                                                                                     | Key props                                                                                                                                                              | States                                                                                                                                                                                                                        | Feature    | Priority                                  |
| ----- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| C040  | `OnboardingWizard`                   | `features/auth/onboarding-wizard.tsx:57`                                                                                                     | `step`, `session`, `documents`, `dealer`, `completeness`, `yardPhoto`, `phoneWidget` (**R39**), `googleLinkUrl`, `linkError` (**R61**) — ⚠️ `cities` removed by **D6** | 4 steps × valid/invalid/submitting, name-taken, business-with-tagline-and-services, changes-requested (×2), step 1 unproved / proved (**R39**), phone-first with Google missing / link refused (**R61**)                      | F037–F043  | **P0** ✅                                 |
| C040b | `PhoneVerification`                  | `features/auth/phone-verification.tsx`                                                                                                       | `widget: PhoneOtpWidget \| null`, `phone`, `fullName`, `verified`, `onVerified`, `onContinue`, `onBeforeSend`, `onRefused?`, `initialStage?`                           | send code, number already registered (before any send), code entry, refused (attempts left), attempts spent, verified, not configured, service unreachable                                                                    | R39        | **P0** ✅                                 |
| C041  | `DocumentUploader`                   | `features/auth/document-uploader.tsx:48`                                                                                                     | `document: DealerDocumentDto`                                                                                                                                          | empty, uploading, deleting, uploaded, verified, rejected, >5 MB, wrong MIME                                                                                                                                                   | F041       | **P0** ✅                                 |
| C041b | `YardPhotoUploader`                  | `features/auth/yard-photo-uploader.tsx:28`                                                                                                   | `photo: YardPhotoDto`                                                                                                                                                  | empty, uploaded, uploading, deleting, error                                                                                                                                                                                   | F041       | **P0** ✅                                 |
| C042  | ~~`AdminLoginForm`~~ — **removed**   | —                                                                                                                                            | —                                                                                                                                                                      | — the admin screen is `AuthShell` + `GoogleSignInButton`; there is no admin password to type                                                                                                                                  | F019       | —                                         |
| C043  | `SignOutButton`                      | `features/auth/sign-out.tsx:10`                                                                                                              | `scope?: 'dealer'\|'admin'`, `className?`                                                                                                                              | 2 scopes                                                                                                                                                                                                                      | F020       | P3                                        |
| C044  | `DealerProfileForm`                  | `features/dealer/profile-form.tsx:39`                                                                                                        | `dealer: DealerProfile`                                                                                                                                                | populated, sparse, saved, field refusal, server error, saving, map is a place / only a pin / unreadable (**R20**)                                                                                                             | F046       | **P1** ✅                                 |
| C045  | `VehicleWizard`                      | `features/vehicle/vehicle-wizard/vehicle-wizard.tsx` — **R45/R46**: `step`, `vehicle`, `saved?`, `cancelHref?`; no `catalog`, no `minPhotos` | 5 data steps (Registration → Basics → Details → Pricing → Review), **no Photos step**, draft saved, review complete / incomplete                                       | F063                                                                                                                                                                                                                          | **P0** ✅  |
| C046  | `RegistrationStep`                   | `features/vehicle/registration-step.tsx:33`                                                                                                  | `catalog: CatalogBundle`                                                                                                                                               | idle, looking-up, found, not-found, manual fallback, error                                                                                                                                                                    | F059       | **P0**                                    |
| C047  | `BasicsStep`                         | `features/vehicle/basics-step.tsx:33`                                                                                                        | `catalog`, `lookup?`, `prefillPlate?`                                                                                                                                  | from-RC, manual, errors                                                                                                                                                                                                       | F060       | P1                                        |
| C048  | `BasicsFields`                       | `features/vehicle/basics-fields.tsx:61`                                                                                                      | `catalog`, `value`, `onChange`, `errors`, `disabled?`                                                                                                                  | empty, prefilled, all-errors, disabled                                                                                                                                                                                        | F060       | **P0** ✅ (logic tested)                  |
| C049  | `DetailsFields`                      | `features/vehicle/details-fields.tsx:96`                                                                                                     | `catalog`, `value`, `onChange`, `errors`, `disabled?`                                                                                                                  | same, 8 required fields                                                                                                                                                                                                       | F061       | **P0** ✅ (logic tested)                  |
| C050  | `PhotoUploader`                      | `features/vehicle/photo-uploader.tsx:42`                                                                                                     | `vehicleId`, `media`, `minPhotos`                                                                                                                                      | empty, below-min, at-min, uploading, error, reorder, primary marker, delete                                                                                                                                                   | F062       | **P0**                                    |
| C051  | `RcSummary`                          | `features/vehicle/rc-summary.tsx:25`                                                                                                         | `lookup: RcLookupResponse`                                                                                                                                             | full match, partial, no alias match, cached                                                                                                                                                                                   | F059       | P1                                        |
| C052  | `InventoryActions`                   | `features/vehicle/inventory-actions.tsx:25`                                                                                                  | `row: InventoryRow`                                                                                                                                                    | menu closed/open, sold dialog, remove dialog, pending, error, notice                                                                                                                                                          | F067       | **P1**                                    |
| C052b | `InventoryView`                      | `features/dealer/inventory/inventory-view.tsx` — **R47**                                                                                     | `inventory: DealerInventoryResponse`, `status?`, `q?`                                                                                                                  | status tabs with counts, rows, empty, nothing matches                                                                                                                                                                         | F066       | **P0** ✅                                 |
| C053  | `EnquiryForm`                        | `features/enquiry/enquiry-form.tsx:21`                                                                                                       | `id`, `source`, `vehicleId?`, `dealerSlug?`, `dealerBrandName`, `heading?`, `intro?`, `messagePlaceholder?`                                                            | idle, field errors, submitting, rate-limited, sent                                                                                                                                                                            | F089       | **P0** ✅ (actions tested)                |
| C054  | `EnquiryInbox`                       | `features/enquiries/inbox.tsx:24`                                                                                                            | `initialCounts`, `initialStatus`, `initialData`                                                                                                                        | per-status tab × empty/loading/loaded/error                                                                                                                                                                                   | F091       | **P1**                                    |
| C055  | `SavedCarsList`                      | `features/saved/saved-list.tsx:19`                                                                                                           | `activeCount: number`                                                                                                                                                  | pre-hydration, empty, loading, loaded, some unavailable, error                                                                                                                                                                | F087       | **P1**                                    |
| C056  | `SavedCarsProvider` / `useSavedCars` | `features/saved/saved-store.tsx:43`, `:89`                                                                                                   | `children`                                                                                                                                                             | — (provider)                                                                                                                                                                                                                  | F087       | **P0** _(as a decorator, not a scenario)_ |
| C057  | `CreditPacks`                        | `features/billing/credit-packs.tsx:19`                                                                                                       | `packs: CreditPacksResponse`                                                                                                                                           | list, buying, success + invoice, failure                                                                                                                                                                                      | F051       | **P1**                                    |
| C058  | `ReportPanel`                        | `features/report/report-panel.tsx:21`                                                                                                        | `report`, `onRefresh?`, `refreshing?`, `refreshError?`                                                                                                                 | clean, warning, blacklisted, refreshing, refresh error                                                                                                                                                                        | F068       | **P1**                                    |
| C059  | `ReportSummary`                      | `features/report/report-summary.tsx:29`                                                                                                      | `report: VehicleReportSummary`                                                                                                                                         | per verdict tone                                                                                                                                                                                                              | F068       | **P1**                                    |
| C060  | `ReviewActions`                      | `features/admin/review-actions.tsx:24`                                                                                                       | `listing: AdminListingDetail`                                                                                                                                          | per listing status × pending × error; uses **Radix Dialog**                                                                                                                                                                   | F070       | **P0**                                    |
| C060b | `ListingReview`                      | `features/admin/listing-review/listing-review.tsx` — **R45/R47**, replaces C060 and C063                                                     | `detail: AdminListingDetail`                                                                                                                                           | pending review, resubmission (checks cleared), read-only, photography panel                                                                                                                                                   | F070       | **P0** ✅                                 |
| C061  | `QueueApproveButton`                 | `features/admin/queue-actions.tsx:15`                                                                                                        | `listingId`, `title`                                                                                                                                                   | idle, pending, error                                                                                                                                                                                                          | F069       | P2                                        |
| C061b | `ModerationQueue`                    | `features/admin/moderation-queue/moderation-queue.tsx` — **R45**: no one-click approve                                                       | `listings: AdminListingsResponse`, `q?`                                                                                                                                | waiting, queue clear, nothing matches; photography tag and image count per row                                                                                                                                                | F069       | **P0** ✅                                 |
| C062  | `DealerAdminActions`                 | `features/admin/dealer-actions.tsx:36`                                                                                                       | `dealer: AdminDealerDetail`                                                                                                                                            | per dealer status × approve (typed action + dealership name, KYC required) × request changes × close (reason) × reject (disclosure + name confirmation) × suspend form × reinstate × pending × error — grant form at **F054** | F045       | **P0** ✅                                 |
| C062b | `DocumentReview`                     | `features/admin/document-review.tsx:32`                                                                                                      | `documents: AdminDealerDetail['documents']`                                                                                                                            | awaiting decision, verified, rejected, not uploaded, rejecting, in flight, empty                                                                                                                                              | F044       | **P0** ✅                                 |
| C062c | `DealerProfileEditor`                | `features/admin/dealer-profile-editor.tsx`                                                                                                   | `dealer: AdminDealerDetail`                                                                                                                                            | reading, with gaps, editing, read-only seat, saving, server refusal                                                                                                                                                           | F045, R32  | **P0** ✅                                 |
| C062d | `ProfileChangeReview`                | `features/admin/profile-change-review.tsx`                                                                                                   | `change: AdminProfileChange`                                                                                                                                           | both fields, phone number in the tagline, services only, tagline only, nothing live, refusing, already decided, deciding                                                                                                      | R34        | **P0** ✅                                 |
| C063  | `ModerationStrip`                    | `features/admin/moderation-strip.tsx:12`                                                                                                     | `photos: {id,position,label,url}[]`                                                                                                                                    | 0, 1, 12 photos                                                                                                                                                                                                               | F070       | P2                                        |
| C063b | `ListingImages`                      | `features/admin/listing-images/listing-images.tsx` — **R45**: admin upload of the processed images; dealers never see it                     | `listingId`, `images: AdminVehicleImages`                                                                                                                              | none yet, below minimum, ready to approve, full (20), read-only, uploading, per-file errors, move ← / →, make primary                                                                                                         | F035, F070 | **P0** ✅                                 |
| C064  | `ConfigRow`                          | `features/admin/config-editor.tsx`                                                                                                           | `entry: ConfigEntry`                                                                                                                                                   | number/boolean/string-list × clean/dirty/saving/saved/error, **plus the placeholder — a key nothing reads yet renders read-only**                                                                                             | F072       | **P1** ✅                                 |
| C064b | `AdminAccessPanel`                   | `features/admin/admin-access.tsx`                                                                                                            | `entries: AdminAccessEntry[]`, `currentUserId`                                                                                                                         | allow-listed only, allow-listed + granted, your own row, an address nobody has signed in with, granting, refused                                                                                                              | R42        | **P1** ✅                                 |
| C065  | `QueryProvider`                      | `features/query/query-provider.tsx:16`                                                                                                       | `children`                                                                                                                                                             | — (provider)                                                                                                                                                                                                                  | F091       | _(decorator)_                             |

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
| §2.14 Dialog   | `.dialog` / `.dialog-backdrop` | `Dialog` — **created at R22** | **0**                  |

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
not the control); `Dialog` at **R22**, at its first consumer and as the
resolution of finding D-C. `Card` is the one still open.

### D-C — `.dialog` CSS is dead; Radix is the real implementation

`.dialog` and `.dialog-backdrop` (24 lines of `globals.css`) have **zero**
consumers. `ReviewActions` uses `@radix-ui/react-dialog` instead. Two dialog
strategies, one of them dead. **Risk: MEDIUM** — the next developer who needs a
dialog will pick the wrong one.

**Resolved at R22**, and by the recommendation two sections above rather than by
choosing between the two: `Dialog` (C070) is Radix wearing `.dialog`, so there
is one strategy and the CSS has a consumer. It landed with its first consumer
(`LocationSelector`), which is the only moment this costs nothing.

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
| `.dd-nav-item`                            | `globals.css`                      | zero consumers since R22  |
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

### C083 — `PhoneSignIn` · C084 `LoginTabs` · C085 `CustomerLogin` · C086 `CustomerNameStep` · C087 `DealerLogin`

**New at R63** — the unified Login. `PhoneSignIn` (`features/auth/phone-sign-in/`)
is the shared phone form: number, Send OTP, then `PhoneCodePanel` (C040b's,
extended with `verifyLabel`); `onProved(phone, token)` answers an error or
`null`, and the caller decides what a proved number means. The other four
live in `features/auth/login/`: `LoginTabs` is the `.seg` Customer / Dealer
switch with tab semantics and roving focus; `CustomerLogin` proves the number
and either returns or hands over to `CustomerNameStep` (one Name field);
`DealerLogin` is Google plus `PhoneSignIn`.

| Component          | Props                                                                              | States                                                          |
| ------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `PhoneSignIn`      | `widget`, `idPrefix`, `onProved`, `verifyLabel?`, `initialStage?`, `initialPhone?` | number · invalid number · code entry · refused · not configured |
| `LoginTabs`        | `initial`, `customer`, `dealer`                                                    | customer · dealer                                               |
| `CustomerLogin`    | `widget`, `returnTo`                                                               | number · code · name required · unavailable                     |
| `CustomerNameStep` | `phoneDisplay`, `onCreated`, `onRestart`                                           | empty · refused · ticket expired · creating                     |
| `DealerLogin`      | `widget`, `google`, `returnTo`, `error`                                            | Google + phone · Google refused · Google not configured         |

**Changed:** `PhoneCodePanel` gains `verifyLabel?`; `PhoneUnavailable` gains
`tail?` (the onboarding sentence stays the default). **Consumers:** the
`/login` page. **Tests** `apps/web/tests/unit/features/auth/login.test.tsx`,
`apps/web/tests/unit/app/login-page.test.tsx`. **Sandbox** `Forms/Login`,
`Forms/PhoneSignIn`.

### C088 — `EnquiryPanel` · C089 `EnquiryForm`

**New at R65** — Enquire on the vehicle page (`features/enquiry/enquiry-panel/`).
`EnquiryPanel` is the button, the sign-in interruption and the outcome banners;
it asks who is signed in only when pressed, so the page stays static.
`EnquiryForm` shows the customer's name and verified mobile read-only and takes
an optional message; `EnquireFromUrl` is the `?enquire=1` reader the page puts
under `Suspense`.

| Component      | Props                                          | States                                                                 |
| -------------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| `EnquiryPanel` | `listingSlug`, `dealerName`, `autoOpen?`       | idle · checking · form · sent · already enquired · no longer available |
| `EnquiryForm`  | `customer`, `dealerName`, `onSend`, `onCancel` | empty · sending · refused                                              |

**Reuses** `Button`, `Banner`, `StatusTag`, the `.field` / `.input` classes.
**Consumers:** `/car/[slug]`. **Tests**
`apps/web/tests/unit/features/enquiry/enquiry-panel.test.tsx`,
`actions.test.ts`. **Sandbox** `Vehicle/EnquiryPanel`.

### C090 — `EnquiryInbox` · C091 `EnquiryCard` · C092 `EnquiryStatusActions`

**New at R66**, replacing the baseline's C054 `EnquiryInbox` and C065
`QueryProvider` (`features/dealer/enquiries/`). Server-rendered, like
`InventoryView`: the tabs and Show more are links, and the only client
component is `EnquiryStatusActions`, which calls a Server Action — so coupling
C-2 (`@tanstack/react-query`) no longer applies.

| Component              | Props                                 | States                                                                |
| ---------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `EnquiryInbox`         | `inbox`, `status`                     | new · contacted · closed · spam · empty per tab · more pages · mobile |
| `EnquiryCard`          | `enquiry`                             | with message · no message · car off the marketplace · number gone     |
| `EnquiryStatusActions` | `enquiryId`, `status`, `customerName` | moves per status · moving · refused                                   |

**Reuses** `Avatar`, `StatusTag`, `Button`, `EmptyState`, the `.seg` tabs.
**Consumers:** `/dealer/enquiries`. **Tests**
`apps/web/tests/unit/features/dealer/enquiries-page.test.tsx`,
`enquiry-actions.test.ts`. **Sandbox** `Dealer/EnquiryInbox`.

### C093 — `HeaderAccount` · C020 `CustomerHeader` gains `account`

**New at R67** (`features/auth/header-account/`). The account corner of the
customer header: Login, or "Hi, first name" and Logout (initials below `sm`)
for a signed-in customer, asked once in the browser through
`customerAccountAction` so the public pages stay static. `CustomerHeader`
takes it through a new optional `account` slot and renders the plain Login
link without one; below `sm` its wordmark is visually hidden so the header
fits at 375 (§3.1).

| Component        | Props                   | States                                                          |
| ---------------- | ----------------------- | --------------------------------------------------------------- |
| `HeaderAccount`  | —                       | signed out · signed in · long name at phone width · logging out |
| `CustomerHeader` | `locations`, `account?` | + signed-in customer                                            |

`RecentEnquiries` (dashboard panels) gains the `All enquiries →` link and a
no-number state. **Tests** `apps/web/tests/unit/features/auth/header-account.test.tsx`,
`customer-account-actions.test.ts`. **Sandbox** `Layout/CustomerHeader`,
`Dealer/DashboardPanels`.

### C094 — `CustomerEnquiryList` · C095 `CustomerEnquiryCard`

**New at R68** (`features/enquiry/customer-enquiries/`). My enquiries on
`/enquiries`: a customer's own enquiries, read-only and current state only —
Sent, Contacted or Closed; the API shows spam as Closed. Server-rendered, no
client state, nothing to press.

| Component             | Props       | States                                                    |
| --------------------- | ----------- | --------------------------------------------------------- |
| `CustomerEnquiryList` | `enquiries` | every state · empty · more pages · mobile                 |
| `CustomerEnquiryCard` | `enquiry`   | sent · contacted · closed · no message · no longer listed |

**Changed:** `EnquiryPanel` (C088) shows "Requires login with your mobile
number" until it knows the visitor is signed in, and links its sent and
already-open banners to `/enquiries`; `HeaderAccount` (C093) links to
`/enquiries`. **Reuses** `StatusTag`, `EmptyState`, `ButtonLink`. **Tests**
`apps/web/tests/unit/features/enquiry/my-enquiries-page.test.tsx`. **Sandbox**
`Vehicle/CustomerEnquiryList`.

### C096 — `ListingLifecycleActions` · C097 `LifecycleDialog` · C098 `ListingLifecyclePanel`

**New at R70** (`features/dealer/listing-lifecycle/`), the console half of
F067 as R69 redefines it. `ListingLifecycleActions` renders only the moves the
API lists in `listing.actions` — so it can never offer one the server would
refuse — each as a `LifecycleDialog` on the `Dialog` primitive calling the
`listingLifecycleAction` Server Action. Withdraw asks for a reason (required)
and a private note. `ListingLifecyclePanel` sits under the read-only review on
a live vehicle's page.

**Revised by the reactivation review.** The moves are Mark reserved, Mark sold,
Withdraw and Request reactivation; there is no Make active or Relist, because a
reserved or withdrawn car goes back on sale only on an admin's approval.
`reactivationPending` replaces a second request with a _Reactivation pending
approval_ tag, and the panel shows a declined request with the admin's note.

| Component                 | Props                                                                              | States                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ListingLifecycleActions` | `vehicleId`, `vehicleTitle`, `actions`, `reactivationPending?`, `size?`, `submit?` | active · reserved · withdrawn · reactivation pending · sold (renders nothing) · row size · refused |
| `LifecycleDialog`         | `vehicleId`, `action`, `size`, `submit`                                            | open · withdraw without a reason · reactivation note · pending · refused                           |
| `ListingLifecyclePanel`   | `vehicleId`, `vehicleTitle`, `listing`                                             | live (View on site) · withdrawn with reason and note · reactivation pending / declined · sold      |

**Changed:** `InventoryRow` and `InventoryCard` render the actions (the card is
no longer one link — the link is its upper part, so the buttons are not nested
in an anchor); `VehicleWizard`'s locked view renders the panel. **Reuses**
`Dialog`, `Button`, `ButtonLink`, `Field`, `Select`, `Textarea`, `Banner`.
**Tests** `apps/web/tests/unit/features/dealer/listing-lifecycle.test.tsx`,
`listing-lifecycle-actions.test.ts`, `inventory-page.test.tsx`. **Sandbox**
`Dealer/ListingLifecycleActions`, `Dealer/InventoryView`; the Server Action is
stubbed by `apps/sandbox/src/mocks/listing-lifecycle-actions.ts`.

### C112 — `ReactivationQueue` · C113 — `ModerationTabs`

**New with the reactivation review** (`features/admin/moderation-queue/`). A
dealer's request to put a reserved or withdrawn car back on sale is decided on
a tab of `/admin/listings` (`?view=reactivation`): vehicle (linked to its review
screen), dealer (linked), where the listing stands now, the move asked for
(`Reserved → Active`), when, and the dealer's note. A pending row offers Approve
and Decline, each a `DecisionDialog` in its new `optional` mode (an optional note
to the dealer, no six-character floor); a decided row shows the outcome and the
note. `ModerationTabs` is the status tab bar, lifted out of `ModerationQueue` so
both views share it, with the Reactivation requests tab and its count.

| Component           | Props                                              | States                                   |
| ------------------- | -------------------------------------------------- | ---------------------------------------- |
| `ReactivationQueue` | `requests`, `listingCounts`, `approve?`, `reject?` | waiting · declined · nothing waiting     |
| `ModerationTabs`    | `active`, `counts`, `reactivationPending`, `q?`    | a listing status · reactivation requests |

**Changed:** `DecisionDialog` gains `optional`, `primary`, `reasonLabel`,
`reasonHint` and `size` (the listing review's uses are unchanged by default);
`ModerationQueue` renders `ModerationTabs`. **Tests**
`apps/web/tests/unit/features/admin/reactivation-queue.test.tsx`,
`listings-page.test.tsx`. **Sandbox** `Admin/ReactivationQueue`; the Server
Actions are stubbed by `apps/sandbox/src/mocks/listing-actions.ts`.

### C126 — `SupportQueue` · C127 — `SupportTicketWorkspace`

**New at R91** (`features/admin/support-queue/`, `features/admin/support-ticket/`).
`SupportQueue` is `/admin/support`: status tabs, search and category / priority /
assignee / created-day filters, a ticket table and keyset paging.
`SupportTicketWorkspace` is `/admin/support/[id]`: conversation
(`TicketConversation`), composer (`TicketComposer`, Reply to customer vs an amber
Internal note), internal notes (`TicketNotes`), history (`TicketHistory`), ticket
controls (`TicketControls`: status limited to allowed moves, priority, assignee,
Assign to me), customer, related enquiry, car and dealer.

| Component                | Props                | States                                         |
| ------------------------ | -------------------- | ---------------------------------------------- |
| `SupportQueue`           | `tickets`, `filters` | queue · filtered · none at all · none matching |
| `SupportTicketWorkspace` | `ticket`, `viewerId` | working · unassigned · no enquiry · closed     |

**Changed:** `AdminNav` gains Support Tickets above Configuration;
`EnquiryDetail` gains `EnquiryTickets` (the tickets referencing the enquiry);
`SupportMessageBubble` gains `side`, so the console can put support on the right.
**Reuses** `Table`, `StatusTag`, `EmptyState`, `Input`, `Select`, `Textarea`,
`Button`, `DetailRow`, `EnquiryVehicleCard`, `AdminListLoading`. **Tests**
`apps/web/tests/unit/features/admin/support-tickets.test.tsx`,
`enquiry-oversight.test.tsx`, `dashboard-page.test.tsx`. **Sandbox**
`Admin/SupportQueue`, `Admin/SupportTicketWorkspace`, `Admin/EnquiryDetail`,
`Admin/AdminNav`; the Server Actions are stubbed by
`apps/sandbox/src/mocks/admin-support-actions.ts`.

### C122 — `SupportRequestList` · C123 — `SupportRequestForm` · C124 — `SupportRequestDetail` · C125 — `SupportRequestCallout`

**New at R90** (`features/support/support-requests/`, `features/support/support-page/`).
A customer's support requests, in one area. `SupportRequestList` is
`/support-requests`: a card per request (reference, subject, status, topic, last
updated), Create support request, and an empty state. `SupportRequestForm` is
`/support-requests/new`: topic, the customer's own enquiry for the topics it
helps, subject and description; field errors beside their fields, one request per
press. `SupportRequestDetail` is `/support-requests/[id]`: the request, its
enquiry, the conversation (`SupportMessageBubble`) and `SupportReplyForm`, or a
pointer to a new request once closed. `SupportRequestCallout` leads `/contact`.

| Component               | Props                                                           | States                                                 |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `SupportRequestList`    | `tickets`                                                       | requests · none yet · with more                        |
| `SupportRequestForm`    | `enquiries`, `initialCategory?`, `initialEnquiryId?`, `submit?` | empty · about an enquiry · no enquiries yet · refused  |
| `SupportRequestDetail`  | `ticket`                                                        | awaiting your reply · just created · resolved · closed |
| `SupportRequestCallout` | —                                                               | default                                                |

**Changed:** `SupportPage` leads with `SupportRequestCallout` and heads the
contact cards "Other ways to reach us"; `AccountMenu` gains Support requests after
My enquiries; `CustomerEnquiryCard` gains Get help with this enquiry. **Reuses**
`Field`, `Select`, `Input`, `Textarea`, `Button`, `ButtonLink`, `StatusTag`,
`EmptyState`, `SkeletonLines`. **Tests**
`apps/web/tests/unit/features/support/support-requests.test.tsx`,
`support-page.test.tsx`, `header-account.test.tsx`, `my-enquiries-page.test.tsx`.
**Sandbox** `Support/SupportRequestList`, `Support/SupportRequestForm`,
`Support/SupportRequestDetail`, `Layout/SupportPage`; the Server Actions are
stubbed by `apps/sandbox/src/mocks/support-actions.ts`.

### C119 — `EnquiryOversight` · C120 — `EnquiryDetail` · C121 — `AdminListLoading`

**New at R89** (`features/admin/enquiry-oversight/`, `features/admin/enquiry-detail/`,
`components/admin/admin-list-loading/`). The admin's read-only view of every
customer enquiry. `EnquiryOversight` is `/admin/enquiries`: status tabs with
counts, a GET search form with a sent-from/to day range, a removable dealer chip,
a narrow table (customer + verified mobile, vehicle + plate + listing status when
not active, dealer — which filters to that dealership — a truncated message
preview hidden below `xl`, status, received time) and keyset Show more.
`EnquiryDetail` is `/admin/enquiries/[id]`: message and status (with what the
customer sees), customer, dealership, the car (`EnquiryVehicleCard`) and the
audit-trail history (`EnquiryHistory`), with no control that changes the
enquiry. `AdminListLoading`/`AdminDetailLoading` are the routes' `loading.tsx`.

| Component          | Props                  | States                                                                       |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------- |
| `EnquiryOversight` | `enquiries`, `filters` | list · filtered by dealer and search · unknown dealer · none · none matching |
| `EnquiryDetail`    | `enquiry`              | spam, sold car, photograph · nothing on file                                 |
| `AdminListLoading` | —                      | list · detail (`AdminDetailLoading`)                                         |

**Changed:** `AdminNav` gains Enquiries above Configuration. **Reuses** `Table`,
`StatusTag`, `EmptyState`, `Input`, `SkeletonLines`, the `seg` tabs and
`dd-chip`. **Tests** `apps/web/tests/unit/features/admin/enquiry-oversight.test.tsx`,
`dashboard-page.test.tsx`. **Sandbox** `Admin/EnquiryOversight`,
`Admin/EnquiryDetail`, `Admin/AdminListLoading`, `Admin/AdminNav` (Enquiries).

### C099 — `AvailabilityBadge` · C100 — `AvailabilityNotice`

**New at R71.** `AvailabilityBadge` (`components/vehicle/vehicle-card/`) is the
Reserved / Sold / No longer available corner label; `VehicleCard` places it over
the photograph, and the vehicle page places it beside the year plate with
`className="static"`. `AvailabilityNotice` (`components/vehicle/availability-notice/`)
replaces the enquiry panel on a reserved car's page: a warn `Banner` saying
enquiries are paused, and **Browse available cars**. **Reuses** `Banner`,
`ButtonLink`. **Tests** `vehicle-card.test.tsx`, `vehicle-page.test.tsx`.
**Sandbox** `Vehicle/VehicleCard` (Reserved), `Vehicle/AvailabilityNotice`.

### C102 — `DiscoveryRow`

**New at R72** (`features/home/`), the F081 homepage as an entry into `/cars`.
C101 `HeroSearch` sat beside it until **R79**, which replaced the four-field
hero with `CarSearchBox` (C082) and removed it.

`DiscoveryRow` is a server component: a heading, **View all →** (no count since
R78) to the same filters on `/cars`, and up to four `VehicleCard`s. It renders
nothing when empty.

| Component      | Props                         | States                                  |
| -------------- | ----------------------------- | --------------------------------------- |
| `DiscoveryRow` | `id`, `title`, `href`, `cars` | four · fewer · empty (nothing) · mobile |

**Reuses** `VehicleCard`, `searchHref`. **Tests**
`apps/web/tests/unit/features/home/home-page.test.tsx`. **Sandbox**
`Home/DiscoveryRow`.

### C103 — `SimilarVehicles`

**New at R73** (`components/vehicle/similar-vehicles/`), landing F084. A
`section` titled "Similar vehicles" at the foot of `/car/[slug]`: a grid of the
shared `VehicleCard`. It uses the grid variant, with the dealer strip, because
these are usually other dealerships' cars. The legacy entry named
`variant="compact"`, but compact is the portfolio's card without a dealer, and
that would be wrong here. It renders nothing when the list is empty, and the
page leaves out even its margin.

| Component         | Props      | States                                 |
| ----------------- | ---------- | -------------------------------------- |
| `SimilarVehicles` | `vehicles` | four · fewer · none (nothing) · mobile |

**Tests** `apps/web/tests/unit/components/vehicle/vehicle-page.test.tsx`.
**Sandbox** `Vehicle/SimilarVehicles`.

### C104 — `SaveButton` · C105 — `SavedVehiclesProvider` · C106 — `SavedList`

**New at R75**, the UI of saved cars (F087 as revised by R74).

`SaveButton` (`components/vehicle/save-button/`) is the heart. It appears as
the `overlay` variant on every `VehicleCard`, top-right over the photograph and
above the card's stretched link, and as the `labelled` variant ("Save" /
"Saved") under the price on the vehicle page. It reads `SavedVehiclesContext`,
whose default is "disabled", so **without a provider it renders nothing** — no
throwing hook, unlike the baseline's `useSavedCars()`, so coupling C-1 does not
return. `AvailabilityBadge` moves to the photograph's bottom-left to make room.

`SavedVehiclesProvider` (`features/saved/`) wraps the public layout:

- loads the saved slugs once through `savedSlugsAction`
- toggles optimistically and rolls back on a refusal, announcing it in a
  polite live region
- sends a signed-out visitor to `/login?returnTo=<page>?save=<slug>`
- completes that save on return, through `SaveFromUrl` in its own `Suspense`,
  so no public page is forced to render on the client

`SavedList` renders `/saved`.

| Component               | Props                                     | States                                                      |
| ----------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `SaveButton`            | `slug`, `title`, `variant?`, `className?` | not saved · saved · labelled · pending · refused · on cards |
| `SavedVehiclesProvider` | `children`, `loadSlugs?`, `setSaved?`     | customer · anonymous · unknown                              |
| `SavedList`             | `saved`                                   | every state · only available · empty · more pages · mobile  |

**Tests:**

- `apps/web/tests/unit/features/saved/saved-cars.test.tsx`
- `saved-actions.test.ts`

**Sandbox:**

- `Vehicle/SaveButton`, with a provider decorator
- `Vehicle/SavedList`
- The actions are stubbed by `apps/sandbox/src/mocks/saved-actions.ts`.

### C107 — `AccountMenu` · C093 `HeaderAccount` becomes a menu

**New at R76** (`features/auth/header-account/account-menu.tsx`). A signed-in
customer's header corner is no longer "Hi, name · My enquiries · Logout". It is
a single **36px round avatar** with their initials, at every width.

- **Initials:** `personInitials()` in `lib/person.ts`, first and last name, at
  most two letters, so "Rahul" is R and "John Doe" is JD. It takes the brand
  accent tint, never a per-user colour.
- **The menu:** the avatar opens a Radix `Popover` (already a dependency)
  holding the name, the mobile masked by `maskIndianMobile()` (`+91 98XXXXXX12`),
  then **Saved cars**, **My enquiries**, a separator, and **Logout**.
- **Semantics:** the trigger is `aria-haspopup="menu"` with `aria-expanded`.
  The list is `role="menu"` with `menuitem`s; opening focuses the first item.
- **Keyboard:** ↑/↓ wrap, Home and End jump to the ends, and Escape closes and
  returns focus to the avatar. A click outside closes it, and choosing a
  destination closes it.

| Component       | Props                               | States                                                                                        |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `AccountMenu`   | `account`, `onLogout`, `loggingOut` | closed · open (Saved cars · My enquiries · Dealer Login · Logout) · logging out · phone width |
| `HeaderAccount` | —                                   | signed out (Login) · signed in (avatar)                                                       |

`CustomerAccount` gains `phoneMasked`; the raw number never reaches the
browser. `firstNameOf` is gone with the greeting. **Tests**
`apps/web/tests/unit/features/auth/header-account.test.tsx`,
`customer-account-actions.test.ts`. **Sandbox** `Layout/CustomerHeader`
(`SignedInCustomer`, `SignedInCustomerMobile`).

### R81 — the UI revamp: tokens, shell, cards, login, and C108–C110

**R81** re-skins the product to the revamped prototype (neutral-first, Manrope,
black primary actions, rounded surfaces) without changing behaviour. Most of it
is `globals.css`: the accent scale now maps to neutrals, `--radius-*` grow, the
`.blueprint` corner marks are hidden, and `.dd-chip` is the pill used for town,
status and home shortcuts. Components that changed shape:

- **C093/C107 `HeaderAccount` / `AccountMenu`** — a 40px black avatar; the menu
  items are unchanged. **Saved cars** leaves the top bar: it is reached from the
  account menu and the footer.
- **`CustomerHeader`** — Buy cars and Dealers only; active link underlined as
  well as dark (not colour alone).
- **`VehicleCard`** — `h-full`, a fixed image ratio, a two-line title slot, a
  two-line meta slot and the dealer strip pinned to the bottom, so every card
  in a row lines up whatever its data.
- **`DirectoryCard`** — **no tagline and no "View inventory →"**. Still one
  stretched link over the whole card; a focus ring is drawn on the card while
  its link has keyboard focus. Fixed height is now 330px.
- **`LoginTabs`** — a compact Customer ⟷ Dealer switch; still a `tablist` with
  two `tab`s, arrow keys, Home and End. **`DealerLogin`** leads with Google and
  discloses the phone form behind "Use mobile number instead" (shown at once
  when Google is not configured).
- **`StatCard`** — `inverse` for the dashboard's credits tile.
- **Homepage hero** — the "How it works" trust panel is replaced by **C111
  `HeroBanner`**, a single full-width photograph banner. The photograph is the
  `image` prop: the committed `home-hero.webp` by default, or the photograph
  set in `/admin/config` (`home.heroImageUrl` / `home.heroImageAlt`) — see
  `docs/code/web/features/home.md`.

| Component          | Props                                          | States                                                              |
| ------------------ | ---------------------------------------------- | ------------------------------------------------------------------- |
| C108 `SupportPage` | `support`                                      | default · WhatsApp not configured · fallback · long address · phone |
| C109 `SupportCard` | `icon`, `title`, `body`, `headingId`, children | default                                                             |
| C110 `EntryShell`  | `children`                                     | desktop (story panel) · phone width (form only)                     |
| C111 `HeroBanner`  | `image`, children                              | no photograph (dark ground) · with photograph · phone width         |

`/contact` renders `SupportPage` from `GET /v1/config/public`'s `support`
object, which reads five `support.*` keys an operator edits in `/admin/config`
and falls back to `SUPPORT_EMAIL` / `SUPPORT_PHONE`. **Tests**
`apps/web/tests/unit/features/support/support-page.test.tsx`,
`apps/api/tests/unit/modules/config/config.service.test.ts`. **Sandbox**
`Layout/SupportPage`, `Auth/EntryShell`.

### R101 — C135 `LinkPendingIndicator` · `LinkPendingLabel` · C136 `ConsolePageLoading` and the page skeletons

**C135 `LinkPendingIndicator`** (`components/ui/link-pending/`) — the `Button`
spinner inside a `<Link>` while its navigation is pending (`useLinkStatus`),
faded in after 120ms. Props: `className` (a complete box, `size-[..]` included),
`reserve` (keep a 14px box while idle). States: idle, idle-reserved, pending.
Consumers: `ConsoleNav`, `ConsoleTabBar`, `HeaderLink`, `VehicleCard`,
`DirectoryCard`.

**`LinkPendingLabel`** — the button-shaped variant: the label stays, invisible,
under a centred spinner, so the button keeps its width. Consumers: `ButtonLink`
(so every `ButtonLink` gets it), and every `<Link className="btn …">` /
`.dd-chip` link across the public pages, the console and admin.

**C136 `ConsolePageLoading`** and its siblings `VehiclePageLoading`,
`DealerPageLoading`, `CustomerEnquiriesLoading`, `SavedListLoading` — the
`loading.tsx` skeletons for the console, `/car/[slug]`, `/dealers/[slug]`,
`/enquiries` and `/saved`. No props; each is a `role="status"` on its page's own
grid, built from `.skeleton`, `SkeletonLines` and `VehicleCardSkeleton`.

**Changed:** `ButtonLink` (adds `relative` + `LinkPendingLabel`), `ConsoleNav`
(label wrapped, reserved indicator box). `Spinner` is now exported from the
button barrel. Sandbox: `Primitives/LinkPending`, `Primitives/PageLoading`.

### R102 — `WizardFooter` and `SaveRow` take `pending`

The vehicle wizard's and the dealer profile's forms submit through
`useNavigationSafeFormAction`, not a form action, so there is no form status for
`useFormStatus` to read: `WizardFooter`, `SubmitRow`'s button and `SaveRow` take
`pending` as a prop. No visual change.

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
