import { EmptyState } from '@/components/ui/primitives';

import { PortfolioModerationCard } from './portfolio-moderation-card';
import { PORTFOLIO_MODERATION_TEXT } from './portfolio-moderation.constants';
import type { PortfolioModerationQueueProps } from './portfolio-moderation.types';
import { PortfolioModerationTabs } from './portfolio-moderation-tabs';

export function PortfolioModerationQueue({ queue, status }: PortfolioModerationQueueProps) {
  const empty =
    status === 'PENDING'
      ? {
          title: PORTFOLIO_MODERATION_TEXT.emptyPendingTitle,
          message: PORTFOLIO_MODERATION_TEXT.emptyPendingMessage,
        }
      : {
          title: PORTFOLIO_MODERATION_TEXT.emptyRejectedTitle,
          message: PORTFOLIO_MODERATION_TEXT.emptyRejectedMessage,
        };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-[26px]">{PORTFOLIO_MODERATION_TEXT.title}</h1>
        <span className="text-[13px] ink-muted tnum">
          {PORTFOLIO_MODERATION_TEXT.count(queue.data.length)}
        </span>
      </div>
      <p className="max-w-[80ch] text-[13px] ink-secondary">{PORTFOLIO_MODERATION_TEXT.intro}</p>

      <PortfolioModerationTabs active={status} />

      {queue.data.length === 0 ? (
        <EmptyState title={empty.title} message={empty.message} />
      ) : (
        <ul
          aria-label={PORTFOLIO_MODERATION_TEXT.listLabel}
          className="m-0 flex list-none flex-col gap-3 p-0"
        >
          {queue.data.map((photo) => (
            <PortfolioModerationCard key={photo.id} photo={photo} />
          ))}
        </ul>
      )}
    </div>
  );
}
