'use client';

import type { DealerVehicle } from '@dealers-drive/contracts';
import { useActionState } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { ListingLifecyclePanel } from '@/features/dealer/listing-lifecycle';
import { createVehicleAction, saveVehicleStepAction } from '@/features/vehicle/actions';

import { BasicsStep } from './basics-step';
import { DetailsStep } from './details-step';
import { PricingStep } from './pricing-step';
import { RegistrationStep } from './registration-step';
import { ReviewStep } from './review-step';
import { SubmitRow } from './submit-row';
import { SubmittedPanel } from './submitted-panel';
import {
  STEP_HEADINGS,
  STEP_LABELS,
  VEHICLE_WIZARD_TEXT,
  WIZARD_STEPS,
} from './vehicle-wizard.constants';
import type { WizardState, WizardStep } from './vehicle-wizard.types';
import { WizardFooter } from './wizard-footer';

const EMPTY: WizardState = {};

const INVENTORY_HREF = '/dealer/inventory';

export interface VehicleWizardProps {
  step: WizardStep;
  vehicle: DealerVehicle | null;
  saved?: boolean;
  submitted?: boolean;
  cancelHref?: string;
}

function lockedBody(status: DealerVehicle['listing']['status']): string {
  return status === 'DRAFT' || status === 'CHANGES_REQUESTED'
    ? ''
    : VEHICLE_WIZARD_TEXT.lockedBody[status];
}

export function VehicleWizard({
  step,
  vehicle,
  saved = false,
  submitted = false,
  cancelHref = '/dealer',
}: VehicleWizardProps) {
  const [state, formAction] = useActionState(
    vehicle ? saveVehicleStepAction : createVehicleAction,
    EMPTY,
  );
  const errors = state.errors ?? {};
  const values = state.values ?? {};
  const locked = vehicle !== null && !vehicle.listing.canEdit;
  const current = WIZARD_STEPS.indexOf(locked ? 'review' : step);
  const listing = vehicle?.listing;

  if (submitted && listing?.status === 'PENDING_REVIEW') {
    return <SubmittedPanel doneHref={INVENTORY_HREF} />;
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Stepper steps={WIZARD_STEPS.map((one) => STEP_LABELS[one])} current={current} />

      {listing?.status === 'CHANGES_REQUESTED' && listing.reason ? (
        <Banner tone="warn" title={VEHICLE_WIZARD_TEXT.changesRequestedTitle}>
          {listing.reason}
        </Banner>
      ) : null}
      {listing?.status === 'REJECTED' && listing.reason ? (
        <Banner tone="err" title={VEHICLE_WIZARD_TEXT.rejectedTitle}>
          {listing.reason}
        </Banner>
      ) : null}
      {locked && listing ? (
        <Banner tone="warn" title={VEHICLE_WIZARD_TEXT.lockedTitle}>
          {lockedBody(listing.status)}
        </Banner>
      ) : null}
      {saved ? <Banner tone="ok">{VEHICLE_WIZARD_TEXT.draftSaved}</Banner> : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <section className="card gap-[16px] p-[20px]" aria-labelledby="wizard-step-heading">
        <h2 id="wizard-step-heading" className="text-[19px]">
          {STEP_HEADINGS[locked ? 'review' : step]}
        </h2>

        {locked ? (
          <>
            <ReviewStep vehicle={vehicle} readOnly />
            <ListingLifecyclePanel
              vehicleId={vehicle.id}
              vehicleTitle={vehicle.title}
              listing={vehicle.listing}
            />
            <div className="flex flex-wrap gap-[9px] border-t border-(--color-divider) pt-[16px]">
              <ButtonLink href={cancelHref} variant="secondary" className="ml-auto">
                {VEHICLE_WIZARD_TEXT.done}
              </ButtonLink>
            </div>
          </>
        ) : step === 'review' && vehicle ? (
          <>
            <ReviewStep vehicle={vehicle} />
            <SubmitRow vehicle={vehicle} cancelHref={cancelHref} />
          </>
        ) : (
          <form action={formAction} className="flex flex-col gap-[16px]" noValidate>
            {vehicle ? (
              <>
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <input type="hidden" name="step" value={step} />
              </>
            ) : null}

            {step === 'registration' ? (
              <RegistrationStep vehicle={vehicle} errors={errors} values={values} />
            ) : null}
            {step === 'basics' ? (
              <BasicsStep vehicle={vehicle} errors={errors} values={values} />
            ) : null}
            {step === 'details' ? (
              <DetailsStep vehicle={vehicle} errors={errors} values={values} />
            ) : null}
            {step === 'pricing' ? (
              <PricingStep vehicle={vehicle} errors={errors} values={values} />
            ) : null}

            <WizardFooter first={vehicle === null} cancelHref={cancelHref} />
          </form>
        )}
      </section>
    </div>
  );
}
