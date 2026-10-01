import { qs } from '@/lib/api';

import { ENQUIRY_OVERSIGHT_PATH } from './enquiry-oversight.constants';
import type { EnquiryOversightFilters } from './enquiry-oversight.types';

export function oversightHref(filters: EnquiryOversightFilters & { cursor?: string }): string {
  return `${ENQUIRY_OVERSIGHT_PATH}${qs({
    status: filters.status,
    q: filters.q,
    dealer: filters.dealer,
    from: filters.from,
    to: filters.to,
    cursor: filters.cursor,
  })}`;
}

export function isFiltered(filters: EnquiryOversightFilters): boolean {
  return Boolean(filters.q || filters.dealer || filters.from || filters.to);
}
