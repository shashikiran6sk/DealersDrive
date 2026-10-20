'use client';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { LegalCheck } from '../legal-check';
import {
  acceptAccountAction,
  acceptDealerAction,
  certifyAssistedAction,
  withdrawSharingAction,
  withdrawDealershipSharingAction,
  type LegalActionState,
} from '../legal-actions';
export function AgreementForm({
  kind,
  subjectId,
}: {
  kind: 'account' | 'dealer' | 'certification' | 'withdraw' | 'withdraw-dealership';
  subjectId?: string;
}) {
  const action =
    kind === 'account'
      ? acceptAccountAction
      : kind === 'dealer'
        ? acceptDealerAction
        : kind === 'certification'
          ? certifyAssistedAction
          : kind === 'withdraw-dealership'
            ? withdrawDealershipSharingAction
            : withdrawSharingAction;
  const [state, submit, pending] = useActionState<LegalActionState, FormData>(action, {});
  return (
    <form action={submit} className="flex flex-col gap-3">
      {kind !== 'withdraw' && kind !== 'withdraw-dealership' ? (
        <LegalCheck kind={kind} />
      ) : (
        <p className="text-[13px] leading-[1.7]">
          Withdraw permission for future Platform disclosure of your name, phone and message to this
          dealership. The dealership may already have received them.
        </p>
      )}
      {subjectId ? (
        <input
          type="hidden"
          name={
            kind === 'withdraw-dealership'
              ? 'grantId'
              : kind === 'withdraw'
                ? 'enquiryId'
                : 'vehicleId'
          }
          value={subjectId}
        />
      ) : null}
      {state.message ? (
        <p role={state.done ? 'status' : 'alert'} className="text-[14px] leading-[1.7]">
          {state.message}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="primary"
        loading={pending}
        disabled={state.done || pending}
        className="self-start"
      >
        {kind === 'withdraw' || kind === 'withdraw-dealership'
          ? 'Withdraw future sharing'
          : kind === 'certification'
            ? 'Certify this assisted draft'
            : 'Record my agreements'}
      </Button>
    </form>
  );
}
