'use client';

import { creditsLabel } from '@dealers-drive/contracts';

import { ADD_VEHICLE_HREF } from '@/components/dealer/console-nav';
import { Button, ButtonLink } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';

import { BILLING_TEXT } from './billing.constants';
import type { PurchaseOutcome } from './purchase-result.types';

export interface PurchaseResultProps {
  outcome: PurchaseOutcome | null;
  onClose: () => void;
  onRetry: (packId: string) => void;
  returnFocus: () => void;
  offerAddVehicle?: boolean;
}

const TEXT = BILLING_TEXT.result;

function headline(outcome: PurchaseOutcome): { title: string; body: string } {
  switch (outcome.kind) {
    case 'paid':
      return {
        title: TEXT.paidTitle,
        body: TEXT.paidBody(creditsLabel(outcome.credits), creditsLabel(outcome.available)),
      };
    case 'pending':
      return { title: TEXT.pendingTitle, body: TEXT.pendingBody };
    case 'unconfirmed':
      return { title: TEXT.unconfirmedTitle, body: outcome.message };
    case 'failed':
      return { title: TEXT.failedTitle, body: TEXT.failedBody };
  }
}

export function PurchaseResult({
  outcome,
  onClose,
  onRetry,
  returnFocus,
  offerAddVehicle = false,
}: PurchaseResultProps) {
  if (!outcome) return null;
  const { title, body } = headline(outcome);
  const paymentId = outcome.kind === 'failed' ? null : outcome.paymentId;
  const amountLabel =
    outcome.kind === 'paid' || outcome.kind === 'pending' ? outcome.amountLabel : null;

  const footer =
    outcome.kind === 'failed' ? (
      <>
        <Button variant="secondary" onClick={onClose}>
          {TEXT.close}
        </Button>
        <Button variant="primary" onClick={() => onRetry(outcome.packId)}>
          {TEXT.tryAgain}
        </Button>
      </>
    ) : (
      <>
        <Button
          variant={offerAddVehicle && outcome.kind === 'paid' ? 'secondary' : 'primary'}
          onClick={onClose}
        >
          {TEXT.done}
        </Button>
        {offerAddVehicle && outcome.kind === 'paid' ? (
          <ButtonLink variant="primary" href={ADD_VEHICLE_HREF}>
            {TEXT.addVehicle}
          </ButtonLink>
        ) : null}
      </>
    );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={title}
      description={body}
      closeLabel={TEXT.close}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus();
      }}
      footer={footer}
      className="w-[440px]"
      contentClassName={paymentId ? undefined : 'hidden'}
    >
      {paymentId ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          {amountLabel ? (
            <>
              <dt className="ink-muted">{TEXT.amount}</dt>
              <dd className="tnum">{amountLabel}</dd>
            </>
          ) : null}
          <dt className="ink-muted">{TEXT.paymentId}</dt>
          <dd className="font-mono break-all">{paymentId}</dd>
          {outcome.kind === 'paid' ? null : (
            <dd className="col-span-2 mt-2 text-[12px] ink-subtle">{TEXT.quoteId}</dd>
          )}
        </dl>
      ) : null}
    </Dialog>
  );
}
