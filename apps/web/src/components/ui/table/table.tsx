import { cn } from '@/lib/cn';

import type { TableProps } from './table.types';

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
