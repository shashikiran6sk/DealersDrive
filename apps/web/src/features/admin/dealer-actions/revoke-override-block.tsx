'use client';

import { RevokeActivationOverrideInput, type AdminDealerDetail } from '@dealers-drive/contracts';
import { useState } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { revokeActivationOverrideAction } from '@/features/admin/actions';

import {
  DEALER_ACTIONS_TEXT,
  MAX_REVOKE_REASON,
  MIN_REVOKE_REASON,
} from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface RevokeOverrideBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
}

export function RevokeOverrideBlock({ dealer, pending, run }: RevokeOverrideBlockProps) {
  const [reason, setReason] = useState('');
  const valid = RevokeActivationOverrideInput.safeParse({ reason }).success;

  return (
    <div className="flex flex-col gap-3 border-t border-(--color-divider) pt-3">
      <h3 className="text-[15px] font-medium">{DEALER_ACTIONS_TEXT.revokeHeading}</h3>
      <p className="text-[12px] ink-secondary">{DEALER_ACTIONS_TEXT.revokeIntro}</p>
      <Field
        id="revokeOverrideReason"
        label={DEALER_ACTIONS_TEXT.revokeLabel}
        hint={DEALER_ACTIONS_TEXT.revokeHint(MIN_REVOKE_REASON)}
      >
        <Textarea
          id="revokeOverrideReason"
          value={reason}
          rows={2}
          maxLength={MAX_REVOKE_REASON}
          onChange={(event) => setReason(event.target.value)}
          disabled={pending}
        />
      </Field>
      <Button
        variant="destructive"
        size="md"
        className="self-start"
        loading={pending}
        disabled={!valid || pending}
        onClick={() =>
          run(async () => {
            const result = await revokeActivationOverrideAction(
              dealer.id,
              { reason: reason.trim() },
              dealer.slug,
            );
            if (result.ok) setReason('');
            return result;
          }, DEALER_ACTIONS_TEXT.revoked)
        }
      >
        {DEALER_ACTIONS_TEXT.revoke}
      </Button>
    </div>
  );
}
