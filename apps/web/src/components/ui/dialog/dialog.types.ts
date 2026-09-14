import type { ReactNode } from 'react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * The control that opens it, rendered as-is through `Trigger asChild`. It has
   * to go through Radix: a modal `Content` restores focus to *its trigger*, so a
   * dialog opened by a button Radix does not know about closes with focus on
   * `<body>` and the next Tab starts from the top of the document.
   */
  trigger: ReactNode;
  /** The accessible name. Rendered visibly unless `header` replaces it. */
  title: string;
  /** Optional supporting line under the title, and the accessible description. */
  description?: string;
  /** The icon-only close button's `aria-label` — §4.15 requires one. */
  closeLabel?: string;
  /** Overrides on the panel: width, padding, layout. */
  className?: string;
  /** The scrolling region between header and footer. */
  contentClassName?: string;
  /**
   * Replaces the default title block. It still has to *contain* the title —
   * pass `<DialogTitle>` — because `aria-labelledby` points at it.
   */
  header?: ReactNode;
  /** Pinned below the scrolling region. */
  footer?: ReactNode;
  children: ReactNode;
}
