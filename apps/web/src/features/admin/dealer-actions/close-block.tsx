'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { closeDealerAction } from '@/features/admin/actions';

import { DEALER_ACTIONS_TEXT, MIN_REASON } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface CloseBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
  reason: string;
  onReasonChange: (value: string) => void;
}

export function CloseBlock({ dealer, pending, run, reason, onReasonChange }: CloseBlockProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
      <Field
        id="closeReason"
        label={DEALER_ACTIONS_TEXT.closeLabel}
        className="min-w-[240px] max-md:min-w-0 max-md:max-w-full flex-1"
      >
        <Input
          id="closeReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={DEALER_ACTIONS_TEXT.verbatimPlaceholder}
        />
      </Field>
      <Button
        variant="secondary"
        size="md"
        loading={pending}
        disabled={reason.trim().length < MIN_REASON}
        onClick={() =>
          run(
            () => closeDealerAction(dealer.id, { reason: reason.trim() }, dealer.slug),
            DEALER_ACTIONS_TEXT.closed,
          )
        }
      >
        {DEALER_ACTIONS_TEXT.close}
      </Button>
      <p className="w-full text-[12px] ink-muted">{DEALER_ACTIONS_TEXT.closeNote}</p>
    </div>
  );
}
