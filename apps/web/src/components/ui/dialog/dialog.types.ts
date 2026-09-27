import type { ReactNode } from 'react';

import type { DialogVariant } from './dialog.variants';

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  closeLabel?: string;
  className?: string;
  contentClassName?: string;
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  variant?: DialogVariant;
}

interface DialogWithTrigger {
  trigger: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
}

interface DialogWithOwnFocusReturn {
  trigger?: undefined;
  onCloseAutoFocus: (event: Event) => void;
}

export type DialogProps = DialogBaseProps & (DialogWithTrigger | DialogWithOwnFocusReturn);
