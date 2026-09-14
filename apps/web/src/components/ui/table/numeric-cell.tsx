import type { TdHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

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
