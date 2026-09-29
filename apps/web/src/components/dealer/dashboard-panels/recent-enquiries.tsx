import type { DashboardResponse } from '@dealers-drive/contracts';

import { ButtonLink } from '@/components/ui/button';
import { Avatar } from '@/components/ui/primitives';

import { RECENT_ENQUIRIES_SHOWN, RECENT_ENQUIRIES_TEXT } from './dashboard-panels.constants';

export function RecentEnquiries({
  enquiries,
}: {
  enquiries: DashboardResponse['recentEnquiries'];
}) {
  return (
    <section className="card gap-0 p-5">
      <div className="mb-2 flex items-baseline gap-3">
        <h2 className="text-[18px]">{RECENT_ENQUIRIES_TEXT.heading}</h2>
        <ButtonLink
          href={RECENT_ENQUIRIES_TEXT.viewAllHref}
          variant="ghost"
          className="ml-auto text-[12px]"
        >
          {RECENT_ENQUIRIES_TEXT.viewAll}
        </ButtonLink>
      </div>

      {enquiries.length === 0 ? (
        <p className="py-6 text-center text-[13px] ink-muted">{RECENT_ENQUIRIES_TEXT.empty}</p>
      ) : (
        enquiries.slice(0, RECENT_ENQUIRIES_SHOWN).map((enquiry) => (
          <div
            key={enquiry.id}
            className="flex items-center gap-3 border-b border-(--color-divider) py-[10px] last:border-b-0"
          >
            <Avatar initials={enquiry.initials} size={30} />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-bold">{enquiry.name}</div>
              <div className="truncate text-[11px] ink-subtle">
                {enquiry.vehicleTitle ?? RECENT_ENQUIRIES_TEXT.generalEnquiry}
              </div>
            </div>
            <span className="whitespace-nowrap text-[11px] ink-faint">{enquiry.timeAgoLabel}</span>
            {enquiry.callHref && enquiry.phoneDisplay ? (
              <a
                href={enquiry.callHref}
                className="btn btn-secondary text-[11px]"
                aria-label={RECENT_ENQUIRIES_TEXT.callAriaLabel(enquiry.name, enquiry.phoneDisplay)}
              >
                {RECENT_ENQUIRIES_TEXT.callLabel}
              </a>
            ) : null}
          </div>
        ))
      )}
    </section>
  );
}
