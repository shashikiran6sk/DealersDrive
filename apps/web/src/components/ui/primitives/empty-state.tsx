import type { ReactNode } from 'react';

import { StatePanel } from './state-panel';

export interface EmptyStateProps {
  title: string;
  message: string;
  action?: ReactNode;
  className?: string;
}

/**
 * DESIGN-SPEC §2.20 — every list has one: a blueprint shell, one sentence
 * naming what is missing, and one primary recovery action.
 */
export function EmptyState({ title, message, action, className }: EmptyStateProps) {
  return <StatePanel title={title} message={message} action={action} className={className} />;
}
