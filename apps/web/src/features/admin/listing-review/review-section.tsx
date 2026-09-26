import type { AdminListingDetail } from '@dealers-drive/contracts';

import { LISTING_REVIEW_TEXT } from './listing-review.constants';

export function ReviewSection({ section }: { section: AdminListingDetail['sections'][number] }) {
  const id = `section-${section.key}`;
  return (
    <section aria-labelledby={id} className="border border-(--color-divider) bg-white">
      <h2 id={id} className="border-b border-(--color-divider) px-[14px] py-[10px] text-[15px]">
        {section.title}
      </h2>
      <dl>
        {section.rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between gap-3 border-b border-[rgba(20,23,28,0.08)] px-[14px] py-[9px] last:border-b-0"
          >
            <dt className="text-[13px] ink-muted">{row.label}</dt>
            <dd
              className={`text-right text-[13px] tnum ${row.value ? 'font-medium' : 'ink-faint'}`}
            >
              {row.value ?? LISTING_REVIEW_TEXT.notEntered}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
