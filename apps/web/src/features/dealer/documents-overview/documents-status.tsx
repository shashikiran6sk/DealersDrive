import { Banner } from '@/components/ui/primitives';

import { DOCUMENTS_TEXT } from './documents-overview.constants';
import type { DocumentsStatusProps } from './documents-overview.types';
import { gapLabels } from './utils';

export function DocumentsStatus({ gaps, active }: DocumentsStatusProps) {
  if (gaps.length === 0) {
    return (
      <p role="status" className="text-[14px] font-semibold text-(--color-ok)">
        {DOCUMENTS_TEXT.verified}
      </p>
    );
  }

  return (
    <Banner tone="warn" title={DOCUMENTS_TEXT.outstandingTitle}>
      <p>{DOCUMENTS_TEXT.outstandingLead}</p>
      <ul className="mt-[4px] list-disc pl-[18px]">
        {gapLabels(gaps).map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      {active ? <p className="mt-[8px]">{DOCUMENTS_TEXT.activeExplanation}</p> : null}
    </Banner>
  );
}
