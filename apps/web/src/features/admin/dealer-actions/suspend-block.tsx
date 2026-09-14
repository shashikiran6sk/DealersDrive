'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { suspendDealerAction } from '@/features/admin/actions';

import { DEALER_ACTIONS_TEXT, MIN_REASON } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface SuspendBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
  reason: string;
  onReasonChange: (value: string) => void;
}

/**
 * Suspending pulls every one of this dealer's listings out of the catalogue at
 * once, so the count is stated before the button is pressed (rule 6) — and the
 * button stays disabled until there is a reason of substance behind it, because
 * the dealer reads that reason verbatim.
 */
export function SuspendBlock({ dealer, pending, run, reason, onReasonChange }: SuspendBlockProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
      <Field id="suspendReason" label={DEALER_ACTIONS_TEXT.suspendLabel} className="min-w-[240px] flex-1">
        <Input
          id="suspendReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={DEALER_ACTIONS_TEXT.verbatimPlaceholder}
        />
      </Field>
      <Button
        variant="destructive"
        size="md"
        loading={pending}
        disabled={reason.trim().length < MIN_REASON}
        onClick={() =>
          run(
            () => suspendDealerAction(dealer.id, { reason: reason.trim() }, dealer.slug),
            DEALER_ACTIONS_TEXT.suspended,
          )
        }
      >
        {DEALER_ACTIONS_TEXT.suspend}
      </Button>
      <p className="w-full text-[12px] ink-muted">
        Suspending removes all <span className="tnum">{dealer.counts.active}</span> of this
        dealer&rsquo;s live listings from the catalogue immediately.
      </p>
    </div>
  );
}
