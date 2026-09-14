'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requestDealerChangesAction } from '@/features/admin/actions';

import { DEALER_ACTIONS_TEXT, MIN_REASON } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface RequestChangesBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
  reason: string;
  onReasonChange: (value: string) => void;
}

/**
 * The reversible refusal, immediately under approve — those two are the
 * decisions a moderator actually makes on this screen. Nothing is deleted: the
 * dealer gets their own form back, filled in, with this sentence at the top.
 */
export function RequestChangesBlock({
  dealer,
  pending,
  run,
  reason,
  onReasonChange,
}: RequestChangesBlockProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
      <Field id="changesReason" label={DEALER_ACTIONS_TEXT.changesLabel} className="min-w-[240px] flex-1">
        <Input
          id="changesReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={DEALER_ACTIONS_TEXT.changesPlaceholder}
        />
      </Field>
      <Button
        variant="secondary"
        size="md"
        loading={pending}
        disabled={reason.trim().length < MIN_REASON}
        onClick={() =>
          run(
            () => requestDealerChangesAction(dealer.id, { reason: reason.trim() }, dealer.slug),
            DEALER_ACTIONS_TEXT.changesSent,
          )
        }
      >
        {DEALER_ACTIONS_TEXT.requestChanges}
      </Button>
      <p className="w-full text-[12px] ink-muted">{DEALER_ACTIONS_TEXT.changesNote}</p>
    </div>
  );
}
