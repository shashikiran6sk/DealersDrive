import type { TdHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

/**
 * A cell holding a number. `tabular-nums` is mandatory on counts, balances and
 * prices (§4.2). It is a component rather than a `numeric` flag on the column
 * because `Table` owns the `<th>` and the caller owns the `<td>`.
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
