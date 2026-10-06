'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/primitives';
import type { ListingActionResult } from '@/features/admin/listing-actions';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

import { LISTING_REVIEW_TEXT } from './listing-review.constants';

export interface ApproveDialogProps {
  submit: () => Promise<ListingActionResult>;
}

export function ApproveDialog({ submit }: ApproveDialogProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useNavigationSafeAction();

  function confirm() {
    startTransition(async () => {
      const result = await submit();
      if (result.ok) {
        setOpen(false);
        setMessage(undefined);
      } else {
        setMessage(result.message);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={LISTING_REVIEW_TEXT.approveTitle}
      description={LISTING_REVIEW_TEXT.approveBody}
      trigger={
        <Button variant="primary" size="md">
          {LISTING_REVIEW_TEXT.approve}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            {LISTING_REVIEW_TEXT.cancel}
          </Button>
          <Button variant="primary" onClick={confirm} loading={pending}>
            {LISTING_REVIEW_TEXT.approveConfirm}
          </Button>
        </>
      }
    >
      {message ? <Banner tone="err">{message}</Banner> : null}
    </Dialog>
  );
}
