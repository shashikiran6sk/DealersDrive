# Dealers-Drive — Developer Handoff Specification

UI revamp (**R81**) · source of truth for the look: the revamped prototype v4 (`Dealers-Drive.dc.html` + `ds/industry.css`, "Studio" visual system), reconciled with production behaviour.
Implemented in `apps/web/src/styles/globals.css` (`@theme` + `@layer components`) — that file is the live token sheet; this document describes it.
Stack: Next.js 15 App Router + Tailwind v4 `@theme` + CVA, Radix primitives.

> **Reading this after R81.** The original MVP spec drew a square-cornered, cobalt "Industry" system with registration-plate and blueprint-corner motifs. The revamp replaces it with a **neutral-first** system: white surfaces, a warm off-white canvas, near-black primary actions, Manrope, rounded cards and soft elevation. Section numbers are unchanged so existing `§` citations still resolve; where a section describes behaviour rather than appearance, the behaviour is still production's and is noted as such. The one deliberate content change is §3.5: the directory card no longer shows the dealer tagline.

---

## 1. Tokens

### 1.1 Colour — primitives

**Neutral ramp** (the whole product is built from this ramp; there is no decorative hue)

| Token                 | Hex       | Used for                                                                           |
| --------------------- | --------- | ---------------------------------------------------------------------------------- |
| `--color-neutral-100` | `#f7f7f5` | Subtle surface: tag fill, hover fill, story ground, icon tiles, logo tiles         |
| `--color-neutral-150` | `#efefec` | Selected nav item, image-slot ground, pressed secondary, selected segment          |
| `--color-neutral-200` | `#ececea` | Canvas, skeleton bars                                                              |
| `--color-neutral-300` | `#e4e3df` | Border (same value as `--color-divider`), stepper inactive bar, switch track (off) |
| `--color-neutral-400` | `#c9c7c1` | Inactive/hover border, card hover border                                           |
| `--color-neutral-500` | `#9a9892` | Placeholder text                                                                   |
| `--color-neutral-600` | `#6f6d68` | Secondary text, eyebrows, inactive nav text                                        |
| `--color-neutral-700` | `#56534e` | Tag text, field labels                                                             |
| `--color-neutral-800` | `#2c2c2a` | Primary button hover                                                               |
| `--color-neutral-900` | `#171716` | Primary text                                                                       |

**Accent ramp — aliased to neutrals.** The `--color-accent-*` names survive so every component that already reads them follows the revamp without an edit:

| Token                | Hex       | Now means                                                          |
| -------------------- | --------- | ------------------------------------------------------------------ |
| `--color-accent-100` | `#f7f7f5` | subtle fill (was cobalt tint)                                      |
| `--color-accent-200` | `#efefec` | avatar/initials chip fill                                          |
| `--color-accent-300` | `#e4e3df` | quiet border                                                       |
| `--color-accent-400` | `#c9c7c1` | text on the black field (eyebrow in "Why Dealers-Drive")           |
| `--color-accent-500` | `#9a9892` | —                                                                  |
| `--color-accent-600` | `#2c2c2a` | primary hover                                                      |
| `--color-accent-700` | `#56534e` | muted emphasis text                                                |
| `--color-accent-800` | `#2c2c2a` | text on `accent-100/200` fills                                     |
| `--color-accent-900` | `#0c0c0b` | full-field black grounds ("Why Dealers-Drive", inverted stat tile) |

### 1.2 Colour — semantic

| Token              | Hex       | Used for                                                                                  |
| ------------------ | --------- | ----------------------------------------------------------------------------------------- |
| `--color-page`     | `#ffffff` | Body ground on every surface                                                              |
| `--color-bg`       | `#f7f7f5` | Subtle section ground (login story panel, "both sides" panels), dialog footer, hover fill |
| `--color-canvas`   | `#ececea` | Canvas behind framed content (reserved)                                                   |
| `--color-sidebar`  | `#fbfbfa` | Dealer-console sidebar, footer, table header row                                          |
| `--color-surface`  | `#efefec` | Image-slot / placeholder ground                                                           |
| `--color-ink`      | `#171716` | All primary text                                                                          |
| `--color-accent`   | `#0c0c0b` | **Primary action**: primary button, selected chip, switch (on), chart bars, active marks  |
| `--color-focus`    | `#315cf5` | Focus ring, input focus border, caret — the only blue in the product                      |
| `--color-divider`  | `#e4e3df` | Every hairline border, card border, header/footer rule                                    |
| `--color-rule`     | `#efefec` | Table `td` rule, spec-row rule, list-item rule                                            |
| `--color-ok`       | `#09835b` | Success text, Active/Verified badge text, positive delta                                  |
| `--color-ok-bg`    | `#ecfdf3` | Success banner + Active badge fill                                                        |
| `--color-warn`     | `#8f5b13` | Pending/Reserved text, negative delta                                                     |
| `--color-warn-bg`  | `#fff8e6` | Pending/Reserved badge + warning banner fill                                              |
| `--color-err`      | `#c8261b` | Error text, Rejected badge, destructive button                                            |
| `--color-err-bg`   | `#fff1f2` | Error banner + Rejected badge fill                                                        |
| Lightbox ground    | `#0c0c0b` | Fullscreen gallery chrome                                                                 |
| Lightbox stage     | `#151514` | Fullscreen image frame                                                                    |
| Lightbox rail cell | `#1d1d1b` | Thumbnail cell in rail                                                                    |

The semantic text tones are darker than the prototype's (`#0f9f6e`, `#a96c18`, `#d92d20`) so that badge and banner text on its own tint meets WCAG AA at 11–13px.

Text ladder (solid colours, not opacity mixes — they read the same on white and on `#f7f7f5`):

| Role           | Utility         | Value     | Used for                                     |
| -------------- | --------------- | --------- | -------------------------------------------- |
| Text/Primary   | —               | `#171716` | Headings, prices, values, names              |
| Text/Body      | `ink-body`      | `#3f3d39` | Long-form paragraphs                         |
| Text/Secondary | `ink-secondary` | `#56534e` | Field labels, secondary lines                |
| Text/Muted     | `ink-muted`     | `#6f6d68` | Card meta rows, sublines, spec keys, eyebrow |
| Text/Subtle    | `ink-subtle`    | `#6f6d68` | Timestamps, counts, breadcrumb               |
| Text/Faint     | `ink-faint`     | `#75736d` | Least-important meta (still ≥ 4.5:1)         |

On the black field use `#fff` at `1 / 0.75 / 0.6` opacity; rules there are `rgba(255,255,255,0.25)`.

### 1.3 Type

Family: **Manrope** (400/500/600/700/800), loaded with `next/font/google` as `--font-manrope`; `--font-heading` and `--font-body` both resolve to it, falling back to `Arial, system-ui, sans-serif`. Technical identifiers keep `--font-mono` (`ui-monospace, SFMono-Regular, Menlo, monospace`).

Global: `-webkit-font-smoothing: antialiased`, body 15px / 1.55, `letter-spacing: -0.005em`; headings weight 800, line-height 1.2, `letter-spacing: -0.025em`. Legibility wins over fixture sizes: the prototype's 10–12px control labels are raised to 13–14px in production.

| Token          | Size                  | Line-height | Weight | Tracking          | Used for                                              |
| -------------- | --------------------- | ----------- | ------ | ----------------- | ----------------------------------------------------- |
| `display`      | 56px (48 · 40 mobile) | 1.05        | 800    | -0.04em           | Homepage H1                                           |
| `story`        | 42px (36 < xl)        | 1.08        | 800    | -0.04em           | Login story panel headline                            |
| `h1-page`      | 30px (26 mobile)      | 1.2         | 800    | -0.035em          | `/cars`, `/dealers`, saved, enquiries, contact, login |
| `h1-app`       | 30px (25 mobile)      | 1.2         | 800    | -0.035em          | Dealer console page titles                            |
| `h1-vdp`       | 30px (26 mobile)      | 1.15        | 800    | -0.035em          | Vehicle title                                         |
| `h1-portfolio` | 34px (28 mobile)      | 1.1         | 800    | -0.035em          | Dealer portfolio name                                 |
| `h2`           | 24px (22 mobile)      | 1.2         | 800    | -0.025em          | Homepage/VDP/portfolio section headings               |
| `h3-sm`        | 18px                  | 1.2         | 800    | -0.025em          | Card section headings, dialog title, support cards    |
| `h4-card`      | 17px                  | 1.25        | 800    | -0.02em           | Dealer card name                                      |
| `card-title`   | 14px                  | 1.25        | 800    | -0.015em          | Vehicle card title (two-line slot)                    |
| `body-lg`      | 15px                  | 1.8         | 400    | —                 | Hero and story paragraphs                             |
| `body-sm`      | 14px                  | 1.6         | 400    | —                 | Descriptions, sublines, inputs, buttons               |
| `body-xs`      | 13px                  | 1.5         | 400    | —                 | Table cells, list rows, footer links                  |
| `caption`      | 12px                  | 1.5         | 400    | —                 | Card meta, breadcrumbs, field labels (700)            |
| `micro`        | 11px                  | 1.4         | 700    | —                 | Tags, badges                                          |
| `eyebrow`      | 11px                  | 1.4         | 800    | 0.12em, uppercase | Kickers, footer column titles, price label            |
| `price-hero`   | 36px                  | 1           | 800    | —                 | VDP price block, tabular                              |
| `price`        | 20px                  | 1.2         | 700    | -0.02em           | Vehicle card price, tabular                           |
| `stat`         | 30px (26 mobile)      | 1.15        | 800    | -0.03em           | Stat cards, tabular                                   |
| `stat-sm`      | 28px                  | 1           | 800    | —                 | Sidebar credits, tabular                              |
| `mono-data`    | 13px                  | 1.5         | 400    | —                 | GSTIN, PAN, registration numbers, OTP-verified phone  |

### 1.4 Spacing

Rhythm: `4 · 8 · 12 · 16 · 20 · 24 · 32` px, with `6 · 10 · 14 · 18 · 22 · 28 · 40 · 48 · 64` used where a layout needs the half step.

Canonical uses: `4–8` icon/label gaps · `8` chip rows · `10–12` intra-card stacks · `14–16` form-field gaps and card grid gaps (`18` for vehicle/dealer grids) · `18–24` card padding · `22–30` app page padding · `40–48` between homepage sections · `64` page bottom padding.

Page gutters: **16px** below `sm`, **24px** from `sm`, **40px** for full-bleed marketing sections from `lg`. Content widths: `1280px` (marketplace pages), `1440px` (header, footer, homepage bands), `1180px` (contact), `760px` (enquiry history), `560px` (auth form column).

### 1.5 Radius

| Token          | Value | Applies to                                                                     |
| -------------- | ----- | ------------------------------------------------------------------------------ |
| `--radius-sm`  | 8px   | Menu items, small icon tiles, suggestion avatars                               |
| `--radius-md`  | 10px  | Buttons, inputs, selects, segmented control, nav items, logo tiles, thumbnails |
| (14px)         | 14px  | Tables, stat cards, dropdown/popover panels, sidebar credits card              |
| (15px)         | 15px  | Vehicle cards                                                                  |
| `--radius-lg`  | 16px  | Cards, blueprint frames, filter panel, support cards, dealer cards             |
| `--radius-xl`  | 20px  | Dialogs, bottom-sheet top corners                                              |
| `--radius-2xl` | 26px  | Reserved (large feature panels)                                                |
| `--radius-tag` | 999px | Tags, badges, chips, the header Login button, avatars, switch                  |
| (6px)          | 6px   | Year/verified chips (`.dd-plate`), skeleton bars                               |

Rounded is the product default; nothing authored is square except full-bleed bands and the lightbox stage.

### 1.6 Shadow

| Token         | Value                             | Applies to                                                                |
| ------------- | --------------------------------- | ------------------------------------------------------------------------- |
| `--shadow-sm` | `0 2px 6px rgb(20 20 18 / 0.024)` | Vehicle cards, dealer cards, save button, inventory cards, gallery arrows |
| `--shadow-md` | `0 14px 38px rgb(20 20 18 / 0.1)` | Account menu, autocomplete panel, dialogs, dealer-card hover              |
| `--shadow-lg` | `0 24px 70px rgb(18 18 16 / 0.1)` | Login story card, mobile sticky enquiry bar                               |

Elevation stays quiet: borders do most of the separating; shadows only lift things that float or that invite a click. See §4.1.

### 1.7 Motion

| Name      | Duration                         | Easing     | Applies to                                                    |
| --------- | -------------------------------- | ---------- | ------------------------------------------------------------- |
| `instant` | 0ms                              | —          | Screen changes, filter application, badge/state flips         |
| `hover`   | 120ms                            | `ease-out` | Button/nav/chip/card border + background + colour transitions |
| `switch`  | 120–150ms                        | default    | Login Customer ⟷ Dealer switch knob                           |
| `sheet`   | 200ms                            | `ease-out` | Mobile filter sheet slide-up, dialog fade-in                  |
| `scroll`  | native `scroll-behavior: smooth` | browser    | Thumbnail strip paging, lightbox rail auto-centre             |

`prefers-reduced-motion: reduce` zeroes every transition and animation. No entrance animations, no skeleton shimmer.

---

## 2. Components

Shared rules: every interactive element gets `:focus-visible { outline: 2px solid #315cf5; outline-offset: 2px }`; inputs use `outline-offset: 0` and switch `border-color` to `--color-focus`. Cards whose whole surface is one stretched link draw the ring on the **card** (`has-[a:focus-visible]:outline-*`) and suppress it on the anchor. Disabled = `opacity: 0.45; cursor: not-allowed`.

### 2.1 Button (`.btn`)

Base: `inline-flex; align-items:center; justify-content:center; gap:8px; font: 700 14px/1.3 Manrope; padding:8px 15px; border:1px solid #e4e3df; border-radius:10px; background:#fff; color:#171716; white-space:nowrap`. Natural height ≈ 38px.

| Variant            | Default                                             | Hover                          | Active       | Disabled    |
| ------------------ | --------------------------------------------------- | ------------------------------ | ------------ | ----------- |
| `btn-primary`      | bg/border `#0c0c0b`, text `#fff`                    | bg/border `#2c2c2a`            | `#56534e`    | opacity .45 |
| `btn-secondary`    | bg `#fff`, border `--color-divider`, text `#171716` | bg `#f7f7f5`, border `#c9c7c1` | bg `#efefec` | opacity .45 |
| `btn-ghost`        | transparent, no border, text `#171716`, `px 8px`    | bg `#f7f7f5`                   | bg `#efefec` | opacity .45 |
| `btn-destructive`  | secondary + text `--color-err`, border err at 35%   | bg `--color-err-bg`            | —            | opacity .45 |
| `btn-danger-solid` | bg/border `--color-err`, text `#fff`                | `brightness(0.92)`             | —            | opacity .45 |
| `btn-block`        | `width:100%`                                        | —                              | —            | —           |

Sizes (CVA `size`): `sm` 12px / `4px 10px` · `md` 40px · `lg` 44px / 15px · `hero` 48px / 15px. Mobile primary actions are ≥ 44px. The header **Login** link is `btn-primary` with `rounded-full`, `min-height:40px`, `px:18px`.

Loading: keep width, replace the label with a 14px `currentColor` spinner, `aria-busy="true"`. Keyboard: native `<button>` or `<a>` throughout — never a `<div>` with `onClick`.

### 2.2 Registration plate (`.dd-plate`) → chip

The plate motif is retired. `.dd-plate` is now a small neutral chip: `inline-flex; gap:6px; border:1px solid #e4e3df; background:#fff; padding:3px 8px; border-radius:6px; font: 800 11px/1.35 Manrope; letter-spacing:0.03em`. No left band.

| Variant (`Plate size`) | Override                                                                                 | Where                                              |
| ---------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `logo`                 | the **brand mark**: 30×30, `border-radius:9px`, bg/border `#0c0c0b`, white 12px/800 "DD" | Header, footer, auth shell, console sidebar        |
| `year` (default)       | chip                                                                                     | Vehicle card image (absolute `top/left:10px`), VDP |
| `chip`                 | 10px, `VERIFIED DEALER` / `HOW IT WORKS`                                                 | VDP dealer card, portfolio header, directory card  |
| `marker`               | 9px                                                                                      | Reserved                                           |

Not interactive.

### 2.3 Input (`.input`)

`width:100%; min-height:42px; padding:9px 12px; font-size:14px; background:#fff; border:1px solid #e4e3df; border-radius:10px; caret-color:#315cf5`.

| State    | Spec                                                             |
| -------- | ---------------------------------------------------------------- |
| Hover    | `border-color: #c9c7c1`                                          |
| Focus    | `border-color: #315cf5`, 2px `#315cf5` outline, offset 0         |
| Error    | `border-color: --color-err` + 12px error message                 |
| Disabled | opacity .45, `cursor: not-allowed`                               |
| Textarea | `min-height:90px; resize:vertical`                               |
| Select   | `appearance:none`, 5px CSS chevron at `right 12–17px`, `pr:32px` |

Label (`.field > label`): 12px/700, `margin-bottom:6px`, `#56534e`. Placeholder `#9a9892`.

Search/typeahead (`AutocompletePanel`): the `.input` shell at 42px with a leading search glyph and a clear button; suggestions open in a 14px-radius `--shadow-md` panel with an 8px-radius initials tile per row. Behaviour (debounce, suggestions, Enter → `/cars?q=`) is production's.

OTP cells and the `+91` phone field keep their production behaviour and take the input styling above.

### 2.4 Checkbox / Radio / Segmented / Chip / Switch

- Filter checkbox/radio: native input, 15px, `accent-color:#0c0c0b`, wrapped in a `<label>` row; zero-count options are **disabled** (R53), not merely faded.
- `.seg` / `.seg-opt`: `inline-flex`, 1px border, 10px radius, white; options 13px `#6f6d68`; selected `bg #efefec`, `#171716`, 800. Still used in admin.
- **`.dd-chip`** (new): pill, `min-height:34px; padding:0 13px; border:1px solid #e4e3df; border-radius:999px; font:700 12px`, `#56534e`; hover border `#c9c7c1`; `aria-pressed="true"` / `aria-current` → bg/border `#0c0c0b`, text `#fff`. Used for directory towns, inventory and enquiry status tabs, homepage shortcuts.
- **Login switch** (§3.9): `Customer [●—] Dealer` — a 44×26 track (`#e4e3df` off, `#171716` on) with an 18px white knob, flanked by the two tab buttons. The track is decorative (`aria-hidden`); the buttons are the `role="tab"` elements and keep arrow/Home/End support.

### 2.5 Tag / Badge (`.tag`)

`inline-flex; gap:5px; font: 700 11px/1.4; letter-spacing:0.01em; padding:4px 10px; border-radius:999px; white-space:nowrap`.

| Variant                                           | Fill                       | Text                              |
| ------------------------------------------------- | -------------------------- | --------------------------------- |
| `tag-accent`                                      | `#f7f7f5` + 1px `#efefec`  | `#56534e`                         |
| `tag-neutral`                                     | `#f7f7f5`                  | `#56534e`                         |
| `tag-outline`                                     | transparent, 1px `#e4e3df` | `#56534e`                         |
| `tag-ok` (Active)                                 | `--color-ok-bg`            | `--color-ok`                      |
| `tag-warn` (Pending, Reserved, Changes requested) | `--color-warn-bg`          | `--color-warn`                    |
| `tag-err` (Rejected)                              | `--color-err-bg`           | `--color-err`                     |
| `tag-draft` / `tag-expired` / `tag-sold`          | `#efefec`                  | `#2c2c2a` / `#56534e` / `#2c2c2a` |

Applied-filter chip = `tag-outline` + `cursor:pointer` + trailing `✕`.

### 2.6 Blueprint frame (`.blueprint`)

The corner marks are retired. `.blueprint` is now a framed surface: `position:relative; overflow:hidden; border:1px solid #e4e3df; border-radius:16px`. The `<Corners />` children are still rendered for compatibility but hidden (`display:none`). Used by the price block, stat cards, empty/error states, the gallery main image, the portfolio cover and the location card.

### 2.7 Card (`.card`)

`display:flex; flex-direction:column; gap:10px; padding:18px; background:#fff; border:1px solid #e4e3df; border-radius:16px`. No shadow by default (see §1.6 for the cards that lift). `.card-kicker`: 11px/800, `0.08em`, uppercase, `#6f6d68`.

### 2.8 Vehicle card

One structure for every context, so every card in a row lines up whatever its data:

| Part         | Spec                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Card         | `.card`, `p-0`, `h-full`, `border-radius:15px`, `--shadow-sm`; hover border `#c9c7c1` (available cars only)                                      |
| Image band   | fixed `aspect-ratio:1.75` (`1.6` below `sm`), `#efefec` ground, 1px bottom divider, `object-fit:cover`                                           |
| Overlays     | year chip TL · save button TR (36px, 10px radius, `--shadow-sm`) · Reserved badge BL                                                             |
| Body         | `flex:1; padding:13px 14px 14px; gap:8px`                                                                                                        |
| Title        | `card-title` 14px/800, `line-clamp-2` **and** `min-height:2.5em` — a one-line title reserves the second line                                     |
| Price        | 20px/700 tabular                                                                                                                                 |
| Meta         | 12px `#6f6d68` tabular, `line-clamp-2`, `min-height:3em` (km · fuel · transmission · town)                                                       |
| Dealer strip | `margin-top:auto; min-height:35px`, 1px top divider, `padding-top:10px`: 20px round initials chip, 13px name (ellipsis), `tag-accent` "Verified" |

The title's anchor is stretched over the card (`after:absolute after:inset-0`), so the whole card opens the VDP and the focus ring is drawn on the card. `compact` omits the dealer strip.

**Reserved** (R71): the image is `grayscale` at 60% opacity, a `tag-warn`-style pill "Reserved" sits bottom-left, the title is plain text with a screen-reader note, and the card has **no link** — it cannot be opened or enquired on. The label is text, never colour alone.

Save button: `♡` / `♥`, `aria-pressed`, labelled per car; `stopPropagation` so it never opens the VDP. Signed-out presses go through the production login-return intent (R75).

### 2.9 Gallery — strip

Container `position:relative; padding:0 34px` (`0 52px` mobile). Track `.dd-strip` (`flex; gap:8px; overflow-x:auto; smooth`, scrollbar hidden). Thumb `flex:0 0 108px` (88px mobile), `aspect-ratio:4/3`, 1px divider, **10px radius**.

`.dd-arrow`: 34×34 round, `#fff`, 1px divider, `--shadow-sm`, 16px glyph; hover `#efefec`. Hidden or disabled at .45 at either end.

Main image button: full width, `aspect-ratio:4/3`, `.blueprint` (16px radius), `cursor:zoom-in`, white count tag bottom-right. Opens the lightbox.

### 2.10 Gallery — lightbox

Unchanged in structure and keyboard behaviour; recoloured to the neutral darks of §1.2 (`#0c0c0b` chrome, `#151514` stage, `#1d1d1b` rail cells, active cell border `#fff`-on-dark accent). ← / → page, Esc closes, focus is trapped and returns to the opener.

### 2.11 Price block (`PriceBlock`)

`.blueprint` (16px radius), `background:#fff`, `padding:20px`: `eyebrow` "Dealer price" · `price-hero` 36px/800 tabular · 13px `#56534e` negotiability line. VDP only.

### 2.12 Stat card

`.blueprint`, `border-radius:14px`, `padding:20px`, `min-height:120px`, content spread top-to-bottom: 12px/700 `#6f6d68` label (sentence case) · `stat` 30px/800 tabular · 12px delta in `--color-ok` / `--color-warn` / muted. **`inverse`** variant: bg/border `#0c0c0b`, white value, labels at 75% white — used for the dashboard's _Available credits_ tile.

### 2.13 Table (`.table`)

Wrapper: `#fff`, 1px divider, **14px radius**, `overflow-x:auto`. `th`: 11px/800, `0.04em`, sentence case, `#6f6d68`, `background:#fbfbfa`, `padding:12px 14px`, bottom 1px divider. `td`: `padding:13px 14px`, bottom 1px `#efefec`. Row hover `#fbfbfa`. Numeric columns tabular; action column right-aligned.

### 2.14 Dialog

Radix Dialog. Backdrop `rgb(12 12 11 / 0.44)` + `backdrop-filter: blur(3px)`, `z-index:70`. Card: `width:min(460px,100%)`, `border-radius:20px`, 1px divider, `--shadow-md`; header `padding:16px 22px` with an 18px/800 title and a round 36px close button; body `padding:18px 22px`; optional footer on `#f7f7f5`. Sheet variant: bottom-anchored, `border-radius:20px 20px 0 0`, `max-height:85dvh`. Fullscreen variant: the lightbox.

Keyboard: Esc cancels, focus trapped, focus restored on close, `aria-modal="true"`.

### 2.15 Banner / Toast

`border-radius:12px; padding:11px 14px; 13px`, 1px border at 30% of its semantic colour, fill `--color-*-bg`, text the matching solid; optional 14px/700 title and an action row. `role="status"`.

### 2.16 Stepper

Row of equal cells, `gap:6px`; each a 3px **rounded** bar (`#0c0c0b` done/current, `#e4e3df` otherwise) + 11px label. Used by onboarding and the listing wizard (Registration → Vehicle basics → Vehicle details → Pricing → Review).

### 2.17 Nav item (`.dd-nav-item`)

`flex; align-items:center; gap:12px; min-height:42px; padding:10px 14px; border-radius:10px; font:700 14px; color:#6f6d68`. Hover `#f7f7f5` / `#171716`. `aria-current` → `background:#efefec`, `#171716`, 800.

Mobile console tab bar: 60px, `bg #fff/95` + blur, top divider; current item is 800 `#171716` **with a 2px top bar**, others 600 muted — never colour alone.

### 2.18 City selector (district picker)

Trigger: `btn-secondary` with the district name (or "Select district") and `▾` — the 5px accent bar is gone. The picker itself (dialog with search, state filter and district grid, R22/R50) is production's and takes the dialog/chip styling above.

### 2.19 Image slot

`ImageSlot`: fills its container over `#efefec`, 12px `#6f6d68` centred label naming the missing shot ("Photographs coming soon", "{dealer} — yard photo"). `role="img"` with that label. Real images are `object-fit: cover`.

### 2.20 Skeleton / Empty / Error

- Skeleton: static bars, 11px, `#ececea`, 6px radius, widths 70% / 46% / 88%. No shimmer.
- Empty state: `.blueprint` (16px radius), `#fff`, `padding:56px 24px`, centred — 20px/800 heading, 14px muted line, one `btn-primary` recovery action.
- Error state: same shell, `--color-err` heading, `role="alert"`.

---

## 3. Screens

Global frame: marketplace content `max-width:1280px`, header/footer/homepage bands `1440px`; gutters per §1.4. Desktop design frame 1440; verified at 320 / 375 / 390 / 430 / 768 / 1024 / 1440 with **no horizontal page overflow**.

### 3.1 Customer header — sticky

`position:sticky; top:0; z-index:20; background:#fff; border-bottom:1px solid #e4e3df; height: var(--header-height)` (64px, **76px from `md`**), inner `max-width:1440px`, `gap:28px`. Order: brand mark + "Dealers-Drive" (17px/800; the word hides below `sm`) · nav **Buy cars** / **Dealers** (14px/700, `#6f6d68`; current section `#171716` **plus a 2px underline** and `aria-current="page"`) · right cluster `gap:8px`: district selector, then the account corner.

Account corner (production behaviour, R67/R76): signed out → one `Login` pill (`btn-primary`, rounded) to `/login`; signed in → a 40px black round avatar with white initials opening the account menu (14px-radius panel, `--shadow-md`): name + masked mobile, **Saved cars**, **My enquiries**, separator, **Logout** — 44px rounded items, arrow/Home/End, Escape restores focus.

**R81** removed `Saved cars` from the top bar; it is reached from the account menu and the footer. The prototype's signed-out avatar menu (Customer login / Dealer login) is **not** used: production keeps a single Login door (R35/R63), and Dealer login is reached from the login switch and the footer.

375: brand mark only, district selector and Login/avatar on one row.

### 3.2 Homepage

1. **Hero banner** (`HeroBanner`) — a **single full-width banner**: one photograph of an Indian dealership — dealer, customers and the yard — `object-fit:cover`, under a black scrim (`black/80 → black/50 → black/10` left to right from `md`, a flat `black/55` on phones). `min-height:560px` (500px mobile), content `max-width:640px` left-aligned inside the 1440px frame: white eyebrow · `display` H1 in white · 15px/1.8 paragraph at 85% white · the production `CarSearchBox` (R79: suggestions open `/cars`, Enter opens `/cars?q=`) · `.dd-chip` shortcuts "Browse every car" / "Explore verified dealers". It replaces the MVP's two-column hero and the "How it works" trust panel. The default photograph is committed at `apps/web/public/images/home-hero.webp` (a salesperson with an Indian family in a showroom). **It is editable in `/admin/config`**: _Homepage hero image URL_ (`home.heroImageUrl`, an `https:` URL or a `/images/…` path) and _Homepage hero image description_ (`home.heroImageAlt`); the page falls back to the committed photograph when none is set, and the banner can also draw a dark `#0c0c0b` radial ground (`image: null`), never a broken image.
2. **Discovery rows** (R72/R78) — `max-width:1440px`, `gap:48px`; each row: `h2` + "View all →" ghost, grid `repeat(auto-fill, minmax(262px,1fr))`, `gap:18px`, `items-stretch`, vehicle cards (§2.8). Available cars only; no counts.
3. **Your journey** — three `.blueprint` cards (mono index, 20px title, muted body).
4. **Built for both sides** — two 16px-radius `#f7f7f5` panels with ghost links (wrap on narrow widths).
5. **Why Dealers-Drive** — full-bleed `#0c0c0b`, white type, five items with a `rgba(255,255,255,0.25)` top rule.

768: discovery rows 2-up. 375: everything 1-up; H1 40px; the banner stays full-bleed with the flat scrim.

### 3.3 Search results (`/cars`)

`max-width:1280px; padding:28px 16px|24px 64px`. Order: breadcrumb (12px muted) · title row (`h1-page` + live "n cars available", `role="status"`) · controls row (R55): `CarSearchBox` · district scope · sort select, right-aligned · applied-filter chips · body grid `250px 1fr`, `gap:22px`.

Filter rail (desktop): `.card` (16px radius) inside the sticky, viewport-bounded, self-scrolling `filter-rail` (R56); groups separated by 1px dividers, 12px/800 group headings (sentence case), checkbox/radio rows with right-aligned tabular counts; zero-count options disabled (R53).

Results: `repeat(auto-fill, minmax(258px,1fr))`, `gap:16px`, vehicle cards (§2.8); results update in place with the 200ms-delayed dim (R57). Pagination: Previous / "Page n of m" / Next. All query/URL semantics are production's.

768 and below: the rail becomes the `Filters` bottom sheet (§2.14 sheet), results 2-up then 1-up.

### 3.4 Vehicle detail (VDP)

`max-width:1280px; padding:24px 16px|24px 64px`; back ghost ("← All cars"); grid `1.35fr 1fr`, `gap:30px`.

Left: gallery (§2.9) · Specifications (`h2` 22px + a 14px-radius white list, rows `padding:12px 16px` on `#efefec` rules, key muted / value 600 tabular) · Dealer description.

Right, sticky under the header: year chip (+ Reserved pill when reserved) · `h1-vdp` · summary · listed date · PriceBlock · **Enquire now** (44px full-width `btn-primary`, with "Requires login…" note; the form opens inline in a 16px-radius card with read-only name and verified mobile — R64/R65/R68) or, when reserved, the Reserved banner + "Browse available cars" · **Save / Saved** full-width secondary · dealer card (`.card`, 20px padding: 42px logo tile, name, location, `VERIFIED DEALER` chip, "View dealership →") · trust note.

The prototype's Call and EMI actions are not part of production and are not drawn. Mobile: single column with the sticky bottom enquiry bar.

### 3.5 Dealer directory (`/dealers`)

`max-width:1280px; padding:28px 16px|24px 64px`. Breadcrumb · `h1-page` + count · 14px muted intro · filters (R43 typeahead, then district button or `.dd-chip` town toggles with counts and "Clear n towns") · grid `repeat(auto-fill, minmax(270px,1fr))`, `gap:18px`, `items-stretch`.

**Directory card (R81):** fixed height **330px**, 16px radius, `--shadow-sm`, hover border `#c9c7c1` + `--shadow-md`.

- 112px cover (`coverUrl` or a named image slot) with a white "YARD VERIFIED" pill top-right when verified.
- 48px white logo tile straddling the cover edge (`margin-top:-24px`), `VERIFIED DEALER` chip on the same row.
- Name 17px/800 (`line-clamp-2`), "town, state · n years" 12px muted.
- Up to three service tags (first `tag-accent`, rest `tag-neutral`).
- Footer on a 1px top divider: "n cars listed" 13px/700 tabular, "from ₹x" right-aligned.

**No tagline and no "View inventory →"** on this card. The whole card is one link to `/dealers/[slug]` — the name's anchor stretched over the card — with the focus ring on the card. The tagline still exists everywhere else (API, onboarding, dealer profile, portfolio header).

768: 2-up. 375: 1-up.

### 3.6 Dealer portfolio (`/dealers/[slug]`)

1. **Header** (white, bottom divider): back ghost · identity row: 78px logo tile (60px mobile), `h1-portfolio` name + `VERIFIED DEALER` chip, the **tagline** (16px/500, R25), address · 440px `.blueprint` cover (340 / 240 at smaller widths).
2. **Info row** — `repeat(auto-fit, minmax(260px,1fr))`, `gap:16px`: Dealership details `.card` (18px padding, key/value rows on `#efefec` rules, service tags) and the Location card (map + Get directions).
3. **Inventory** — grid `234px 1fr`: sticky filter rail (as §3.3, per-dealer counts) and the results (`h2` "Inventory" + count, sort, applied chips, vehicle cards, pagination).

A dealer's phone never appears here (invariant: only the reveal endpoint returns one), so the prototype's Call / Enquire-with-dealer buttons and phone line are not drawn.

### 3.7 Saved cars

`max-width:1280px`: `h1-page` + intro · groups (R75) **Available**, **Reserved**, **No longer available**, each an 18px/800 heading with a count and a note, then a vehicle-card grid (`minmax(240px,1fr)`, `items-stretch`). Server-backed and account-gated (R74/R75); signed-out visitors are sent to `/login?returnTo=/saved`. Empty state per §2.20.

### 3.8 Enquiry success / history

Enquiry confirmation is inline on the VDP (R65). **My enquiries** (`/enquiries`, R68): `max-width:760px`, `h1-page` + intro, tabs as production, list of `.card`s (18px padding): vehicle title (link while listed, otherwise plain with "no longer listed"), dealer name, status tag, message, and a 12px "Sent on …" line on a top divider.

### 3.9 Login (`/login`)

**R81** split layout, `EntryShell`:

- Left (from `lg`): `#f7f7f5` story panel — eyebrow "Welcome to Dealers-Drive", `story` headline (Find a car. / Connect directly. / Drive forward.), 14px muted line, and a white 22px-radius `--shadow-lg` card listing Verified dealers / Direct enquiries / Local expertise. No photograph (the prototype's is a fixture).
- Right: `AuthShell` column (`max-width:560px`): brand mark + "Dealers-Drive" + "← Back to marketplace"; the page's `h1` "Login" is visually hidden; then the **compact switch** (§2.4) right-aligned, `Customer` selected by default (`?as=dealer` selects Dealer).
- **Customer**: `h2` "Customer login" (30px/800) · intro · production phone OTP flow (Send OTP → six cells → Verify) · first sign-in adds "Your number is verified" + Name + Create account (R62).
- **Dealer**: `h2` "Dealer login" · intro · error/unconfigured banners · **Continue with Google** as a 48px `btn-primary` with the Google mark in a white circle · "Use mobile number instead" (underlined text button, `aria-expanded`, `aria-controls`) disclosing the "or" rule and the production phone flow, focusing the mobile field. When Google is not configured the phone form shows immediately.
- Below both: "Trouble signing in? Contact support" → `/contact`.

Behaviour — OTP, Google linking, provisional dealers, onboarding detection, post-login routing, return intents — is production's (R58–R63). 375: story panel hidden, form only.

### 3.10 Dealer onboarding

Production flow and fields (R37–R61) in the `AuthShell` column with the revamped inputs, stepper (§2.16), document rows and review panel. Footer: `Back` secondary + 42px `btn-primary`.

### 3.11 Dealer console shell

Sidebar **224px**, sticky full-height, `background:#fbfbfa`, right divider, `padding:24px 16px 20px`, `gap:28px`: brand mark + "Dealer console" (16px/800) · `.dd-nav-item` list (Dashboard, Inventory, Add vehicle, Enquiries, Dealer profile) · `margin-top:auto` white credits card (14px radius, `padding:16px`: eyebrow "Listing credits", 28px/800 tabular balance, held-credits line).

Top bar sticky, **70px** (64px mobile), `#fff`, bottom divider, `padding:0 32px` (16px mobile): dealership name (16px/800, truncates) + status tag (`tag-ok` when active, `tag-warn` otherwise) · right: credits count (13px tabular), `Add vehicle` primary (hidden on mobile), Sign out.

Below `md`: sidebar → bottom tab bar (§2.17), main content padded 60px at the bottom.

### 3.12 Dealer dashboard

`padding:30px 32px` (22px 16px mobile): `h1-app` greeting + subline + "+ Add vehicle" · alerts (warn banners) · listing-status stat row (`minmax(160px,1fr)`, each tile links to its inventory tab) · metric stat row (`minmax(178px,1fr)`; _Available credits_ is the **inverse** tile) · two panels (`minmax(300px,1fr)`): **Views this week** (`.card`, 132px bar chart, bars `#0c0c0b` with 6px top radius) and **Recent enquiries** (`.card`, rows with 30px round initials, name 14px/700, vehicle, time, Call secondary). 375: stats 2-up, panels stacked.

### 3.13 Dealer inventory

`h1-app` + count + Add vehicle · status tabs as **`.dd-chip`s with counts** (All, Draft, Pending review, Changes requested, Active, Reserved, Sold, Withdrawn), horizontally scrollable · search form (370px input + Search secondary + Clear) · desktop: the production table (§2.13: Vehicle / Price / Status / Updated / Actions) with lifecycle actions per row (R70: Reserve / Mark sold / Withdraw / Reactivate / Relist / Open / Edit, with confirmation dialogs) · below `md`: `.card` list (16px padding, `--shadow-sm`: title 15px/800, registration mono, status tag, summary, price 17px/800, reason, actions) · cursor pagination "Show more".

The prototype's photo cards, views and sort are not drawn — the inventory response does not carry them.

### 3.14 Add vehicle

Production's five-step wizard (R45–R47): **Registration → Vehicle basics → Vehicle details → Pricing → Review**, no dealer photo upload (Dealers-Drive arranges photography after submission). `max-width:860px`, `h1-app`, stepper, white `.card` steps with the revamped inputs; footer Back / Save draft / Continue or Submit. RC lookup (step 0 plate lookup, confidence chips, records panel) remains deferred by R46; when it lands it takes this styling.

Submit → Submitted panel (`.blueprint`, 28px padding) with the pending tag, heading, paragraph and "View inventory".

### 3.15 Dealer enquiries

`h1-app` + count · status tabs as `.dd-chip`s (New / Contacted / Closed / Spam with counts) · list `gap:10px` of `.card`s (18px padding): 34px round initials, 16px/800 name, mono phone, time · vehicle line (link while listed) with registration · message · action row on a top divider: `Call {phone}` primary (full-width 44px on mobile) and the production status transitions (R66).

### 3.16 Dealer billing

Not landed — the credit-pack and payment screens of the MVP spec are excluded from the revamp (R47 defers billing). The credit balance appears on the dashboard and in the console sidebar only.

### 3.17 Admin console

Admin keeps its production structure and inherits the revamp through tokens: neutral grounds, 10px controls, 14–16px cards and tables, pill tags, rounded dialogs. The configuration screen's "Platform settings" list (14px-radius panel) now includes the five **Support** keys of §3.18 and the two **Homepage hero image** keys of §3.2.

### 3.18 Contact & support (`/contact`) — new in R81

`max-width:1180px; padding:52px 24px 72px` (40px 16px mobile): `eyebrow` "We're here to help" · `h1-page` "Contact Dealers-Drive" · 15px muted intro · grid of three `.card`s (24px padding; 3-up from `md`, 1-up below):

| Card             | Content                                                                                                                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer support | 40px icon tile · heading · one line of help · Email and Phone (`mailto:` / `tel:` links, 800, underlined)                                                                         |
| Dealer support   | the same, for dealerships                                                                                                                                                         |
| Chat on WhatsApp | icon · heading · line · `Chat in WhatsApp ↗` primary opening in a new tab (`noopener noreferrer`); when not configured, a disabled button + "WhatsApp chat is not available yet." |

Every value comes from `GET /v1/config/public` → `support`, built from the admin-editable keys `support.customerEmail`, `support.customerPhone`, `support.dealerEmail`, `support.dealerPhone`, `support.whatsapp` (number → `https://wa.me/…`, or an `https:` URL). An empty or unusable value falls back to the deployment's `SUPPORT_EMAIL` / `SUPPORT_PHONE`. Linked from the footer's Support column and the login's "Trouble signing in?".

### 3.19 Footer

`background:#fbfbfa`, top divider, `max-width:1440px`, four columns from `lg` (`2fr 1fr 1fr 1fr`): brand mark + trust sentence + social row (36px 10px-radius icon buttons, only configured networks, R44) · **Buy a car** (Buy cars, Dealer directory, Saved cars) · **For dealers** (Dealer login → `/login?as=dealer`, note) · **Support** (**Contact & support** → `/contact`, then the support email and phone). Column titles are `eyebrow`s; links 13px/700. Bottom bar: © year · "not a party to any sale" disclaimer.

---

## 4. Rules

### 4.1 Shadows

Shadows are soft and sparing (§1.6): `--shadow-sm` on clickable cards and floating small controls, `--shadow-md` on menus, popovers, dialogs and card hover, `--shadow-lg` on the login story card and the mobile enquiry bar. Never shadow tables, stat tiles, form panels, headers, sidebars, badges or buttons (except the save button and gallery arrows, which float over imagery). Borders carry the structure.

### 4.2 Tabular numerals

`font-variant-numeric: tabular-nums` is mandatory on: all prices, KM readings, credit counts and balances, stat values, filter counts, table numeric columns, district/town counts, gallery counters, phone numbers, and the "from ₹x" line. Never on prose.

### 4.3 Rounded corners

Rounded is the default (§1.5): 10px controls, 14–16px cards and panels, 20px dialogs, pills for tags/chips/avatars. Only full-bleed bands and the lightbox stage are square. Images inside a rounded frame are clipped by the frame (`overflow:hidden`), never rounded independently of it.

### 4.4 Blueprint marks

Retired. `.blueprint` is a rounded framed surface (§2.6); do not reintroduce corner marks or crosshairs.

### 4.5 Brand mark and chips

The registration-plate motif is retired. The only branded mark is the black 30px "DD" tile (§2.2 `logo`). Year, verified and "how it works" labels are neutral chips; do not apply the brand mark to anything but the logo, and do not colour chips with the accent.

### 4.6 Spacing: between vs within

- Between major page sections: **40–48px** (marketing), **18–30px** (app screens).
- Between cards in a grid: **16–18px** (14px for stat grids, 8px for chip rows).
- Within a card: **8–12px** stack gap, **14–16px** between form fields, `padding:16–24px`.
- Divider-separated groups inside a card: 1px top border + **10–14px** `padding-top`.
  Always use flex/grid `gap` — never margins between siblings.

### 4.7 Button variants

- `btn-primary` (black) — the single forward action per view (Send OTP, Continue with Google, Enquire now, Send enquiry, Add vehicle, Submit, Approve). Avoid two side by side outside dialog action rows.
- `btn-secondary` (white, bordered) — alternate paths and toolbar controls (Save, Search, Back, Save draft, Reserve, Mark sold).
- `btn-ghost` — navigation and low-stakes text actions (View all →, ← All cars, Clear, Open, Edit, View dealership →).
- `btn-destructive` — outlined red for Withdraw/Reject in row context; solid `--color-err` only inside a destructive dialog's confirm.

### 4.8 Colour discipline

The product is neutral; black is the action colour and blue appears **only** as the focus ring. Semantic colours appear only as status: green = active/verified/positive, amber = pending/reserved/changes requested/negative delta, red = rejected/failed/destructive. Never use a semantic colour for emphasis or decoration.

### 4.9 Moderation invariants

A listing reaches the public catalogue only through moderation. **R71:** `ACTIVE` and `RESERVED` are publicly visible (reserved cars greyed, labelled and non-navigable, never enquirable); `SOLD` and `WITHDRAWN` leave every public surface but stay in saved cars and enquiry history. `DRAFT`, `PENDING_REVIEW`, `CHANGES_REQUESTED` and `REJECTED` never appear publicly. Rejection and changes-requested reasons are surfaced verbatim to the dealer. Listing status changes only through the lifecycle transitions.

### 4.10 Buyer anonymity

Browsing is never gated: the catalogue, a VDP and a portfolio need no account. **R62/R74:** customers sign in with their phone (no email, no password) to enquire and to save cars; saved cars live on the server. The district choice and search query stay in the URL/device.

### 4.11 Counts are derived

Every count shown (cars available, dealer inventory, filter counts, district/town counts, "from ₹x", status tab counts) is computed from live data — never stored or hard-coded. Public counts mean **available** cars (R71); the homepage shows no count at all (R78).

### 4.12 Grid overflow

Any grid or flex child that contains an image strip, a table, a chip row or ellipsised text needs `min-width: 0`; strips and chip rows scroll on the track (`overflow-x: auto`), not the page. No page may scroll horizontally at 320px.

### 4.13 Typography

Sentence case everywhere. All-caps only for `eyebrow`s (0.08–0.12em tracking) and the short chip labels (`VERIFIED DEALER`, `YARD VERIFIED`, `HOW IT WORKS`). One family — Manrope — for headings, UI, numbers and prices; mono only for technical identifiers (GSTIN, PAN, registration numbers, OTP-verified phone in forms). `text-wrap: pretty` on multi-line paragraphs; long-form copy caps at `52–68ch`.

### 4.14 Currency and locale

`₹` prefix; production composes price strings (`₹5,95,000`, "from ₹3.50 Lakh") — the UI renders the API's labels rather than re-formatting. Grouping `en-IN` (`42,180 km`). Phones as `+91 98400 12345` (masked `+91 98XXXXXX12` in the account menu). Dates as `19 Sep 2026`.

### 4.15 Accessibility

Minimum touch target 44×44 on mobile for primary actions, menu items and tab-bar items. Focus is never removed, only restyled (§2); whole-card links show the ring on the card. Every icon-only control has an `aria-label`; decorative icons and the login switch track are `aria-hidden`. Menus support arrow keys, Home/End and Escape with focus restore; dialogs and the lightbox trap focus and restore it on close; disclosures expose `aria-expanded`/`aria-controls`. Status is never conveyed by colour alone — badge text, a Reserved label, an underline or a weight change always carries it. Text contrast meets WCAG AA (§1.2).
