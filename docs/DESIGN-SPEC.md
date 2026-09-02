# Dealers-Drive — Developer Handoff Specification

MVP v0.1 · source of truth: `Dealers-Drive.dc.html` + `ds/industry.css`
Base system: Industry, retuned to the Dealers-Drive cobalt palette.
Stack assumption: React/Next.js + Tailwind (map tokens to `theme.extend`).

---

## 1. Tokens

### 1.1 Colour — primitives

**Cobalt ramp** (brand; the only decorative colour in the product)

| Token                | Hex       | Used for                                                                                                                                                        |
| -------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--color-accent-100` | `#eef2ff` | Dealer-logo tiles, credit-balance card fill, review-summary panel, grid-column demo fill                                                                        |
| `--color-accent-200` | `#dbe3ff` | 20px dealer avatar chips on vehicle cards, spacing-scale swatch fill                                                                                            |
| `--color-accent-300` | `#b9c8ff` | Spacing swatch fill, grid-column borders                                                                                                                        |
| `--color-accent-400` | `#8ba3f7` | Pressed state on dark grounds only (unused in MVP)                                                                                                              |
| `--color-accent-500` | `#5a79ec` | — reserved                                                                                                                                                      |
| `--color-accent-600` | `#2f55dd` | **Action/Primary base** = `--color-accent`; primary button, focus ring, links, active nav, plate left band, chart bars, progress fill, active thumbnail outline |
| `--color-accent-700` | `#1e3fae` | Primary button `:active`; accent text at paragraph size (kickers, device label)                                                                                 |
| `--color-accent-800` | `#172f7d` | Text on `accent-100`/`accent-200` fills (avatar initials, tag text)                                                                                             |
| `--color-accent-900` | `#101f4f` | Full-field grounds: "Why Dealers-Drive" band, admin sidebar                                                                                                     |

**Neutral ramp** (inherited from Industry, unchanged)

| Token                 | Hex       | Used for                                            |
| --------------------- | --------- | --------------------------------------------------- |
| `--color-neutral-100` | `#f5f5f8` | Admin app ground, `.tag-neutral` fill               |
| `--color-neutral-200` | `#e7e7ea` | Draft/Expired badge fill                            |
| `--color-neutral-300` | `#d4d4d7` | Skeleton bars, stepper inactive bar, progress track |
| `--color-neutral-400` | `#b7b7ba` | Scrollbar thumb                                     |
| `--color-neutral-500` | `#98989b` | —                                                   |
| `--color-neutral-600` | `#7a7a7d` | —                                                   |
| `--color-neutral-700` | `#5d5d60` | Expired badge text                                  |
| `--color-neutral-800` | `#424244` | Draft badge text, `.tag-neutral` text               |
| `--color-neutral-900` | `#2b2b2d` | Shadow tint source, dialog backdrop tint            |

### 1.2 Colour — semantic

| Token              | Hex                                                           | Used for                                                                         |
| ------------------ | ------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `--color-bg`       | `#f4f5f7`                                                     | Page ground (customer + dealer app), frame background                            |
| `--color-surface`  | `#eaecf0`                                                     | Image-slot / placeholder ground, `+91` prefix field                              |
| `--color-text`     | `#14171c`                                                     | All primary text, plate border                                                   |
| `--color-accent`   | `#2f55dd`                                                     | Primary action (aliased to `accent-600`; overridable via the `accentColor` prop) |
| `--color-divider`  | `rgba(20,23,28,0.15)` (`color-mix(#14171c 15%, transparent)`) | Every hairline border, card border, table header rule                            |
| Elevated surface   | `#ffffff`                                                     | Cards, headers, sidebars, tables, dialogs, bottom sheet                          |
| Row rule           | `rgba(20,23,28,0.08)`                                         | Table `td` bottom border, spec-row rule, list-item rule                          |
| `--ok`             | `#0f7a5a`                                                     | Success text/icon, Active badge text, positive delta, ledger credit              |
| `--ok-bg`          | `#e6f4ef`                                                     | Success banner + Active badge fill                                               |
| `--warn`           | `#a15c00`                                                     | Pending text, negative delta, queue counter                                      |
| `--warn-bg`        | `#fbf0dd`                                                     | Pending badge + "under review" fill                                              |
| `--err`            | `#b3261e`                                                     | Error text, Rejected badge, reject button, ledger debit                          |
| `--err-bg`         | `#fbe9e7`                                                     | Error banner + Rejected badge fill                                               |
| Lightbox ground    | `#0d1017`                                                     | Fullscreen gallery chrome                                                        |
| Lightbox stage     | `#151a23`                                                     | Fullscreen image frame                                                           |
| Lightbox rail cell | `#1a1f29`                                                     | Thumbnail cell in rail                                                           |

Text opacity ladder (all `color-mix(#14171c N%, transparent)`), use in this order:

| Role           | Value                 | Used for                                    |
| -------------- | --------------------- | ------------------------------------------- |
| Text/Primary   | `100%`                | Headings, prices, values, names             |
| Text/Body      | `75%`                 | Descriptions, long-form paragraphs          |
| Text/Secondary | `70%`                 | Hero paragraph, field labels                |
| Text/Muted     | `62%` / `60%` / `58%` | Card meta rows, section sublines, spec keys |
| Text/Subtle    | `55%`                 | Timestamps, counts, breadcrumb              |
| Text/Faint     | `50%` / `45%`         | Table expiry, filter counts, rail numbers   |

On the `accent-900` field and in the lightbox use `#fff` at `1 / 0.75 / 0.6 / 0.55` opacity; rules there are `rgba(255,255,255,0.14–0.25)`.

### 1.3 Type

Families: `--font-heading: "Cabinet Grotesk", "Inter", system-ui, sans-serif` (600/700) · `--font-body: "Inter", system-ui, sans-serif` (400/500/600/700) · numeric/plate: `ui-monospace, SFMono-Regular, Menlo, monospace`.

Global: `-webkit-font-smoothing: antialiased`, body `letter-spacing: -0.005em`, headings `-0.02em`.

| Token           | Size             | Line-height | Weight | Tracking          | Family           | Used for                                                   |
| --------------- | ---------------- | ----------- | ------ | ----------------- | ---------------- | ---------------------------------------------------------- |
| `display`       | 3.25rem / 52px   | 1.02        | 700    | -0.02em           | heading          | Homepage H1                                                |
| `h1`            | 2.75rem / 44px   | 1.05        | 700    | -0.02em           | heading          | Foundations title                                          |
| `h1-page`       | 2.125rem / 34px  | 1.1         | 600    | -0.02em           | heading          | Search results, saved cars, dealer portfolio, auth         |
| `h1-app`        | 1.75rem / 28px   | 1.15        | 600    | -0.02em           | heading          | Dealer console page titles                                 |
| `h1-vdp`        | 1.8125rem / 29px | 1.1         | 600    | -0.02em           | heading          | Vehicle title, submitted state                             |
| `h2`            | 1.75rem / 28px   | 1.15        | 600    | -0.02em           | heading          | Homepage section headings                                  |
| `h2-sm`         | 1.5rem / 24px    | 1.15        | 600    | -0.02em           | heading          | Portfolio + foundations section headings                   |
| `h3`            | 1.3125rem / 21px | 1.2         | 600    | -0.02em           | heading          | VDP subsection headings                                    |
| `h3-sm`         | 1.1875rem / 19px | 1.2         | 600    | -0.02em           | heading          | Card section headings, form step headings                  |
| `h4-card`       | 1.0625rem / 17px | 1.2         | 600    | -0.02em           | heading          | Dealer card name, body-type tile                           |
| `card-title`    | 1rem / 16px      | 1.2         | 600    | -0.02em           | heading          | Vehicle card name, dealer name                             |
| `body-lg`       | 1rem / 16px      | 1.5         | 400    | —                 | body             | Hero paragraph, auth paragraph                             |
| `body`          | 0.9375rem / 15px | 1.55        | 400    | —                 | body             | Success/onboarding paragraphs                              |
| `body-sm`       | 0.875rem / 14px  | 1.65        | 400    | —                 | body             | Descriptions, section sublines, inputs, buttons            |
| `body-xs`       | 0.8125rem / 13px | 1.5         | 400    | —                 | body             | Spec rows, table cells, nav items, list rows               |
| `caption`       | 0.75rem / 12px   | 1.45        | 400    | —                 | body             | Meta, breadcrumbs, field labels, small buttons             |
| `caption-sm`    | 0.6875rem / 11px | 1.45        | 400    | —                 | body             | Card meta, tags, timestamps, counts                        |
| `micro`         | 0.625rem / 10px  | 1.4         | 400    | 0.1em, uppercase  | body             | Kickers, `h6`, nav group labels, badges                    |
| `label-eyebrow` | 0.6875rem / 11px | 1.45        | 400    | 0.1em, uppercase  | body             | Stat-card labels, price-block label                        |
| `label-brand`   | 0.6875rem / 11px | 1.45        | 400    | 0.14em, uppercase | body             | Hero eyebrow, foundations eyebrow                          |
| `price-hero`    | 2.25rem / 36px   | 1.1         | 700    | -0.02em           | heading, tabular | VDP price block                                            |
| `price-lg`      | 1.375rem / 22px  | 1.2         | 600    | —                 | body, tabular    | Saved-cars row price                                       |
| `price`         | 1.25rem / 20px   | 1.2         | 600    | —                 | body, tabular    | Vehicle card price                                         |
| `stat-xl`       | 2.75rem / 44px   | 1.05        | 700    | -0.02em           | heading, tabular | Billing credit balance                                     |
| `stat-lg`       | 2.125rem / 34px  | 1.15        | 700    | -0.02em           | heading, tabular | Dealer dashboard stats                                     |
| `stat`          | 2rem / 32px      | 1.15        | 700    | -0.02em           | heading, tabular | Credit pack size, dealer logo initial                      |
| `stat-sm`       | 1.75rem / 28px   | 1.15        | 700    | -0.02em           | heading, tabular | Admin stat cards, sidebar credits                          |
| `stat-xs`       | 1.625rem / 26px  | 1.15        | 700    | -0.02em           | heading, tabular | Portfolio stat tiles                                       |
| `plate`         | 0.6875rem / 11px | 1.5         | 400    | 0.08em            | mono             | Plate motif default                                        |
| `plate-logo`    | 0.8125rem / 13px | 1.5         | 600    | 0.08em            | mono             | Logo plate (sidebar); 12px in headers, 18px in foundations |
| `mono-data`     | 0.8125rem / 13px | 1.5         | 400    | —                 | mono             | GSTIN, PAN, phone numbers, invoice numbers, RTO            |
| `mono-xs`       | 0.75rem / 12px   | 1.5         | 400    | —                 | mono             | Invoice ids, ledger deltas (600 weight)                    |

### 1.4 Spacing

Design scale (use these; Industry's `--space-*` are 0.85× and only apply inside inherited component classes):

`4 · 6 · 7 · 8 · 9 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 26 · 30 · 34 · 36 · 44 · 48 · 52 · 56 · 60 · 80` px

Canonical uses: `4–8` icon/label gaps · `7` tag rows · `8` grid gaps in tight strips · `9–10` intra-card stacks · `12–14` form-field gaps and card gaps · `16–18` card grid gaps · `20–26` page padding blocks · `34–44` between page sections · `48–56` hero padding · `60` page bottom padding.

Inherited Industry scale: `--space-1: 3.4px` · `--space-2: 6.8px` · `--space-3: 10.2px` · `--space-4: 13.6px` · `--space-6: 20.4px` · `--space-8: 27.2px`.

### 1.5 Radius

| Token         | Value | Applies to                                                                                                                                       |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--radius-sm` | 2px   | —                                                                                                                                                |
| `--radius-md` | 4px   | Buttons, inputs, cards, segmented control, tags (`×0.75` = 3px)                                                                                  |
| `--radius-lg` | 7px   | Dialog                                                                                                                                           |
| `0` (square)  | 0px   | **Everything authored in this product**: plates, image frames, thumbnails, stat tiles, tables, badges, banners, avatars, lightbox chrome, arrows |

Square-cornered is the product default. Only the inherited `.btn` / `.input` / `.card` / `.dialog` classes carry 4–7px.

### 1.6 Shadow

| Token         | Value                             | Applies to                               |
| ------------- | --------------------------------- | ---------------------------------------- |
| `--shadow-sm` | `0 1px 2px rgba(43,43,45,0.14)`   | not used                                 |
| `--shadow-md` | `0 3px 10px rgba(43,43,45,0.16)`  | not used                                 |
| `--shadow-lg` | `0 12px 32px rgba(43,43,45,0.22)` | Mobile frame edge, city dropdown, dialog |

Nothing else in the product carries a shadow. See §4.1.

### 1.7 Motion

| Name      | Duration                         | Easing     | Applies to                                            |
| --------- | -------------------------------- | ---------- | ----------------------------------------------------- |
| `instant` | 0ms                              | —          | Screen changes, filter application, badge/state flips |
| `hover`   | 120ms                            | `ease-out` | Button/nav/arrow background + colour transitions      |
| `sheet`   | 200ms                            | `ease-out` | Mobile filter sheet slide-up, dialog fade-in          |
| `scroll`  | native `scroll-behavior: smooth` | browser    | Thumbnail strip paging, lightbox rail auto-centre     |

No entrance animations, no skeleton shimmer (skeletons are static `neutral-300` bars), no layout transitions.

---

## 2. Components

Shared rules: every interactive element gets `:focus-visible { outline: 2px solid #2f55dd; outline-offset: 2px }` (inputs use `outline-offset: 0` and switch `border-color` to accent). Disabled = `opacity: 0.45; cursor: not-allowed`.

### 2.1 Button (`.btn`)

Base: `display:inline-flex; align-items:center; justify-content:center; gap:6px; font-family:heading; font-weight:600; font-size:14px; line-height:1.2; padding:6.8px 12.24px; border:1px solid transparent; border-radius:4px; cursor:pointer`. Natural height ≈ 32px.

| Variant            | Default                                                      | Hover                     | Active                    | Focus                        | Disabled    |
| ------------------ | ------------------------------------------------------------ | ------------------------- | ------------------------- | ---------------------------- | ----------- |
| `btn-primary`      | bg `#2f55dd`, text `#f4f5f7`                                 | bg `#2f55dd` (600)        | bg `#1e3fae` (700)        | 2px `#2f55dd` ring, offset 2 | opacity .45 |
| `btn-secondary`    | transparent, border `--color-divider`, text `#14171c`        | bg `rgba(20,23,28,0.07)`  | bg `rgba(20,23,28,0.14)`  | as above                     | opacity .45 |
| `btn-ghost`        | transparent, text `#2f55dd`, inline padding 3.4px            | bg `rgba(47,85,221,0.10)` | bg `rgba(47,85,221,0.18)` | as above                     | opacity .45 |
| `btn-destructive`  | `btn-secondary` + text `--err`, border `rgba(179,38,30,0.4)` | bg `rgba(179,38,30,0.07)` | bg `rgba(179,38,30,0.14)` | as above                     | opacity .45 |
| `btn-danger-solid` | `btn-primary` + bg/border `--err`                            | darken 8%                 | darken 16%                | as above                     | opacity .45 |
| `btn-icon`         | 36×36, padding 0                                             | per variant               | per variant               | as above                     | opacity .45 |
| `btn-block`        | `width:100%; margin-top:6.8px`                               | —                         | —                         | —                            | —           |

Authored size overrides (apply as-is):

| Context                                   | Height         | Font | Padding                               |
| ----------------------------------------- | -------------- | ---- | ------------------------------------- |
| Hero search CTA                           | 48px           | 15px | `0 26px`                              |
| VDP primary CTA / auth submit / sheet CTA | 44px           | 15px | default inline                        |
| VDP secondary pair / onboarding next      | 40–42px        | 14px | default                               |
| Header, toolbar                           | 32px (natural) | 14px | default                               |
| In-card / table / chip actions            | natural        | 12px | `4px 10px` (popular chips) or default |
| Sidebar credits CTA                       | natural        | 12px | `btn-block`                           |

Loading state (not yet drawn — implement): keep width, replace label with a 14px 1.5px-stroke spinner in `currentColor`, `aria-busy="true"`, `pointer-events: none`, opacity 1.

Keyboard: native `<button>` throughout — Enter/Space activate. Never a `<div>` with `onClick`.

### 2.2 Registration plate (`.dd-plate`)

`display:inline-flex; align-items:center; gap:7px; border:1px solid #14171c; background:#f4f5f7; padding:2px 9px 2px 0; border-radius:0; font-family:mono; font-size:11px; letter-spacing:0.08em; line-height:1.5; color:#14171c`. `::before` = the left band: `width:5px; align-self:stretch; background:#2f55dd`.

| Variant       | Override                                                                                          | Where                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Logo          | 13px/600, padding `4px 10px 4px 0` (12px in page headers, 18px + `6px 14px 6px 0` in foundations) | Sidebar, customer header, dealer header                                         |
| Year badge    | default 11px                                                                                      | Vehicle card image (absolute `top:10px; left:10px; z-index:2`), VDP title block |
| Verified chip | 10px, label `VERIFIED DEALER` / `VERIFIED`                                                        | VDP dealer card, portfolio header, directory card                               |
| Photo marker  | 9px, label `PRIMARY`                                                                              | Add-vehicle primary photo tile                                                  |

No other use. No hover/active state — it is not interactive.

### 2.3 Input (`.input`)

`width:100%; min-height:36px; padding:6px 10px; font-size:14px; background:#eaecf0; border:1px solid --color-divider; border-radius:4px; caret-color:#2f55dd`.

| State    | Spec                                                                                   |
| -------- | -------------------------------------------------------------------------------------- |
| Hover    | `border-color: rgba(20,23,28,0.45)`                                                    |
| Focus    | `border-color: #2f55dd`, `outline-offset: 0`                                           |
| Error    | `border-color: --err` + 11px `--err` message, `margin-top:4px`                         |
| Disabled | opacity .45, `cursor: not-allowed` (used on the pre-filled phone in onboarding step 1) |
| Textarea | `min-height:90px; resize:vertical`                                                     |

Label (`.field > label`): 12px, `margin-bottom:5px`, `rgba(20,23,28,0.70)`.

Authored sizes: hero search 48px/16px · OTP cell 52×58px, 22px, centred, `maxlength=1` · header city/sort/search `width:auto`, `min-width:170–200px`.

Phone input: 62px `+91` prefix box (`.input`, `background:#eaecf0`, centred) + flexible number field, `gap:8px`.

Keyboard: OTP cells auto-advance on entry, Backspace moves back, paste of 6 digits distributes across cells; Enter on the hero field runs the search.

### 2.4 Checkbox / Radio / Segmented

- Filter checkbox: native `<input type="checkbox">`, `width:15px; height:15px; accent-color:#2f55dd`; wrapped in a `<label>` (`display:flex; gap:9px; font-size:13px; cursor:pointer`) so the whole row is the hit target. Zero-count row: `opacity:0.4`, still operable.
- Range slider: native `<input type="range">`, `width:100%`, `accent-color:#2f55dd`, min `200000`, max `3000000`, step `50000`.
- `.seg` / `.seg-opt`: inline-flex, 1px divider border, 4px radius; selected option takes accent fill with `#f4f5f7` text. Used for enquiry tabs and the fuel example. Arrow keys move selection (radio group semantics).

### 2.5 Tag / Badge (`.tag`)

`inline-flex; font-size:11px; letter-spacing:0.02em; padding:3px 10px; border-radius:3px`.

| Variant                    | Fill                              | Text                  |
| -------------------------- | --------------------------------- | --------------------- |
| `tag-accent`               | `#eef2ff`                         | `#172f7d`             |
| `tag-neutral`              | `#f5f5f8`                         | `#424244`             |
| `tag-outline`              | transparent, 1px `#2f55dd` border | `#2f55dd`             |
| Status: Active             | `--ok-bg`                         | `--ok`                |
| Status: Pending review     | `--warn-bg`                       | `--warn`              |
| Status: Rejected           | `--err-bg`                        | `--err`               |
| Status: Draft              | `--color-neutral-200`             | `--color-neutral-800` |
| Status: Sold               | `--color-accent-100`              | `--color-accent-800`  |
| Status: Expired            | `--color-neutral-200`             | `--color-neutral-700` |
| Payment: Captured / Failed | `--ok-bg` / `--err-bg`            | `--ok` / `--err`      |

Filter chip = `tag-outline` + `cursor:pointer`, `gap:7px`, 11px, trailing `✕`; click removes that filter. Toggle chip (mobile sheet, directory city, portfolio legacy) = 12px, `padding:6px 12px`; selected fill `#2f55dd` / text `#fff` / border `#2f55dd`, unselected transparent / `#14171c` / `--color-divider`.

### 2.6 Blueprint frame (`.blueprint`)

Any framed object: `.blueprint` + four `<i class="corner tl|tr|bl|br">` children. **Never omit the four marks.** Applied to: hero search block, hero image, body-type tiles, dealer stat tiles, dashboard stat cards, price block, review-summary panel, empty states, under-review panel, foundations plate specimen. Border 1px `--color-divider`, radius 0, no fill beyond the stated ground.

### 2.7 Card (`.card`)

`display:flex; flex-direction:column; gap:6.8px; padding:10.2px; border-radius:4px; background:#eaecf0` — in this product always overridden to `background:#fff` and, where stated, `gap:8–11px`, `padding:16–20px`. Border 1px `--color-divider`. No shadow. `.card-kicker`: 10px, `0.1em`, uppercase, `#2f55dd`.

### 2.8 Vehicle card

| Variant                           | Spec                                                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VehicleCard/Grid`                | `padding:0; overflow:hidden; background:#fff`; image band `aspect-ratio:4/3`, `background:#eaecf0`, 1px bottom divider; body `padding:12px 13px 14px`, `gap:9px`; whole card clickable → VDP |
| `VehicleCard/List` (saved cars)   | `flex-direction:row; flex-wrap:wrap`; image 250px fixed, `aspect-ratio:4/3`, right divider; body `padding:16px`, `gap:10px`; price right-aligned                                             |
| `VehicleCard/Compact` (portfolio) | Grid variant, `gap:8px` body, no save button                                                                                                                                                 |
| `VehicleCard/Featured` (homepage) | Grid variant, min column 262px                                                                                                                                                               |

Slots, in order: year plate (absolute TL) · save button (absolute TR) · title `card-title` · price row (`price` 20px tabular + `caption-sm` EMI) · meta row (`caption-sm` 62% — km · fuel · transmission · city, `·` separators) · dealer strip (`padding-top:9px`, 1px top divider, 20px `accent-200` avatar with `accent-800` 9px/700 initials, 12px name with ellipsis, `tag-accent` "Verified").

Save button: 30×30, `background:#fff`, 1px `--color-divider`, radius 0, 14px glyph; `♡` `#14171c` → `♥` `#2f55dd` when saved. `stopPropagation` so it never opens the VDP. `aria-pressed` reflects state; label "Save this car".

### 2.9 Gallery — strip

Container `position:relative; padding:0 34px` (VDP) / `0 32px` (moderation). Track `.dd-strip`: `display:flex; gap:8px; overflow-x:auto; scroll-behavior:smooth`, scrollbar hidden, `min-width:0`. Thumb: `flex:0 0 108px` (VDP) / `92px` (moderation), `aspect-ratio:4/3`, 1px `--color-divider`, radius 0, `overflow:hidden`.

`.dd-arrow`: 30×30 (26×26 moderation), absolute, `top:50%; translateY(-50%)`, `background:#fff`, 1px `--color-divider`, radius 0, 14px glyph, `z-index:3`. Hover → `background:#2f55dd`, `color:#fff`, `border-color:#2f55dd`. Scrolls ±240px smooth. Hide (or disable at .45) when the track is at either end.

Main image button: full width, `aspect-ratio:4/3`, 1px `--color-divider`, `cursor:zoom-in`, count tag bottom-right (`background:#fff`, 11px). Opens the lightbox at index 0.

### 2.10 Gallery — lightbox

`position:fixed; inset:0; z-index:90; background:#0d1017; display:flex; flex-direction:column`.

- Header: 54px, `padding:0 16px`, bottom rule `rgba(255,255,255,0.14)`; mono `DD` chip (1px `rgba(255,255,255,0.4)`, `2px 7px`), 15px/600 title, 12px tabular counter at 0.6 opacity, Close button right (`btn-secondary`, transparent, `#fff`, border `rgba(255,255,255,0.35)`).
- Rail `.dd-rail`: `width:132px` desktop / `84px` mobile, `flex:none`, `padding:12px`, `overflow-y:auto`, `flex-direction:column; gap:8px`. Cell: full width, `aspect-ratio:4/3`, `background:#1a1f29`, **2px** border — `#2f55dd` when active, `transparent` otherwise; index badge bottom-left (mono 10px, `rgba(13,16,23,0.75)` fill, `#fff`, `padding:1px 5px`). Active cell auto-centres via smooth scroll on index change.
- Stage: `flex:1`, centred, `padding:20px`; frame `width:min(100%,1100px)`, `aspect-ratio:4/3`, `background:#151a23`, 1px `rgba(255,255,255,0.16)`. 38×38 arrows inset 14px, `background:rgba(255,255,255,0.9)`. Caption centred, `bottom:14px`, 12px, `rgba(255,255,255,0.7)`.

Keyboard: ← / → page, Esc closes, focus is trapped inside the overlay and returns to the trigger thumbnail on close. Index wraps at both ends.

### 2.11 Price block (`PriceBlock/Plate`)

`.blueprint` + 4 marks, `background:#fff`, `padding:16px`. Rows: `label-eyebrow` at 50% ("Dealer price") · `price-hero` 36px/700 heading tabular · 13px 62% line ("EMI from ₹48,900/month · Fixed price, no hidden charges"). VDP only.

### 2.12 Stat card

`.blueprint` + 4 marks, `background:#fff`, `padding:16px`. Rows: `label-eyebrow` 52% · `stat-lg` 34px/700 tabular · 12px delta in `--ok` (positive) / `--warn` (negative) / 55% neutral. Admin variant: no blueprint marks, plain 1px `--color-divider` box, `padding:14px`, `stat-sm` 28px.

### 2.13 Table (`.table`)

`th`: 11px, `0.08em`, uppercase, 60% text, `padding:6.8px`, bottom 1px `--color-divider`. `td`: `padding:6.8px`, bottom 1px `rgba(20,23,28,0.08)`. Wrapper: `background:#fff`, 1px `--color-divider`, radius 0. Numeric columns `font-variant-numeric: tabular-nums`. Action column `text-align:right; white-space:nowrap`. Row hover: `background:rgba(20,23,28,0.03)` (add). Vehicle cell = 44×33 `#eaecf0` thumb + 13px/500 name + 11px 50% meta.

### 2.14 Dialog

`.dialog-backdrop`: `position:fixed; inset:0; display:grid; place-items:center; padding:13.6px; background:rgba(43,43,45,0.5)`, `z-index:70`. `.dialog`: `width:min(440px,100%)`, `gap:10.2px`, `padding:13.6px`, `border-radius:7px`, `background:#fff`, `--shadow-lg`. Title 16px/600 heading · body 14px at .85 · actions right-aligned, `gap:6.8px`, `margin-top:6.8px`.

Two instances: **Approve** (`btn-secondary` Cancel + `btn-primary` "Approve & publish") and **Reject** (textarea + `btn-secondary` Cancel + `btn-danger-solid` "Reject listing", disabled until reason ≥ 6 chars).

Keyboard: Esc cancels, focus trapped, initial focus on the textarea (reject) or the confirm button (approve), `role="dialog" aria-modal="true"`.

### 2.15 Banner / Toast

Inline banner, `margin:16px 20–22px 0`, `padding:10px 14px`, 13px, 1px border at 30% of its semantic colour, fill `--ok-bg` / `--warn-bg` / `--err-bg`, text the matching solid. Rejection banner adds a 14px/600 title, a 13px 75% reason line and an `Edit & resubmit` `btn-primary` at 12px. Auto-dismiss: none — cleared on navigation.

### 2.16 Stepper

Row of equal `flex:1` cells, `gap:6px`. Each: 3px bar (`#2f55dd` when index < current, else `--color-neutral-300`) + 11px label `margin-top:7px` (`#1e3fae` active/done, 45% otherwise). Used by onboarding (Account → Business → Documents → Review) and add-vehicle (Basics → Details → Photos → Price & review).

### 2.17 Nav item (`.dd-nav-item`)

`display:block; width:100%; text-align:left; font-size:13px; padding:5px 10px; background:transparent; color:rgba(20,23,28,0.70)`. Hover `background:rgba(47,85,221,0.10)`, `color:#14171c`. `aria-current="true"` → `background:#2f55dd`, `color:#fff`. Admin sidebar (dark ground): default `rgba(255,255,255,0.7)`, active `rgba(255,255,255,0.16)` fill + `#fff`, `padding:6px 10px`.

### 2.18 City selector

Trigger: `btn-secondary`, `display:flex; gap:7px`, containing a 5×14 `#2f55dd` bar + city label + `▾`. Menu: `position:absolute; top:calc(100% + 6px); right:0; width:220px; z-index:40; background:#fff; 1px --color-divider; --shadow-lg; padding:6px`; a 10px uppercase 50% header then `.dd-nav-item` rows with the live count right-aligned at 11px/0.6 tabular. Closes on selection and on any screen change.

Keyboard: Enter/Space opens, ↑/↓ moves, Enter selects, Esc closes and returns focus to the trigger. Add an outside-click listener.

### 2.19 Image slot

`<image-slot>` fills its container (`display:block; width:100%; height:100%; min-width:0`) over an `#eaecf0` ground. Each needs a unique `id` and a `placeholder` naming the shot. Hero and gallery mains sit inside `.duotone`. In production these become `next/image` with `object-fit: cover`.

### 2.20 Skeleton / Empty / Error

- Skeleton: static bars, `height:11px`, `background:--color-neutral-300`, widths 70% / 46% / 88%, `gap:6px`. No shimmer.
- Empty state: `.blueprint` + 4 marks, `background:#fff`, `padding:44–56px 20–24px`, centred — 19–22px/600 heading, 13–14px 60% line, one `btn-primary` recovery action.
- Error state: same shell, `--err` heading, `Try again` `btn-primary`.

---

## 3. Screens

Global frame: content `max-width:1280px`, `margin:0 auto`, `padding:0 24px`; desktop design frame 1440. Grid 12 columns / 24px gutters desktop, 4 columns / 16px gutters at 375. Section rhythm: 44px between major sections, 22–26px inside an app screen.

### 3.1 Customer header — sticky

`position:sticky; top:0; z-index:20; background:#fff; border-bottom:1px solid --color-divider; height:64px`, inner flex `gap:28px`. Order: logo plate + wordmark (16px/700) · nav links `Buy cars` / `Dealers` / `Saved cars (n)` at 14px, `gap:22px` · right cluster `gap:8px`: city selector, `Dealer login` (`btn-secondary`, transparent border), `List your cars` (`btn-primary`).

768: nav links collapse into a hamburger sheet; city selector and both CTAs stay. 375: links hidden, logo + city + CTAs only; CTA labels shorten to `Login` / `List cars`.

### 3.2 Homepage

1. **Hero** — `background:#fff`, `padding:56px 24px 44px`, two columns `repeat(auto-fit, minmax(320px,1fr))`, `gap:36px`, `align-items:center`. Left: `label-brand` eyebrow · `display` H1 ("Find your next car") · 16px 70% paragraph (`max-width:46ch`) · blueprint search block (`padding:14px`: 48px single input + 48px `btn-primary`, then a 12px 55% city line) · popular chips row (`gap:8px`, 12px `btn-secondary`). Right: `.blueprint.duotone` hero image, `aspect-ratio:4/3`.
2. **Featured inventory** — `padding:44px 24px`; header row (`h2` + `btn-ghost` "View all n cars →"); grid `repeat(auto-fill, minmax(262px,1fr))`, `gap:18px`, 4 × `VehicleCard/Featured`.
3. **Browse by body type** — `background:#fff`, 1px top divider, `padding:44px 24px`; grid `repeat(auto-fit, minmax(160px,1fr))`, `gap:14px`; 5 blueprint tiles (`padding:18px 16px`, `h4-card` label + 12px count).
4. **Trusted dealers** — `padding:44px 24px`; grid `repeat(auto-fill, minmax(250px,1fr))`, `gap:16px`; dealer cards (36px logo tile, name, city, then a divider row with car count / years / `tag-accent`). Whole card → portfolio.
5. **Why Dealers-Drive** — `background:#101f4f`, `color:#fff`, `padding:48px 24px`; grid `repeat(auto-fit, minmax(190px,1fr))`, `gap:26px`; 5 items each with a 1px `rgba(255,255,255,0.25)` top rule, mono index at 0.6, 17px/600 title, 13px 0.75 body.

768: hero becomes one column (image below); featured 2-up; body types 3-up; dealers 2-up; why 2-up. 375: everything 1-up; hero padding `36px 16px 28px`; H1 → 38px; search input and CTA stack full-width.

### 3.3 Search results (`/cars`)

`padding:26px 24px 60px`. Order: breadcrumb (12px 55%) · title row (`h1-page` "Used cars in {city}" + result count + right cluster: 200px search input, `Filters` button on mobile only, sort `<select>` `min-width:180px`) · filter chip row (`tag-outline` chips + `Clear all`) · body grid `250px 1fr`, `gap:22px`.

Sidebar (desktop only) is `position:sticky; top:84px; align-self:start`: one white card, `gap:18px` — Budget range + min/max labels, then Fuel / Body type / Transmission / Dealer groups, each separated by a 1px top divider + `padding-top:14px`, `h6` heading, rows `gap:7px` with right-aligned counts.

Results grid `repeat(auto-fill, minmax(258px,1fr))`, `gap:16px`, `VehicleCard/Grid`. Empty state per §2.20 with `Clear all filters`.

768: sidebar collapses to the `Filters` bottom sheet; results 2-up. 375: 1-up; the title row wraps to two lines; `Filters` + sort sit side by side full-width.

**Filter bottom sheet** (mobile): `position:fixed; inset:0; z-index:60; background:rgba(20,23,28,0.45)`, panel bottom-aligned `width:100%; background:#fff; padding:18px; max-height:80vh; overflow:auto`. Header (`h3` + `Clear all` ghost), Budget slider, Fuel and Body type as toggle chips, then a sticky 44px `btn-primary` "Show n cars". Backdrop click closes; body scroll locks while open.

### 3.4 Vehicle detail (VDP)

`padding:22px 24px 60px`; back `btn-ghost`; grid `1.35fr 1fr`, `gap:30px`.

Left column (`min-width:0`): main image button (`aspect-ratio:4/3`, count tag) · thumbnail strip with arrows (`margin-top:14px`) · Specifications (`h3` + bordered white list, rows `padding:11px 14px`, key 58% / value 500 tabular, 8 rows) · Features (`h3` + `tag-neutral` chips, 12px, `padding:5px 11px`, `gap:7px`) · Dealer description (`h3` + 14px/1.65 75% paragraph, `max-width:66ch`).

Right column is `position:sticky; top:84px; align-self:start`, `gap:16px`: year plate + `h1-vdp` title + 13px 58% summary · PriceBlock/Plate · CTA stack (44px `Enquire now` `btn-primary`, then a `gap:8px` row of 40px `Call dealer` + `♡ Save`) · dealer card (42px logo tile, name, "city · n cars listed", divider row with verified plate + `View dealership →`) · 12px 50% trust note.

768: single column — gallery, title, price, CTAs, dealer card, then specs/features/description; the right column loses its sticky. 375: same, thumbs `flex:0 0 88px`, CTA stack full-width and pinned as a 64px bottom action bar (`Enquire` + `Call`) with `--shadow-lg`.

### 3.5 Dealer directory (`/dealers`)

`padding:26px 24px 60px`. Order: breadcrumb · `h1-page` "Dealers near {city}" + count · 14px 65% intro (`max-width:62ch`) · filter row (`gap:8px`: 260px name search + city toggle chips) · grid `repeat(auto-fill, minmax(290px,1fr))`, `gap:18px`.

Directory card: 104px `.duotone` cover with bottom divider · body `padding:14px`, `gap:10px` — 44px logo tile pulled up `margin-top:-34px` (`z-index:2`), `h4-card` name, 12px 55% "city, Tamil Nadu · n years", verified plate right · 12px 65% blurb · 3 `tag-neutral` service tags at 10px · divider row: bold tabular car count, "from ₹x" at 12px 55%, `View inventory →` ghost right. Whole card → portfolio.

768: 2-up. 375: 1-up; search input full-width above the city chips.

### 3.6 Dealer portfolio (`/dealers/[slug]`)

1. **Header block** (`background:#fff`, bottom divider): back ghost · 170px `.blueprint.duotone` cover (bottom border removed) · identity row `padding:18px 24px 22px`, `gap:18px`: 78px logo tile pulled up `margin-top:-46px` (`z-index:2`), `h1-page` name + verified plate, 14px 62% address, 13px mono phone, right cluster `Enquire with dealer` (`btn-primary`) + `Call dealership` · stat row `repeat(auto-fit, minmax(150px,1fr))`, `gap:12px`, 4 blueprint tiles (`stat-xs`).
2. **Info row** — `padding:24px 24px 0`, grid `repeat(auto-fit, minmax(260px,1fr))`, `gap:16px`: About (paragraph + service tags on a top divider), Contact (4 key/value rows on 1px rules), Location (map slot `min-height:120px` + `Get directions`).
3. **Inventory** — `padding:26px 24px 60px`, grid `234px 1fr`, `gap:22px`. Sidebar sticky `top:84px`: "Filter inventory" `h6` + `Clear` ghost, Budget slider, then Fuel / Body type / Transmission groups with per-dealer counts (zero-count rows at `opacity:0.4`). Right: heading row (`h2-sm` "Inventory" + "n of m cars" + sort select), chip row, grid `repeat(auto-fill, minmax(250px,1fr))`, `gap:16px` of `VehicleCard/Compact`, plus its own empty state.

768: info row 2-up; inventory sidebar becomes a `Filters` sheet; cards 2-up. 375: everything 1-up; cover 120px; logo tile 60px, `margin-top:-34px`; stat tiles 2-up.

### 3.7 Saved cars

`padding:26px 24px 60px`: breadcrumb · `h1-page` + count + `Clear all` ghost right · 14px 65% note · list `flex-direction:column; gap:12px` of `VehicleCard/List`. Empty state per §2.20 → `Browse n cars`. Persist to `localStorage` (device-scoped, no account).

768: rows keep the 250px image. 375: rows stack — image full-width `aspect-ratio:4/3`, body below, price left-aligned under the title, actions full-width.

### 3.8 Enquiry success

`max-width:640px; margin:0 auto; padding:80px 24px`. Blueprint card `padding:34px`: 44×44 `--ok-bg` / `--ok` check tile · `h1-page` "Enquiry sent to {dealer}" · 15px 68% paragraph with the mono reference · vehicle summary strip (1px border, `padding:14px`, `gap:14px`, 74×56 thumb) · action row `gap:8px` (`Keep browsing` primary, `Back to the car` secondary). 375: `padding:44px 16px`, card `padding:22px`.

### 3.9 Dealer auth

Centred column `max-width:560px; padding:52px 24px 70px` on `#fff`. Brand row (logo plate + "Dealers-Drive for dealers" + `← Back to marketplace` ghost right), `margin-bottom:34px`.

- **Sign in**: `h1-page` "Sign in to your dealer account" · 15px 65% line · phone field (`+91` prefix) · 44px `btn-primary` "Send OTP" · row of `Use email instead` / `Trouble signing in?` ghosts · divider + `Create a dealer account` secondary.
- **Sign up**: same shell; phone + work email; "Send OTP"; 12px 55% centred note; divider + `Sign in instead`.
- **OTP**: `h1-page` "Enter the OTP" · context line · six 52×58 cells `gap:9px` · optional `--err-bg` error banner · 44px primary (`Verify and sign in` / `Verify and continue`) · footer row `← Change number` / `Resend OTP (00:24)`.

Sign-in OTP → dealer dashboard. Sign-up OTP → onboarding step 1. 375: `padding:32px 16px`; OTP cells 44×52, `gap:6px`.

### 3.10 Dealer onboarding

Same centred shell. Stepper at top (`margin-bottom:22px`). Steps: 1 Account (2-col `minmax(200px,1fr)` fields) · 2 Dealership information (full-width name/legal/address rows + 2-col city/state/pincode/landline) · 3 Business verification (GSTIN + PAN mono fields, then 3 document rows: 1px dashed border, `padding:13px`, 32px status tile, label + status line, right action button) · 4 Review (blueprint panel, `Under review` warn tag, `h1-app` heading, two 14px 68% paragraphs). Footer: `Back` secondary + 42px `btn-primary` (`Continue` / `Submit for verification` / `Go to dashboard`). 375: all fields 1-up.

### 3.11 Dealer console shell

Sidebar 214px, `flex:none`, `background:#fff`, right divider, `padding:18px 12px`, `gap:18px`: brand row, `.dd-nav-item` list (Dashboard, Inventory, Add vehicle, Enquiries, Billing, Dealer profile), then a `margin-top:auto` blueprint credits card (`background:#eef2ff`, `padding:12px`: 11px uppercase `accent-800` label, `stat-sm` count, `btn-primary btn-block` "Buy credits").

Top bar sticky `top:0; z-index:15; height:58px; background:#fff`, bottom divider, `padding:0 20px`: dealership name (16px/600) + `Verified` tag + right cluster (credits count 12px tabular + `Add vehicle` primary). Toast slots directly under it.

768/375: sidebar → bottom tab bar, 5 items, 56px tall, `background:#fff`, top divider, active item `#2f55dd`; the credits card moves into Billing.

### 3.12 Dealer dashboard

`padding:22px`: `h1-app` greeting + 13px 58% subline · stat grid `repeat(auto-fit, minmax(178px,1fr))`, `gap:14px`, 4 blueprint stat cards · two-panel grid `repeat(auto-fit, minmax(300px,1fr))`, `gap:18px`: **Views this week** (white card, heading row + 132px bar chart, bars `flex:1`, `gap:9px`, `background:#2f55dd`, 10px day labels) and **Recent enquiries** (heading + `All enquiries →` ghost, 4 rows `padding:10px 0` on 1px rules: 30px avatar, name 13px/500, vehicle 11px 55% ellipsis, time 11px 45%, `Call` secondary 11px). 375: stats 2-up, panels stacked, chart height 110px.

### 3.13 Dealer inventory

`padding:22px`: `h1-app` + count · optional rejection banner · desktop table with columns Vehicle / Price / Status / Views / Enq. / Expires / actions (`Edit` ghost right). Statuses per §2.5. 768 and below: card list `gap:10px` — 70×52 thumb + name/price + status tag top-right, then a divider row with views · enquiries · expiry.

### 3.14 Add vehicle

**Step 0 — Registration.** One plate field, styled as a number plate, plus a
`Look up` button. `Enter the details instead` is present **before** anything
fails, not only after: a dealer who already knows their import is not on VAHAN
should not have to be refused first. Every failure — no RC, provider down, over
the cap — lands on the same manual form with the plate carried across.

**Step 1 — Confirm (was Basics).** The same seven fields, pre-filled. Each
resolved field renders its confidence: `EXACT` is stated plainly, `LIKELY` gets
an amber "Best match — please check" chip, `NONE` is an empty control. Only
`LIKELY` is badged — badging `NONE` would put a warning beside a field the
dealer simply has to fill, which reads as an error they caused.

Variant and transmission are **always** empty, and the copy says why: RC trim
strings are truncated, and a registration certificate does not record a gearbox.

**The records panel.** Two treatments, deliberately not one component with a
flag:

- _Dealer and moderator_ (`ReportPanel`) — itemised challans with dates,
  amounts and a court flag; blacklist reasons; a `Check again` button on step 4.
- _Buyer_ (`ReportSummary`) — verdict chips, aggregate counts, offence types and
  years. No challan references, no exact dates, no registration number.

Both carry the source and the `as of` date in the footer, at 11px but never
hidden: "no challans found in government records as of 12 Feb" and "this car has
no challans" are different claims, and only the first is one we make.

A vehicle whose challan feed was silent renders `Records unavailable` in neutral
— never a green `None found`.

`padding:22px; max-width:860px`: `h1-app` · stepper · white card `padding:20px`.

- Step 1 Basics: `repeat(auto-fit, minmax(190px,1fr))` — Make, Model, Variant, Year, Fuel, Transmission, Body type.
- Step 2 Details: KM driven, Owners, Colour, Registration (mono), Insurance, Location.
- Step 3 Photos: grid `repeat(auto-fill, minmax(150px,1fr))`, `gap:10px`; primary tile spans 2 columns with a 1px `#2f55dd` border and the `PRIMARY` plate; 3 secondary tiles; one dashed drop tile ("Drag photos here / or browse"); below, an upload progress row (12px labels + 4px `neutral-300` track with `#2f55dd` fill).
- Step 4 Price & review: price + negotiable + full-width description; then a blueprint summary panel (`background:#eef2ff`) with title, price/km/fuel line and "Credits after publish" right.

Footer inside the card: 1px top divider, `padding-top:16px`, `gap:9px` — `Back` secondary, `Save draft` secondary (`margin-left:auto`), `Continue` / `Submit for approval` primary. 375: fields 1-up, photo grid 2-up, footer buttons full-width stacked.

Submit → **Submitted** screen: `padding:40px 22px; max-width:640px`, blueprint card `padding:28px` with `Pending approval` warn tag, `h1-vdp` heading, 14px 68% paragraph, `View inventory` primary + `Open admin queue (demo)` secondary.

### 3.15 Dealer enquiries

`padding:22px`: `h1-app` · `.seg` tabs (New / Contacted / Closed / Spam with counts) · list `gap:10px`. Each card `gap:10px`: identity row (34px avatar, 15px/600 name, mono phone, `tag-accent` source, 11px 45% time) · 13px 72% message line with the vehicle bolded · action row on a 1px top divider: `Call {phone}` primary, `Email`, `Mark contacted`, `Close` ghost right. 375: `Call` becomes full-width 44px and first in the action row.

### 3.16 Dealer billing

`padding:22px`: `h1-app` · blueprint balance card (`padding:18px`: 11px uppercase 52% label, `stat-xl` 44px count, 13px 60% line) · `h3-sm` "Buy credits" + pack grid `repeat(auto-fit, minmax(190px,1fr))`, `gap:14px` (each: optional `tag-accent` badge, `stat` count, "credits", 18px price, 11px per-listing rate, `btn-primary btn-block`; the 25-pack card takes `border-color:#2f55dd`) · two-panel grid `repeat(auto-fit, minmax(290px,1fr))`, `gap:20px`: **Credit history** (rows `padding:10px 13px` on 1px rules: 38px mono delta in `--ok`/`--err`, label, date 11px 45%, "bal n" 12px 60%) and **Payment history** (table: Invoice mono / Date / Amount tabular / Status tag / `PDF` ghost). 375: packs 2-up, panels stacked.

### 3.17 Admin console

Ground `#f5f5f8`. Sidebar 206px, `background:#101f4f`, `color:#fff`, `padding:18px 10px`, `gap:16px`: mono `DD` chip + "Admin console", nav items (Dashboard / Listings / Dealers / Payments / Configuration), `margin-top:auto` 11px 0.55 note. Top bar 54px `background:#fff`, bottom divider, `padding:0 20px`: 14px/600 screen title + right cluster (warn tag "n awaiting review", 12px 55% operator email). Toast under it.

- **Dashboard**: `padding:20px`; stat grid `repeat(auto-fit, minmax(158px,1fr))`, `gap:12px`, 6 plain stat boxes; then a moderation-queue panel (`padding:16px`) with `h3-sm`, `Open queue →` ghost and a 13px 60% line.
- **Moderation queue**: `h1-app`-sized 26px title + pending count; table Vehicle / Dealer / Price / Location / Submitted / actions (`Review` secondary + `Approve` primary, `margin-right:6px`); empty state "Queue clear".
- **Review listing**: `padding:20px; max-width:1000px`; back ghost; grid `repeat(auto-fit, minmax(290px,1fr))`, `gap:20px`. Left `min-width:0`: main submitted photo with count tag + 92px thumbnail strip with 26px arrows. Right: 24px title, 14px tabular price/city/dealer line, 7-row spec box, action row (`Approve listing` primary, `Reject` secondary, `Request changes` secondary), 12px 55% consequence note.
- **Dealers**: table Dealer / City / Status / Vehicles / Active / Joined / `Manage` ghost; statuses Active `ok`, Pending `warn`, Suspended `err`.

Admin is desktop-first: at 768 the sidebar collapses to a top select and tables scroll horizontally inside a 1px-bordered container; below 375 no dedicated design — reuse the 768 layout.

---

## 4. Rules

### 4.1 Shadows

Only three elements carry one, all `--shadow-lg`: the mobile-frame edge, the city dropdown, the dialog. **Never** shadow cards, stat tiles, image frames, plates, tables, headers, sidebars, badges, buttons, the bottom sheet panel, or the lightbox. Depth is expressed with 1px `--color-divider` hairlines and white-on-`#f4f5f7` contrast.

### 4.2 Tabular numerals

`font-variant-numeric: tabular-nums` is mandatory on: all prices and EMIs, KM readings, credit counts and balances, stat values, filter counts, table numeric columns, invoice amounts, ledger deltas and balances, city counts, gallery counters, pincode, and the "from ₹x" line. Never on prose.

### 4.3 Square corners

Radius 0 is the product default. The only rounded things are the inherited `.btn` / `.input` / `.card` / `.seg` (4px), `.tag` (3px) and `.dialog` (7px). Never round an image frame, thumbnail, plate, avatar tile, stat tile, badge, banner, table, or the lightbox chrome. Never `border-radius: 50%` — avatars are squares.

### 4.4 Blueprint marks

If an element has `.blueprint`, it must have all four `<i class="corner tl|tr|bl|br">` children. Do not use `.blueprint` on plain content cards — reserve it for the hero search block, hero/gallery figures, body-type tiles, stat and balance cards, the price block, review-summary panels, the under-review panel, and empty states.

### 4.5 Plate motif

Exactly four uses: logo, year badge, verified chip, `PRIMARY` photo marker. Do not apply it to prices, buttons, section headings, statuses, or dealer names. The left band is always `--color-accent` at 5px, full height, never rounded.

### 4.6 Spacing: between vs within

- Between major page sections: **44px** (customer marketing), **26px** (app screens), **22px** page padding in the consoles.
- Between cards in a grid: **16–18px** (14px for tight stat/tile grids, 12px for admin stats).
- Within a card: **8–11px** stack gap, **12–14px** between form fields, `padding:12–20px`.
- Inside a row group (tags, chips, buttons): **6–9px**.
- Divider-separated groups inside a card: 1px top border + **14px** `padding-top`.
  Always use flex/grid `gap` — never margins between siblings, never whitespace text nodes.

### 4.7 Button variants

- `btn-primary` — one per view, the single forward action (Search cars, Enquire now, Send OTP, Continue, Submit for approval, Approve listing, Buy). Never two side by side except in dialog action rows.
- `btn-secondary` — alternate paths of equal weight (Call dealer, Save, Back, Save draft, Review, Request changes) and toolbar controls.
- `btn-ghost` — navigation and low-stakes affordances (View all →, Back to results, Clear all, PDF, Manage, Edit).
- `btn-destructive` — outlined, for Reject in a row context. Solid `--err` only inside the reject dialog's confirm.
- Never a `btn-primary` inside a table row; use `Approve`-style primary only in the moderation queue, where it is the queue's whole purpose.

### 4.8 Colour discipline

Cobalt is the only decorative colour. Semantic colours appear only as status: green = published/captured/positive, amber = pending/under review/negative delta, red = rejected/failed/destructive. Never use a semantic colour for emphasis or decoration. Body-size accent text must use `--color-accent-700`, not `--color-accent` (contrast).

### 4.9 Moderation invariants

A listing is public **only** in `ACTIVE`. `PENDING` and `REJECTED` must never appear in the customer catalogue, in search, on a portfolio, on the homepage, or in a saved-cars list. Approval consumes the held credit and is irreversible in the MVP; rejection requires a reason of ≥ 6 characters, which is stored and surfaced verbatim to the dealer with an `Edit & resubmit` action. Resubmission returns the listing to `PENDING`, never straight to `ACTIVE`.

### 4.10 Buyer anonymity

No customer auth anywhere. Saved cars, city choice, and search query live in `localStorage`/URL state only. Never gate the catalogue, a VDP, a portfolio, or an enquiry form behind a sign-in.

### 4.11 Counts are derived

Every count shown to a user (cars available, dealer inventory, filter counts, city counts, "from ₹x", queue count, saved count) is computed from the live catalogue filtered to `ACTIVE` — never a stored or hard-coded number.

### 4.12 Grid overflow

Any grid or flex column that contains an image strip, a table, or ellipsised text needs `min-width: 0`; strips need `overflow-x: auto` on the track, not the container. This is what keeps thumbnails inside the gallery column.

### 4.13 Typography

Sentence case everywhere. All-caps only at `micro`/`label-*` sizes with `0.08–0.14em` tracking, and in the plate. Headings use `--font-heading` (Cabinet Grotesk, fallback Inter); all UI text, numbers and prices use Inter; only technical identifiers (GSTIN, PAN, phone, invoice, RTO, plate, index badges) use mono. Add `text-wrap: pretty` to every multi-line paragraph. Long-form copy caps at `62–66ch`.

### 4.14 Currency and locale

`₹` prefix, Lakh notation to 2 decimals (`₹6.45 Lakh`); raw amounts use `toLocaleString('en-IN')` grouping (`42,180 km`, `₹10,000`). Phones as `+91 98400 12345`. Dates as `02 Aug 2026`. EMI as `₹48,900/month` (long) or `₹11,700/mo` (card).

### 4.15 Accessibility

Minimum touch target 44×44 on mobile — the 30×30 save button and 26–30px arrows must grow to 44px below 768. Focus is never removed, only restyled. Every icon-only control needs an `aria-label`. The lightbox and dialog trap focus and restore it on close. Status is never conveyed by colour alone — the badge text always carries it.
