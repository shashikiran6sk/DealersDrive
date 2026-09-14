# web / components/ui/primitives

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/primitives/avatar.tsx`

### `export function Avatar({ initials, size = 20, className }: AvatarProps)`

Square avatars. `border-radius: 50%` appears nowhere in this product
(DESIGN-SPEC §4.3) — the monogram sits in a cobalt-tinted square.

## `apps/web/src/components/ui/primitives/banner.tsx`

### `export function Banner({ tone, title, children, action, className }: BannerProps)`

DESIGN-SPEC §2.15 — cleared on navigation, never auto-dismissed.

## `apps/web/src/components/ui/primitives/blueprint.tsx`

### `export function Blueprint({ className, children, as: Tag = 'div', ...props }: BlueprintProps)`

The blueprint frame. All four registration marks, always — a `.blueprint`
missing a corner is the one thing DESIGN-SPEC §4.4 calls out by name.

Reserved for: the hero search block, hero and gallery figures, body-type
tiles, stat and balance cards, the price block, review-summary panels, the
under-review panel, and empty states. Not for plain content cards.

## `apps/web/src/components/ui/primitives/corners.tsx`

### `export function Corners()`

The four registration marks on their own, for the places where the blueprint
frame has to be an element `Blueprint` cannot render — the gallery's main
image is a `<button>`. Anything carrying `.blueprint` must carry these.

## `apps/web/src/components/ui/primitives/empty-state.tsx`

### `export function EmptyState({ title, message, action, className }: EmptyStateProps)`

DESIGN-SPEC §2.20 — every list has one: a blueprint shell, one sentence
naming what is missing, and one primary recovery action.

## `apps/web/src/components/ui/primitives/image-slot.tsx`

### `export function ImageSlot({ label, className }: ImageSlotProps)`

A placeholder panel naming the shot, exactly as the prototype renders one.

## `apps/web/src/components/ui/primitives/index.ts`

### `export { Avatar, type AvatarProps } from './avatar'`

The primitives. Nothing here knows what a vehicle is — anything that imports
a domain type belongs in `components/vehicle/` instead, which is what keeps
`ui/` promotable to `packages/ui` later (ARCHITECTURE §16.4).

## `apps/web/src/components/ui/primitives/logo-tile.tsx`

### `export function LogoTile({ initials, size = 42, className }: LogoTileProps)`

The larger logo tile variant, on a lighter tint with a hairline.

## `apps/web/src/components/ui/primitives/plate.tsx`

### `year: ''`

Year badge — the default.

### `logo: 'text-[12px] font-semibold py-[3px] pr-[9px]'`

Logo, in headers and sidebars.

### `chip: 'text-[10px]'`

Verified-dealer chip.

### `marker: 'text-[9px]'`

PRIMARY marker on the wizard's first photo tile.

### `export function Plate({ className, size, children, ...props }: PlateProps)`

The registration plate — the signature element, in exactly four places:
the logo, a vehicle card's year badge, the verified-dealer chip, and the
PRIMARY photo marker (DESIGN-SPEC §4.5). It is never interactive.

## `apps/web/src/components/ui/primitives/skeleton-lines.tsx`

### `export function SkeletonLines({ className }: { className?: string })`

Static bars at the widths DESIGN-SPEC §2.20 specifies. No shimmer.

## `apps/web/src/components/ui/primitives/stat-card.tsx`

### `export function StatCard({ label, value, delta, deltaTone = 'neutral', className }: StatCardProps)`

DESIGN-SPEC §2.12 — blueprint, eyebrow, tabular stat, delta line.

## `apps/web/src/components/ui/primitives/state-panel.tsx`

### `export function StatePanel(`

The shell `EmptyState` and `ErrorState` share — blueprint, title, one sentence, one action.

## `apps/web/src/components/ui/primitives/status-tag.tsx`

### `export function StatusTag({ tone, children, className }: StatusTagProps)`

Status is never conveyed by colour alone — the label always carries it (§4.15).

## `apps/web/src/components/ui/primitives/stepper.tsx`

### `export function Stepper({ steps, current, className }: StepperProps)`

DESIGN-SPEC §2.16 — onboarding and the add-vehicle wizard share it.
