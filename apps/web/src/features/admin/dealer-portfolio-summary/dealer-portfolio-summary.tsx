import Link from 'next/link';

import { PORTFOLIO_QUEUE_PATH } from '@/features/admin/portfolio-actions.constants';

import { DEALER_PORTFOLIO_TEXT } from './dealer-portfolio-summary.constants';
import type { DealerPortfolioSummaryProps } from './dealer-portfolio-summary.types';
import { PortfolioTile } from './portfolio-tile';

export function DealerPortfolioSummary({ photos, dealerSlug }: DealerPortfolioSummaryProps) {
  const approved = photos.filter((photo) => photo.status === 'APPROVED').length;
  const pending = photos.filter((photo) => photo.status === 'PENDING').length;

  return (
    <section className="card gap-3 p-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-[19px]">{DEALER_PORTFOLIO_TEXT.heading}</h2>
        <Link href={PORTFOLIO_QUEUE_PATH} className="ml-auto text-[13px] text-(--color-accent)">
          {DEALER_PORTFOLIO_TEXT.queueLink}
        </Link>
      </div>
      <p className="text-[12px] ink-secondary">{DEALER_PORTFOLIO_TEXT.intro}</p>

      {photos.length === 0 ? (
        <p className="text-[13px] ink-muted">{DEALER_PORTFOLIO_TEXT.empty}</p>
      ) : (
        <>
          <p className="text-[12px] ink-muted tnum">
            {DEALER_PORTFOLIO_TEXT.summary(approved, pending)}
          </p>
          <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
            {photos.map((photo, index) => (
              <PortfolioTile key={photo.id} photo={photo} index={index} dealerSlug={dealerSlug} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
