import type { ReactNode } from 'react';

/**
 * One column on a phone, four on a desktop — `auto-fill` rather than fixed
 * counts, so a state with three districts does not leave a gap the width of a
 * fourth.
 */
export function DistrictGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
      {children}
    </div>
  );
}
