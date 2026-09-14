# web / components/ui/table

Parent: [web](../../../README.md)

The notes below belonged to the files named under each heading. Each heading is the
declaration the note sat above.

## `apps/web/src/components/ui/table/numeric-cell.tsx`

### `export function NumericCell(`

A cell holding a number. `tabular-nums` is mandatory on counts, balances and
prices (§4.2). It is a component rather than a `numeric` flag on the column
because `Table` owns the `<th>` and the caller owns the `<td>`.

## `apps/web/src/components/ui/table/table.tsx`

### `export function Table(`

The `.table` class as a component (DESIGN-SPEC §2.13).

The scroll container is part of the component, not the caller's problem: a
table wider than its column has to scroll inside its own bordered box, or the
page scrolls sideways instead — the admin console's most common layout bug
below 768px, and invisible on the desktop it is designed on.

It stays deliberately thin. `columns` describes the header and the body is
whatever the caller renders, because a table that owned its rows would need a
render prop per cell and every page formats its cells differently.

## `apps/web/src/components/ui/table/table.types.ts`

### `align?: 'left' | 'right'`

Right-aligned — the row's action link, at the end of the row.

### `thProps?: ThHTMLAttributes<HTMLTableCellElement>`

Passed through for a column that needs, say, an explicit width.

### `caption?: string`

A description for screen readers when the heading above is not enough.

### `containerClassName?: string`

Applied to the scroll container, not the table.
