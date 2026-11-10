import Link from 'next/link';
import type { CSSProperties } from 'react';

import { LinkPendingLabel } from '@/components/ui/link-pending';

import { categoryAnchor, HOME_SEARCH_PATH } from '../home.constants';
import { CategoryCars } from './category-cars';
import type { CategoryCardProps } from './category-deck.types';
import { DECK_STACK_STEP_PX, DECK_STICKY_OFFSET_PX, DECK_TEXT } from './category-deck.constants';
import { headingId } from './utils';

export function CategoryCard({ category, position, total }: CategoryCardProps) {
  const hasCars = category.cars.length > 0;
  const heading = headingId(category.key);
  const style: CSSProperties & { '--deck-top': string } = {
    '--deck-top': `${String(DECK_STICKY_OFFSET_PX + position * DECK_STACK_STEP_PX)}px`,
  };

  return (
    <article
      id={categoryAnchor(category.key)}
      aria-labelledby={heading}
      data-deck-card
      style={style}
      className="dd-deck-card relative overflow-clip rounded-[28px] border border-(--color-divider) bg-white shadow-lg md:sticky md:top-[calc(var(--header-height)+var(--deck-top))] [@media(max-height:640px)]:static"
    >
      <div className="grid h-full md:min-h-[min(560px,calc(100svh-var(--header-height)-120px))] md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-4 p-5 max-md:gap-3 md:p-9">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[12px] ink-muted">
              {DECK_TEXT.position(position, total)}
            </span>
            {category.featured ? (
              <span className="rounded-full border border-(--color-divider) bg-(--color-bg) px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em]">
                {DECK_TEXT.featured}
              </span>
            ) : null}
          </div>
          <h3
            id={heading}
            className="text-[36px] leading-none tracking-[-0.05em] md:text-[clamp(40px,4.4vw,64px)]"
          >
            {category.title}
          </h3>
          <p className="max-w-[44ch] text-[15px] leading-[1.7] ink-secondary md:text-[16px]">
            {category.description}
          </p>
          <dl className="flex flex-wrap gap-2">
            {category.facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-full bg-(--color-bg) px-3 py-1.5 text-[12px] font-bold ink-secondary max-md:[&:nth-child(n+3)]:hidden"
              >
                <dt className="mr-1 inline font-semibold ink-muted">{fact.label}</dt>
                <dd className="inline">{fact.value}</dd>
              </div>
            ))}
          </dl>
          <Link
            href={hasCars ? category.href : HOME_SEARCH_PATH}
            className="relative btn btn-primary mt-auto self-start"
          >
            <LinkPendingLabel>
              {hasCars ? category.browseLabel : DECK_TEXT.seeEveryCar}
            </LinkPendingLabel>
          </Link>
        </div>
        <div className="bg-(--color-neutral-100) max-md:order-first">
          <CategoryCars category={category} />
        </div>
      </div>
    </article>
  );
}
