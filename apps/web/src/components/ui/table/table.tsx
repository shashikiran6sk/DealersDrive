import { cn } from '@/lib/cn';

import type { TableProps } from './table.types';

/**
 * The `.table` class as a component (DESIGN-SPEC §2.13).
 *
 * The scroll container is part of the component, not the caller's problem: a
 * table wider than its column has to scroll inside its own bordered box, or the
 * page scrolls sideways instead — the admin console's most common layout bug
 * below 768px, and invisible on the desktop it is designed on.
 *
 * It stays deliberately thin. `columns` describes the header and the body is
 * whatever the caller renders, because a table that owned its rows would need a
 * render prop per cell and every page formats its cells differently.
 */
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
