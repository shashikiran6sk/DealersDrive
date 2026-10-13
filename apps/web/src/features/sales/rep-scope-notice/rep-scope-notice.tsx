'use client';
import Link from 'next/link';
import { useLegalEnabled } from '@/features/legal/legal-provider';
import { Banner } from '@/components/ui/primitives';
import { SALES_TEXT } from '@/features/sales/sales.constants';

export function RepScopeNotice({ businessComplete }: { businessComplete: boolean }) {
  const legal = useLegalEnabled();
  return (
    <Banner
      tone={businessComplete ? 'ok' : 'warn'}
      title={businessComplete ? SALES_TEXT.repDoneTitle : SALES_TEXT.repPendingTitle}
    >
      <p>{SALES_TEXT.repScopeNote}</p>
      {legal ? (
        <p>
          {SALES_TEXT.ownerAcceptanceNote}{' '}
          <Link href="/dealer/onboarding?step=3" className="underline">
            {SALES_TEXT.ownerReviewLink}
          </Link>
        </p>
      ) : null}
    </Banner>
  );
}
