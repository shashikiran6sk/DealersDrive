'use client';

import { formatDate, formatPhone, normaliseDealerContact } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, StatusTag } from '@/components/ui/primitives';
import { approveCustomerContactAction } from '@/features/admin/actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { CUSTOMER_CONTACT_TEXT } from './customer-contact-approval.constants';
import type { CustomerContactApprovalProps } from './customer-contact-approval.types';

export function CustomerContactApproval({
  dealerId,
  landline,
  approvedAt,
}: CustomerContactApprovalProps) {
  const router = useRouter();
  const [pending, startTransition] = useNavigationSafeAction();
  const [message, setMessage] = useState<string | null>(null);

  const usable = landline ? normaliseDealerContact(landline) : null;

  function approve(): void {
    setMessage(null);
    startTransition(async () => {
      const result = await approveCustomerContactAction(dealerId);
      if (!result.ok) {
        setMessage(result.message ?? CUSTOMER_CONTACT_TEXT.failed);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="card gap-3 p-4">
      <h2 className="text-[19px]">{CUSTOMER_CONTACT_TEXT.heading}</h2>
      {message ? <Banner tone="err">{message}</Banner> : null}
      {!landline ? <p className="text-[13px] ink-muted">{CUSTOMER_CONTACT_TEXT.none}</p> : null}
      {landline && !usable ? (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[15px]">{landline}</span>
          <p className="text-[13px] ink-muted">{CUSTOMER_CONTACT_TEXT.invalid}</p>
        </div>
      ) : null}
      {usable ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[15px] tnum">{formatPhone(usable)}</span>
          {approvedAt ? (
            <StatusTag tone="ok">
              {CUSTOMER_CONTACT_TEXT.approvedOn(formatDate(approvedAt))}
            </StatusTag>
          ) : (
            <>
              <StatusTag tone="warn">{CUSTOMER_CONTACT_TEXT.notApproved}</StatusTag>
              <Button variant="primary" loading={pending} onClick={approve}>
                {CUSTOMER_CONTACT_TEXT.approve}
              </Button>
            </>
          )}
        </div>
      ) : null}
      <p className="text-[12px] ink-secondary">{CUSTOMER_CONTACT_TEXT.hint}</p>
    </section>
  );
}
