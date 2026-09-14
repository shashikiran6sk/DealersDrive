'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { approveDealerAction } from '@/features/admin/actions';

import { DEALER_ACTIONS_TEXT } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface ApproveBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
  note: string;
  onNoteChange: (value: string) => void;
  confirm: string;
  onConfirmChange: (value: string) => void;
}

export function ApproveBlock({
  dealer,
  pending,
  run,
  note,
  onNoteChange,
  confirm,
  onConfirmChange,
}: ApproveBlockProps) {
  const approvalPhrase = DEALER_ACTIONS_TEXT.approvalPhrase(dealer.brandName);
  const canApprove = dealer.actions.canApprove && confirm.trim().toLowerCase() === approvalPhrase;

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
      <Field
        id="approvalNote"
        label={DEALER_ACTIONS_TEXT.noteLabel}
        className="min-w-[220px] flex-1"
      >
        <Input
          id="approvalNote"
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder={DEALER_ACTIONS_TEXT.approveNotePlaceholder}
        />
      </Field>
      <Field
        id="approvalConfirm"
        label={DEALER_ACTIONS_TEXT.approveConfirmLabel}
        hint={DEALER_ACTIONS_TEXT.approveConfirmHint(approvalPhrase)}
        className="min-w-[220px] flex-1"
      >
        <Input
          id="approvalConfirm"
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
          autoComplete="off"
          disabled={pending}
        />
      </Field>
      <Button
        variant="primary"
        size="md"
        loading={pending}
        disabled={!canApprove}
        onClick={() => {
          if (!canApprove || pending) return;
          run(async () => {
            const result = await approveDealerAction(
              dealer.id,
              { ...(note.trim() ? { note: note.trim() } : {}) },
              dealer.slug,
            );
            if (result.ok) onConfirmChange('');
            return result;
          }, DEALER_ACTIONS_TEXT.approved);
        }}
      >
        {DEALER_ACTIONS_TEXT.approve}
      </Button>
      <p className="w-full text-[12px] ink-muted">
        {dealer.actions.canApprove
          ? DEALER_ACTIONS_TEXT.approveReady
          : DEALER_ACTIONS_TEXT.approveBlocked}
      </p>
    </div>
  );
}
