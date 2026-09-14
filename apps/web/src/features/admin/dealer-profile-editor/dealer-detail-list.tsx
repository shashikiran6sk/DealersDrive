import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Tag } from '@/components/ui/primitives';
import { servicesOf } from '@/lib/services';

import { EMPTY_VALUE, FIELDS } from './dealer-profile-editor.constants';
import type { Values } from './dealer-profile-editor.types';

export interface DealerDetailListProps {
  values: Values;
  contactPhoneDisplay: AdminDealerDetail['contactPhoneDisplay'];
}

export function DealerDetailList({ values, contactPhoneDisplay }: DealerDetailListProps) {
  return (
    <dl>
      {FIELDS.map((field) =>
        'wide' in field ? (
          <div
            key={field.key}
            className="border-b border-(--color-divider) py-[9px] text-[13px] last:border-b-0"
          >
            <dt className="ink-muted">{field.label}</dt>
            <dd className="mt-[4px] font-medium">
              {'list' in field ? (
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
