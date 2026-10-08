'use client';

import { LegalCheck } from '@/features/legal/legal-check';
import { useLegalEnabled } from '@/features/legal/legal-provider';
import type { DealerVehicle } from '@dealers-drive/contracts';

import { Button, ButtonLink } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { submitVehicleAction } from '@/features/vehicle/actions';
import { useNavigationSafeFormAction } from '@/lib/use-navigation-safe-action';

import { VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import type { WizardState } from './vehicle-wizard.types';
import { editPath } from './utils';
import { useWizardScope } from './wizard-scope';

const EMPTY: WizardState = {};

function SubmitButton({
  label,
  disabled,
  pending,
}: {
  label: string;
  disabled: boolean;
  pending: boolean;
}) {
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
  const [state, onSubmit, pending] = useNavigationSafeFormAction(submitVehicleAction, EMPTY);
  const scope = useWizardScope();
  const legal = useLegalEnabled();
  const resubmit = vehicle.listing.status === 'CHANGES_REQUESTED';

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-[12px]">
      <input type="hidden" name="vehicleId" value={vehicle.id} />
      {scope.kind === 'sales' ? (
        <input type="hidden" name="salesDealerId" value={scope.dealerId} />
      ) : null}
      {scope.kind === 'dealer' ? (
        <LegalCheck kind="certification" />
      ) : legal ? (
        <p className="text-[13px] leading-[1.7]">
          The dealership owner must accept their agreement and certify this exact draft in their own
          workspace before you submit it. Edits require another certification. Share the vehicle ID{' '}
          {vehicle.id} with the owner; they can open{' '}
          <a href={`/agreements?vehicle=${vehicle.id}`} className="underline">
            My agreements
          </a>{' '}
          after entering the correct dealership.
        </p>
      ) : null}
      {legal && scope.kind === 'dealer' ? (
        <p className="text-[12px]">
          <a href="/agreements" className="underline">
            Review your account and dealership agreements
          </a>
          . Listing review and photography do not certify vehicle condition.
        </p>
      ) : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-[16px] max-[480px]:[&>*]:w-full">
        <ButtonLink href={editPath(vehicle.id, 'pricing', '', scope)} variant="secondary">
          {VEHICLE_WIZARD_TEXT.back}
        </ButtonLink>
        <ButtonLink href={cancelHref} variant="secondary" className="ml-auto max-[480px]:ml-0">
          {VEHICLE_WIZARD_TEXT.saveAndExit}
        </ButtonLink>
        {mayPublish ? (
          <SubmitButton
            label={resubmit ? VEHICLE_WIZARD_TEXT.resubmit : VEHICLE_WIZARD_TEXT.submit}
            disabled={!vehicle.listing.canSubmit}
            pending={pending}
          />
        ) : null}
      </div>
      {!mayPublish ? (
        <p className="text-[12px] ink-subtle">
          {scope.kind === 'sales'
            ? VEHICLE_WIZARD_TEXT.submitAfterApproval
            : VEHICLE_WIZARD_TEXT.submitByManager}
        </p>
      ) : vehicle.listing.canSubmit ? null : (
        <p className="text-[12px] ink-subtle">{VEHICLE_WIZARD_TEXT.submitBlocked}</p>
      )}
    </form>
  );
}
