'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

import { FINAL_MOVE_TEXT } from './enquiries.constants';
import type { FinalMoveDialogProps } from './enquiries.types';

export function FinalMoveDialog({
  to,
  label,
  customerName,
  disabled,
  loading,
  onConfirm,
}: FinalMoveDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title={FINAL_MOVE_TEXT.title[to]}
      trigger={
        <Button variant="ghost" className="min-h-[36px]" disabled={disabled} loading={loading}>
          {label}
        </Button>
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            {FINAL_MOVE_TEXT.cancel}
          </Button>
          <Button
            variant={to === 'SPAM' ? 'danger' : 'primary'}
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {FINAL_MOVE_TEXT.confirm[to]}
          </Button>
        </>
      }
    >
      <p className="m-0 text-[14px] leading-[1.55] ink-secondary">
        {FINAL_MOVE_TEXT.description[to](customerName)}
      </p>
    </Dialog>
  );
}
