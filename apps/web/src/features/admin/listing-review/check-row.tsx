import type { AdminListingDetail } from '@dealers-drive/contracts';
import { formatDate } from '@dealers-drive/contracts';

import { setListingCheckAction } from '@/features/admin/listing-actions';

import { LISTING_REVIEW_TEXT } from './listing-review.constants';

export function CheckRow({
  listingId,
  check,
  editable,
}: {
  listingId: string;
  check: AdminListingDetail['checks'][number];
  editable: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start gap-[10px] border-b border-[rgba(20,23,28,0.08)] py-[10px]">
      <span
        aria-hidden="true"
        className={`mt-[2px] inline-flex h-[18px] w-[18px] flex-none items-center justify-center border text-[12px] ${
          check.checked
            ? 'border-(--color-ok) bg-(--color-ok-bg) text-(--color-ok)'
            : 'border-(--color-divider) bg-white'
        }`}
      >
        {check.checked ? '✓' : ''}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium">{check.label}</div>
        <div className="text-[12px] ink-subtle">{check.hint}</div>
        {check.checked && check.checkedAt ? (
          <div className="text-[11px] text-(--color-ok)">
            {LISTING_REVIEW_TEXT.checkedOn(formatDate(check.checkedAt))}
          </div>
        ) : null}
      </div>
      {editable ? (
        <form action={setListingCheckAction}>
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="key" value={check.key} />
          <input type="hidden" name="checked" value={check.checked ? 'false' : 'true'} />
          <button
            type="submit"
            aria-pressed={check.checked}
            aria-label={`${check.checked ? LISTING_REVIEW_TEXT.uncheck : LISTING_REVIEW_TEXT.check}: ${check.label}`}
            className={`btn text-[12px] ${check.checked ? 'btn-ghost' : 'btn-secondary'}`}
          >
            {check.checked ? LISTING_REVIEW_TEXT.uncheck : LISTING_REVIEW_TEXT.check}
          </button>
        </form>
      ) : null}
    </li>
  );
}
