import type { ReactNode, TableHTMLAttributes, ThHTMLAttributes } from 'react';

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
