import type { ReactNode } from 'react';

export function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="flex flex-col gap-[10px]" aria-label={title}>
      <h2 className="text-[12px] font-extrabold uppercase tracking-[0.08em] ink-muted">{title}</h2>
      <ul className="flex flex-col gap-[7px]">{children}</ul>
    </nav>
  );
}
