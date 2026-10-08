import { cn } from '@/lib/cn';

import type { TableProps } from './table.types';
import { TABLE_TEXT } from './table.constants';

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
      role="region"
      aria-label={caption ?? TABLE_TEXT.scrollRegion}
      tabIndex={0}
      className={cn(
        'overflow-x-auto rounded-[14px] border border-(--color-divider) bg-white max-md:min-w-0 max-md:max-w-full max-md:overscroll-x-contain',
        containerClassName,
      )}
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
