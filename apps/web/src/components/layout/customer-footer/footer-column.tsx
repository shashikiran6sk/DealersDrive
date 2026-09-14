import type { ReactNode } from 'react';

export function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="flex flex-col gap-[10px]" aria-label={title}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] ink-muted">{title}</h2>
      <ul className="flex flex-col gap-[7px]">{children}</ul>
    </nav>
  );
}
