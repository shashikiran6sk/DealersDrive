import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { Banner } from '@/components/ui/primitives';

import { DOCUMENTS_HREF, DOCUMENTS_TEXT } from './documents-overview.constants';
import type { DocumentsReminderProps } from './documents-overview.types';
import { gapLabels } from './utils';

export function DocumentsReminder({ gaps }: DocumentsReminderProps) {
  if (gaps.length === 0) return null;

  return (
    <Banner
      tone="warn"
      title={DOCUMENTS_TEXT.reminderTitle}
      action={
        <Link href={DOCUMENTS_HREF} className="relative btn btn-secondary text-[12px]">
          <LinkPendingLabel>{DOCUMENTS_TEXT.reminderAction}</LinkPendingLabel>
        </Link>
      }
    >
      {DOCUMENTS_TEXT.reminderBody(gapLabels(gaps))}
    </Banner>
  );
}
