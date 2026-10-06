import type { DealerEnquiry } from '@dealers-drive/contracts';

import { HANDLED_BY_TEXT } from './enquiries.constants';

export function EnquiryHandledBy({ enquiry }: { enquiry: DealerEnquiry }) {
  const { contactedBy, closedBy } = enquiry;
  if (!contactedBy && !closedBy) return null;

  return (
    <div className="flex flex-wrap gap-x-[14px] gap-y-[2px] text-[12px] ink-subtle tnum">
      {contactedBy ? (
        <span>{HANDLED_BY_TEXT.contacted(contactedBy.name, contactedBy.atLabel)}</span>
      ) : null}
      {closedBy && enquiry.status === 'CLOSED' ? (
        <span>{HANDLED_BY_TEXT.closed(closedBy.name, closedBy.atLabel)}</span>
      ) : null}
    </div>
  );
}
