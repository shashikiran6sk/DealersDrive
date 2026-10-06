import type { SalesDealerSummary } from '@dealers-drive/contracts';
import Link from 'next/link';

import { StatusTag } from '@/components/ui/primitives';
import { SALES_TEXT } from '@/features/sales/sales.constants';
import { VerificationBadges } from '@/features/sales/verification-badges';

export function SalesDealerList({
  dealers,
  emptyLabel,
}: {
  dealers: SalesDealerSummary[];
  emptyLabel: string;
}) {
  if (dealers.length === 0) {
    return (
      <p className="rounded-[14px] border border-(--color-divider) bg-white p-5 text-[13px] ink-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {dealers.map((dealer) => (
        <li key={dealer.id}>
          <Link
            href={`/sales/dealers/${dealer.id}`}
            className="flex flex-col gap-2 rounded-[14px] border border-(--color-divider) bg-white p-4 no-underline hover:border-(--color-ink)"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 flex-1 text-[15px] font-semibold break-words">
                {dealer.legalName}
              </span>
              <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
            </div>
            <div className="text-[12px] ink-muted">
              {[dealer.contactName, dealer.phoneDisplay, dealer.city, dealer.district]
                .filter(Boolean)
                .join(' · ')}
            </div>
            <VerificationBadges dealer={dealer} />
            <div className="text-[12px] ink-muted tnum">
              {SALES_TEXT.listings(
                dealer.listings.draft,
                dealer.listings.review,
                dealer.listings.live,
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
