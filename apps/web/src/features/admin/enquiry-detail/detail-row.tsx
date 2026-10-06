import type { ReactNode } from 'react';

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3 gap-y-[2px] border-b border-[rgba(20,23,28,0.08)] py-[8px] last:border-b-0">
      <dt className="text-[13px] ink-muted">{label}</dt>
      <dd className="m-0 text-right text-[13px] font-medium tnum">{children}</dd>
    </div>
  );
}
