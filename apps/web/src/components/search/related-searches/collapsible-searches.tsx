'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/cn';
import type { RelatedSearchGroup } from '@/types';

import { RelatedSearchGroups } from './related-search-groups';
import { COLLAPSED_ROW_CLASS, RELATED_SEARCHES_TEXT } from './related-searches.constants';

export interface CollapsibleSearchesProps {
  heading: string;
  groups: readonly RelatedSearchGroup[];
  className?: string;
}

export function CollapsibleSearches({ heading, groups, className }: CollapsibleSearchesProps) {
  const [open, setOpen] = useState(false);
  const [overflowing, setOverflowing] = useState(true);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    const element = panel.current;
    if (open || !element || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => setOverflowing(element.scrollHeight > element.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, [open]);

  return (
    <section aria-label={heading} className={cn('flex flex-col gap-3', className)}>
      <h2 className="text-[20px] leading-[1.2]">{heading}</h2>
      <div
        ref={panel}
        id={panelId}
        className={open ? 'flex flex-col gap-5' : cn('flex flex-wrap gap-2', COLLAPSED_ROW_CLASS)}
        onFocus={() => setOpen(true)}
      >
        <RelatedSearchGroups groups={groups} compact={!open} />
      </div>
      {open || overflowing ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="self-start text-[13px] font-bold underline underline-offset-4"
        >
          {open ? RELATED_SEARCHES_TEXT.seeLess : RELATED_SEARCHES_TEXT.seeMore}
        </button>
      ) : null}
    </section>
  );
}
