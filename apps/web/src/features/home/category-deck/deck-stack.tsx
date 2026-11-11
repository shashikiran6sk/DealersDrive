'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/cn';

import type { DeckStackProps } from './category-deck.types';
import { DeckProgress } from './deck-progress';
import { coverProgress, isBeside, nearestToStart } from './utils';

export function DeckStack({ children, total, className }: DeckStackProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window.matchMedia !== 'function') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-deck-card]'));
    let frame = 0;

    const update = () => {
      frame = 0;
      const rects = cards.map((card) => card.getBoundingClientRect());
      const [first, second] = rects;
      const swiping = first !== undefined && second !== undefined && isBeside(first, second);
      cards.forEach((card, index) => {
        const rect = rects[index];
        const next = rects[index + 1];
        const cover = rect && next && !swiping && !reduce.matches ? coverProgress(rect, next) : 0;
        card.style.setProperty('--deck-cover', cover.toFixed(3));
      });
      if (swiping) setCurrent(nearestToStart(root.getBoundingClientRect(), rects));
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    root.addEventListener('scroll', schedule, { passive: true });
    reduce.addEventListener('change', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      root.removeEventListener('scroll', schedule);
      reduce.removeEventListener('change', schedule);
    };
  }, []);

  const step = (by: -1 | 1) => {
    const cards = ref.current?.querySelectorAll<HTMLElement>('[data-deck-card]');
    cards?.[current + by]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest',
    });
  };

  return (
    <>
      {total ? <DeckProgress current={current} total={total} onStep={step} /> : null}
      <div
        ref={ref}
        className={cn(
          'flex flex-col gap-7 max-md:-mx-4 max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:flex-row max-md:gap-3.5 max-md:overflow-x-auto max-md:px-4 max-md:pt-3 max-md:pb-6 max-md:[scrollbar-width:none] sm:max-md:-mx-6 sm:max-md:scroll-px-6 sm:max-md:px-6 max-md:[&::-webkit-scrollbar]:hidden',
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}
