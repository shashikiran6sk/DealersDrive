'use client';

import type { DealerVehicle } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Button, ButtonLink } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { submitVehicleAction } from '@/features/vehicle/actions';

import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import type { WizardState } from './vehicle-wizard.types';
import { editPath } from './utils';

const EMPTY: WizardState = {};

function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" loading={pending} disabled={disabled || pending}>
      {label}
    </Button>
  );
}

export function SubmitRow({
  vehicle,
  cancelHref,
  mayPublish = true,
}: {
  vehicle: DealerVehicle;
  cancelHref: string;
  mayPublish?: boolean;
}) {
  const [state, formAction] = useActionState(submitVehicleAction, EMPTY);
  const resubmit = vehicle.listing.status === 'CHANGES_REQUESTED';

  return (
    <form action={formAction} className="flex flex-col gap-[12px]">
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-[16px] max-[480px]:[&>*]:w-full">
        <ButtonLink href={editPath(vehicle.id, 'pricing')} variant="secondary">
          {VEHICLE_WIZARD_TEXT.back}
        </ButtonLink>
        <ButtonLink href={cancelHref} variant="secondary" className="ml-auto max-[480px]:ml-0">
          {VEHICLE_WIZARD_TEXT.saveAndExit}
        </ButtonLink>
        {mayPublish ? (
          <SubmitButton
            label={resubmit ? VEHICLE_WIZARD_TEXT.resubmit : VEHICLE_WIZARD_TEXT.submit}
            disabled={!vehicle.listing.canSubmit}
          />
        ) : null}
      </div>
      {!mayPublish ? (
        <p className="text-[12px] ink-subtle">{VEHICLE_WIZARD_TEXT.submitByManager}</p>
      ) : vehicle.listing.canSubmit ? null : (
        <p className="text-[12px] ink-subtle">{VEHICLE_WIZARD_TEXT.submitBlocked}</p>
      )}
    </form>
  );
}
