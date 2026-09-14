import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  title: string;
  description?: string;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}
