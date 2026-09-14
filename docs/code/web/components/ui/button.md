# web / components/ui/button

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/button/button-link.tsx`

### `export function ButtonLink(`

An anchor styled as a button — for navigation, where a `<button>` would be wrong.

## `apps/web/src/components/ui/button/button.tsx`

### `loading?: boolean`

Keeps width, swaps the label for a spinner, sets aria-busy (§2.1).

## `apps/web/src/components/ui/button/button.variants.ts`

### `const button = cva('btn'`

DESIGN-SPEC §2.1 and §4.7.

One `btn-primary` per view — the single forward action. `btn-secondary` for
alternate paths of equal weight, `btn-ghost` for navigation and low-stakes
affordances. Never a primary inside a table row, except the moderation
queue, where approving is the queue's whole purpose.

### `default: ''`

Natural ≈32px: headers, toolbars.

### `sm: 'text-[12px] px-[10px] py-[4px]'`

In-card, table and chip actions.

### `md: 'h-10 text-[14px]'`

VDP secondary pair, onboarding next.

### `lg: 'h-11 text-[15px]'`

VDP primary CTA, auth submit, sheet CTA.

### `hero: 'h-12 px-[26px] text-[15px]'`

Hero search CTA.

## `apps/web/src/components/ui/button/spinner.tsx`

### `export function Spinner()`

The in-button busy indicator — keeps the button's width, swaps its label.
