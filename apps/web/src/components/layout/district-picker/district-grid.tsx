import type { ReactNode } from 'react';

export function DistrictGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
      {children}
    </div>
  );
}
