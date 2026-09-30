'use client';

import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import type { ListingActionResult } from '@/features/admin/listing-actions';

import { LISTING_REVIEW_TEXT, MIN_REASON } from './listing-review.constants';

export interface DecisionDialogProps {
  id: string;
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  primary?: boolean;
  optional?: boolean;
  reasonLabel?: string;
  reasonHint?: string;
  size?: 'sm' | 'md';
  submit: (reason: string) => Promise<ListingActionResult>;
}

export function DecisionDialog({
  id,
  triggerLabel,
  title,
  description,
  confirmLabel,
  destructive = false,
  primary = false,
  optional = false,
  reasonLabel = LISTING_REVIEW_TEXT.reasonLabel,
  reasonHint = LISTING_REVIEW_TEXT.reasonHint,
  size = 'md',
  submit,
}: DecisionDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<string>();
  const [pending, startTransition] = useTransition();
  const ready = optional || reason.trim().length >= MIN_REASON;

  function confirm() {
    startTransition(async () => {
      const result = await submit(reason.trim());
      if (result.ok) {
        setOpen(false);
        setReason('');
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
      title={title}
      description={description}
      trigger={
        <Button
          variant={destructive ? 'destructive' : primary ? 'primary' : 'secondary'}
          size={size}
        >
          {triggerLabel}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            {LISTING_REVIEW_TEXT.cancel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={confirm}
            disabled={!ready}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {message ? <Banner tone="err">{message}</Banner> : null}
        <Field id={id} label={reasonLabel} hint={reasonHint}>
          <Textarea
            id={id}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={500}
            autoFocus
          />
        </Field>
      </div>
    </Dialog>
  );
}
