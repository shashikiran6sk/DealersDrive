import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';

import { CUSTOMER_ENQUIRIES_TEXT } from './customer-enquiries.constants';
import type { CustomerEnquiryListProps } from './customer-enquiries.types';
import { CustomerEnquiryCard } from './customer-enquiry-card';
import { myEnquiriesHref } from './utils';

export function CustomerEnquiryList({ enquiries }: CustomerEnquiryListProps) {
  return (
    <div className="flex flex-col gap-[16px]">
      <div>
        <h1 className="text-[26px] sm:text-[30px]">{CUSTOMER_ENQUIRIES_TEXT.title}</h1>
        <p className="mt-[6px] text-[14px] ink-muted">{CUSTOMER_ENQUIRIES_TEXT.intro}</p>
      </div>

      {enquiries.data.length === 0 ? (
        <EmptyState
          title={CUSTOMER_ENQUIRIES_TEXT.emptyTitle}
          message={CUSTOMER_ENQUIRIES_TEXT.emptyMessage}
          action={
            <ButtonLink href={CUSTOMER_ENQUIRIES_TEXT.browseHref} variant="primary">
              {CUSTOMER_ENQUIRIES_TEXT.browse}
            </ButtonLink>
          }
        />
      ) : (
        <ul
          aria-label={CUSTOMER_ENQUIRIES_TEXT.listLabel}
          className="m-0 flex list-none flex-col gap-[10px] p-0"
        >
          {enquiries.data.map((enquiry) => (
            <CustomerEnquiryCard key={enquiry.id} enquiry={enquiry} />
          ))}
        </ul>
      )}

      {enquiries.page.nextCursor ? (
        <Link
          href={myEnquiriesHref(enquiries.page.nextCursor)}
          className="btn btn-secondary self-center"
        >
          {CUSTOMER_ENQUIRIES_TEXT.more}
        </Link>
      ) : null}
    </div>
  );
}
