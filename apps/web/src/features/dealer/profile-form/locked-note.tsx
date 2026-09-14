import type { ReactNode } from 'react';

export function LockedNote({ children }: { children: ReactNode }) {
  return <p className="text-[12px] ink-subtle">{children}</p>;
}
