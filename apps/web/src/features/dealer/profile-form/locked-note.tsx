import type { ReactNode } from 'react';

/**
 * Why a section is read-only, said once at the top of it rather than on every box
 * in it. A control a person cannot use and is not told why about is the worst of
 * the three states this screen can be in, because the dealer's conclusion is that
 * the page is broken.
 */
export function LockedNote({ children }: { children: ReactNode }) {
  return <p className="text-[12px] ink-subtle">{children}</p>;
}
