import type { ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * The `.table` class as a component (DESIGN-SPEC §2.13).
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Like `Input` at F013, this is **not** a port. `globals.css` defines `.table`
 * and the baseline has no React wrapper for it, so the same markup is written
 * out by hand in five pages — dealer inventory, billing, admin payments, admin
 * listings and admin dealers (audit finding D-B). Five independent renderings
 * of one design-spec component is exactly the duplication the reuse rule
 * exists to prevent, and this page is the first of the five in the
 * reconstruction: the cheapest possible moment to stop it at one.
 *
 * ── What it carries that the raw markup does not ────────────────────────────
 * The **scroll container is part of the component**, not the caller's problem.
 * A table wider than its column has to scroll inside its own bordered box,
 * because a page that scrolls sideways instead is the admin console's most
 * common layout bug below 768px — and it is invisible on the desktop the
 * console is designed on. All five hand-rolled sites wrap the table in the
 * same `overflow-x-auto` div; one of them forgetting is a matter of time.
 *
 * It stays deliberately thin. `columns` describes the header and the body is
 * whatever the caller renders, because a table that owned its rows would need
 * a render prop per cell and all five pages format their cells differently.
 * The rendered markup is byte-for-byte what those pages write today.
 */
export interface TableColumn {
  key: string;
  label: ReactNode;
  /** Right-aligned — the row's action link, at the end of the row. */
  align?: 'left' | 'right';
  className?: string;
  /** Passed through for a column that needs, say, an explicit width. */
  thProps?: ThHTMLAttributes<HTMLTableCellElement>;
}

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  columns: TableColumn[];
  children: ReactNode;
  /** A description for screen readers when the heading above is not enough. */
  caption?: string;
  /** Applied to the scroll container, not the table. */
  containerClassName?: string;
}

export function Table({
  columns,
  children,
  caption,
  className,
  containerClassName,
  ...props
}: TableProps) {
  return (
    <div
      className={cn('overflow-x-auto border border-(--color-divider) bg-white', containerClassName)}
    >
      <table className={cn('table', className)} {...props}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(column.align === 'right' && 'text-right', column.className)}
                {...column.thProps}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/**
 * A cell holding a number. `tabular-nums` is mandatory on counts, balances and
 * prices (§4.2) — digits that do not line up down a column are the difference
 * between a table you can scan and one you have to read.
 *
 * It is a component rather than a `numeric` flag on the column because the
 * header and the cells are rendered by different people: `Table` owns the
 * `<th>`, the caller owns the `<td>`.
 */
export function NumericCell({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('tnum', className)} {...props}>
      {children}
    </td>
  );
}
