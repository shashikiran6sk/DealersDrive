import type { EnquiryStatus } from '@dealers-drive/contracts';

import { qs } from '@/lib/api';

import { ENQUIRIES_PATH } from './enquiries.constants';

export function enquiriesHref(params: { status?: EnquiryStatus; cursor?: string }): string {
  return `${ENQUIRIES_PATH}${qs(params)}`;
}
