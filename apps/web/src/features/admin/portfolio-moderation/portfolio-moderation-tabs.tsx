import Link from 'next/link';

import { qs } from '@/lib/api';
import { PORTFOLIO_QUEUE_PATH } from '@/features/admin/portfolio-actions.constants';

import {
  PORTFOLIO_MODERATION_TABS,
  PORTFOLIO_MODERATION_TEXT,
} from './portfolio-moderation.constants';
import type { PortfolioModerationTabsProps } from './portfolio-moderation.types';

export function PortfolioModerationTabs({ active }: PortfolioModerationTabsProps) {
  return (
    <nav aria-label={PORTFOLIO_MODERATION_TEXT.tabsLabel} className="overflow-x-auto">
      <div className="seg">
        {PORTFOLIO_MODERATION_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`${PORTFOLIO_QUEUE_PATH}${qs({
              status: tab.value === 'PENDING' ? undefined : tab.value,
            })}`}
            aria-current={active === tab.value ? 'page' : undefined}
            aria-selected={active === tab.value}
            className="seg-opt whitespace-nowrap no-underline"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
