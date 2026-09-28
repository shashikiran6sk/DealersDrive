import { qs } from '@/lib/api';

import { MY_ENQUIRIES_PATH } from './customer-enquiries.constants';

export function myEnquiriesHref(cursor?: string): string {
  return `${MY_ENQUIRIES_PATH}${qs({ cursor })}`;
}
