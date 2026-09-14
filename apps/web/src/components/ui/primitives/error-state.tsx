import type { ReactNode } from 'react';

import { StatePanel } from './state-panel';

export const DEFAULT_ERROR_TITLE = 'Something went wrong';

export interface ErrorStateProps {
  title?: string;
  message: string;
  action?: ReactNode;
}

export function ErrorState({ title = DEFAULT_ERROR_TITLE, message, action }: ErrorStateProps) {
  return (
    <StatePanel
      title={title}
      message={message}
      action={action}
      titleClassName="text-(--color-err)"
      role="alert"
    />
  );
}
