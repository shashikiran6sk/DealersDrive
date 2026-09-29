import type { ReactNode } from 'react';

import { EntryStory } from './entry-story';

export interface EntryShellProps {
  children: ReactNode;
}

export function EntryShell({ children }: EntryShellProps) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden lg:flex lg:flex-col">
        <EntryStory />
      </aside>
      <div className="flex min-w-0 justify-center lg:items-center">{children}</div>
    </div>
  );
}
