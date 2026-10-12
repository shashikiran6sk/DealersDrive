'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Banner } from '@/components/ui/primitives';

import { PORTFOLIO_TEXT } from './portfolio-manager.constants';
import type { PortfolioRemoveDialogProps } from './portfolio-manager.types';

export function PortfolioRemoveDialog({
  title,
  description,
  trigger,
  onConfirm,
}: PortfolioRemoveDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm(): Promise<void> {
    setBusy(true);
    setError(null);
    const failure = await onConfirm();
    setBusy(false);
    if (failure) {
      setError(failure);
      return;
    }
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) setError(null);
      }}
      title={title}
      description={description}
      trigger={trigger}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
            {PORTFOLIO_TEXT.cancel}
          </Button>
          <Button variant="danger" loading={busy} onClick={() => void confirm()}>
            {PORTFOLIO_TEXT.removeConfirm}
          </Button>
        </>
      }
    >
      {error ? <Banner tone="err">{error}</Banner> : null}
    </Dialog>
  );
}
