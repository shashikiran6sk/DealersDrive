import type { ReactNode } from 'react';

export function ReviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-(--color-divider) pb-3 last:border-b-0 last:pb-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-[6px]">{children}</dd>
    </div>
  );
}
