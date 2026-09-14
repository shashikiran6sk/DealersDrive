'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rejectDealerAction } from '@/features/admin/actions';
import { pluralLabel } from '@/lib/plural';

import { DEALER_ACTIONS_TEXT, DEALERS_LIST_PATH, MIN_REASON } from './dealer-actions.constants';
import type { ActionBlockProps } from './dealer-actions.types';

export interface RejectBlockProps extends ActionBlockProps {
  dealer: AdminDealerDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onReasonChange: (value: string) => void;
  confirm: string;
  onConfirmChange: (value: string) => void;
}

export function RejectBlock({
  dealer,
  pending,
  run,
  open,
  onOpenChange,
  reason,
  onReasonChange,
  confirm,
  onConfirmChange,
}: RejectBlockProps) {
  if (!open) {
    return (
      <div className="flex flex-col gap-2 border-t border-(--color-divider) pt-3">
        <Button variant="ghost" size="sm" className="self-start" onClick={() => onOpenChange(true)}>
          {DEALER_ACTIONS_TEXT.rejectOpen}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-(--color-divider) pt-3">
      <p className="text-[13px] font-medium text-(--color-err)">
        {DEALER_ACTIONS_TEXT.rejectWarning}
      </p>
      <p className="text-[12px] ink-muted">
        The {dealer.documents.length} KYC {pluralLabel(dealer.documents.length, 'document')} and the
        yard photo are erased from storage, and the dealership record is removed along with
        everything {dealer.contactName ?? 'the applicant'} entered. They keep their Google sign-in
        and nothing else — signing in again starts onboarding from the first step, as a new
        applicant. This cannot be undone.
      </p>
      <p className="text-[12px] ink-muted">
        {DEALER_ACTIONS_TEXT.rejectAlternative}{' '}
        <strong>{DEALER_ACTIONS_TEXT.rejectAlternativeControl}</strong>{' '}
        {DEALER_ACTIONS_TEXT.rejectAlternativeTail}
      </p>

      <Field id="rejectReason" label={DEALER_ACTIONS_TEXT.reasonLabel} className="flex-1">
        <Input
          id="rejectReason"
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder={DEALER_ACTIONS_TEXT.verbatimPlaceholder}
        />
      </Field>

      <Field
        id="rejectConfirm"
        label={DEALER_ACTIONS_TEXT.rejectConfirmLabel(dealer.brandName)}
        className="flex-1"
      >
        <Input
          id="rejectConfirm"
          value={confirm}
          onChange={(event) => onConfirmChange(event.target.value)}
          placeholder={dealer.brandName}
          autoComplete="off"
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="destructive"
          size="md"
          loading={pending}
          disabled={
            reason.trim().length < MIN_REASON ||
            confirm.trim().toLowerCase() !== dealer.brandName.toLowerCase()
          }
          onClick={() =>
            run(
              () => rejectDealerAction(dealer.id, { reason: reason.trim() }, dealer.slug),
              DEALER_ACTIONS_TEXT.rejected,
              DEALERS_LIST_PATH,
            )
          }
        >
          {DEALER_ACTIONS_TEXT.reject}
        </Button>
        <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>
          {DEALER_ACTIONS_TEXT.cancel}
        </Button>
      </div>
    </div>
  );
}
