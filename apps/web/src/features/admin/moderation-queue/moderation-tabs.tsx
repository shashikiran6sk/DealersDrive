import Link from 'next/link';

import { qs } from '@/lib/api';

import {
  MODERATION_PATH,
  MODERATION_TABS,
  MODERATION_TEXT,
  REACTIVATION_VIEW,
} from './moderation-queue.constants';
import type { ModerationTabsProps } from './moderation-queue.types';

export function ModerationTabs({ active, counts, reactivationPending, q }: ModerationTabsProps) {
  return (
    <nav aria-label={MODERATION_TEXT.tabsLabel} className="overflow-x-auto">
      <div className="seg">
        {MODERATION_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`${MODERATION_PATH}${qs({
              status: tab.value === 'PENDING_REVIEW' ? undefined : tab.value,
              q,
            })}`}
            aria-current={active === tab.value ? 'page' : undefined}
            aria-selected={active === tab.value}
            className="seg-opt whitespace-nowrap no-underline"
          >
            {tab.label}
            <span className="tnum ink-subtle">{counts[tab.value] ?? 0}</span>
          </Link>
        ))}
        <Link
          href={`${MODERATION_PATH}${qs({ view: REACTIVATION_VIEW })}`}
          aria-current={active === 'REACTIVATION' ? 'page' : undefined}
          aria-selected={active === 'REACTIVATION'}
          className="seg-opt whitespace-nowrap no-underline"
        >
          {MODERATION_TEXT.reactivationTab}
          <span className="tnum ink-subtle">{reactivationPending}</span>
        </Link>
      </div>
    </nav>
  );
}
