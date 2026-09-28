'use client';

import { useSearchParams } from 'next/navigation';

import { EnquiryPanel } from './enquiry-panel';
import { ENQUIRE_PARAM } from './enquiry-panel.constants';
import type { EnquiryPanelProps } from './enquiry-panel.types';

export function EnquireFromUrl(props: Omit<EnquiryPanelProps, 'autoOpen'>) {
  const params = useSearchParams();
  return <EnquiryPanel {...props} autoOpen={params.get(ENQUIRE_PARAM) === '1'} />;
}
