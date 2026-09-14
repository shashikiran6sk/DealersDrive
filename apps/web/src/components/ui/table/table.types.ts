import type { ReactNode, TableHTMLAttributes, ThHTMLAttributes } from 'react';

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
