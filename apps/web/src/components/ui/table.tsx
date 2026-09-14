import type { ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

import { cn } from '@/lib/cn';

export interface TableColumn {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right';
  className?: string;
  thProps?: ThHTMLAttributes<HTMLTableCellElement>;
}

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  columns: TableColumn[];
  children: ReactNode;
  caption?: string;
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
