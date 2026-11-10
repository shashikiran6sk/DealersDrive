'use client';

import { useEffect, useRef } from 'react';

import { cn } from '@/lib/cn';

import type { DeckStackProps } from './category-deck.types';
import { coverProgress } from './utils';

export function DeckStack({ children, className }: DeckStackProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window.matchMedia !== 'function') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-deck-card]'));
    let frame = 0;

    const update = () => {
      frame = 0;
      cards.forEach((card, index) => {
        const next = cards[index + 1];
        const cover =
          next && !reduce.matches
            ? coverProgress(card.getBoundingClientRect(), next.getBoundingClientRect())
            : 0;
        card.style.setProperty('--deck-cover', cover.toFixed(3));
      });
    };
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    reduce.addEventListener('change', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      reduce.removeEventListener('change', schedule);
    };
  }, []);

  return (
    <div ref={ref} className={cn('flex flex-col gap-7', className)}>
      {children}
    </div>
  );
}
