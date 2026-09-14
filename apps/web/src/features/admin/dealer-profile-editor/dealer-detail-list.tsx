import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Tag } from '@/components/ui/primitives';
import { servicesOf } from '@/lib/services';

import { EMPTY_VALUE, FIELDS } from './dealer-profile-editor.constants';
import type { Values } from './dealer-profile-editor.types';

export interface DealerDetailListProps {
  values: Values;
  contactPhoneDisplay: AdminDealerDetail['contactPhoneDisplay'];
}

/** The read view — a review screen full of live inputs invites edits meant as readings. */
export function DealerDetailList({ values, contactPhoneDisplay }: DealerDetailListProps) {
  return (
    <dl>
      {FIELDS.map((field) =>
        'wide' in field ? (
          /*
            A sentence and a row of chips do not belong in the label-left,
            value-right rhythm the rest of the list keeps: at 13px a tagline wraps
            to two ragged right-aligned lines and a service list to three. Stacked
            and left-aligned they read the way they will on the public page —
            which is what the reviewer is being asked to judge.
          */
          <div
            key={field.key}
            className="border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
          >
            <dt className="ink-muted">{field.label}</dt>
            <dd className="mt-[4px] font-medium">
              {'list' in field ? (
                /* As chips rather than the comma string the box holds: a moderator
                   is comparing this against the public page, and the shape makes a
                   dealership that typed one seventy-word "service" obvious at a
                   glance rather than on a character count. */
                servicesOf(values[field.key]).length > 0 ? (
                  <span className="flex flex-wrap gap-[6px]">
                    {servicesOf(values[field.key]).map((service) => (
                      <Tag key={service} variant="neutral" className="text-[11px]">
                        {service}
                      </Tag>
                    ))}
                  </span>
                ) : (
                  EMPTY_VALUE
                )
              ) : (
                values[field.key] || EMPTY_VALUE
              )}
            </dd>
          </div>
        ) : (
          <div
            key={field.key}
            className="flex justify-between gap-4 border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
          >
            <dt className="ink-muted">{field.label}</dt>
            <dd className={`text-right font-medium${field.mono ? ' font-mono' : ''}`}>
              {/* Formatted while it is being read and raw while it is being
                  edited — `+91 98400 12345` is what a reviewer checks against a
                  letterhead, `9840012345` is what the field accepts back. */}
              {field.key === 'contactPhone'
                ? (contactPhoneDisplay ?? EMPTY_VALUE)
                : values[field.key] || EMPTY_VALUE}
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}
