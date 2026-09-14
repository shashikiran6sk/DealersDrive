import type { ReactNode } from 'react';

/**
 * One column: a heading and a list. Each is its own labelled `<nav>`, named by
 * the heading a sighted reader sees — one landmark called "Footer" wrapping
 * everything hands a screen-reader user a single undifferentiated list of every
 * destination on the page, which is the thing a footer's columns exist to avoid.
 */
export function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <nav className="flex flex-col gap-[10px]" aria-label={title}>
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] ink-muted">{title}</h2>
      <ul className="flex flex-col gap-[7px]">{children}</ul>
    </nav>
  );
}
