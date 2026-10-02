'use client';

import { canDealer, enquiryTransitionPermission } from '@dealers-drive/contracts';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { setEnquiryStatusAction } from '@/features/dealer/enquiry-actions';

import { ENQUIRIES_TEXT, ENQUIRY_MOVES } from './enquiries.constants';
import type { EnquiryStatusActionsProps } from './enquiries.types';

export function EnquiryStatusActions({
  enquiryId,
  status,
  customerName,
  permissions,
}: EnquiryStatusActionsProps) {
  const [pending, startTransition] = useTransition();
  const [moving, setMoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const moves = ENQUIRY_MOVES[status].filter(
    (move) =>
      permissions === undefined ||
      canDealer(permissions, enquiryTransitionPermission(status, move.to)),
  );
  if (moves.length === 0) return null;

  return (
    <div className="ml-auto flex flex-col items-end gap-[4px]">
      <div
        role="group"
        aria-label={ENQUIRIES_TEXT.actionsLabel(customerName)}
        className="flex flex-wrap items-center justify-end gap-[6px]"
      >
        {moves.map((move) => (
          <Button
            key={move.to}
            variant="ghost"
            className="min-h-[36px]"
            disabled={pending}
            loading={pending && moving === move.to}
            onClick={() => {
              setError(null);
              setMoving(move.to);
              startTransition(async () => {
                const result = await setEnquiryStatusAction(enquiryId, move.to);
                if (!result.ok) setError(result.message);
                setMoving(null);
              });
            }}
          >
            {move.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="m-0 text-right text-[12px] text-(--color-err)">
          {error}
        </p>
      ) : null}
    </div>
  );
}
