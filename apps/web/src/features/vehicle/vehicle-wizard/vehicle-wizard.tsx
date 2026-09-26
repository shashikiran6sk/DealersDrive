'use client';

import type { DealerVehicle } from '@dealers-drive/contracts';
import { useActionState } from 'react';

import { ButtonLink } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { createVehicleAction, saveVehicleStepAction } from '@/features/vehicle/actions';

import { BasicsStep } from './basics-step';
import { DetailsStep } from './details-step';
import { PricingStep } from './pricing-step';
import { RegistrationStep } from './registration-step';
import { ReviewStep } from './review-step';
import {
  STEP_HEADINGS,
  STEP_LABELS,
  VEHICLE_WIZARD_TEXT,
  WIZARD_STEPS,
} from './vehicle-wizard.constants';
import type { WizardState, WizardStep } from './vehicle-wizard.types';
import { WizardFooter } from './wizard-footer';
import { editPath } from './utils';

const EMPTY: WizardState = {};

export interface VehicleWizardProps {
  step: WizardStep;
  vehicle: DealerVehicle | null;
  saved?: boolean;
  cancelHref?: string;
}

export function VehicleWizard({
  step,
  vehicle,
  saved = false,
  cancelHref = '/dealer',
}: VehicleWizardProps) {
  const [state, formAction] = useActionState(
    vehicle ? saveVehicleStepAction : createVehicleAction,
    EMPTY,
  );
  const errors = state.errors ?? {};
  const values = state.values ?? {};
  const current = WIZARD_STEPS.indexOf(step);

  return (
    <div className="flex flex-col gap-[18px]">
      <Stepper steps={WIZARD_STEPS.map((one) => STEP_LABELS[one])} current={current} />

      {saved ? <Banner tone="ok">{VEHICLE_WIZARD_TEXT.draftSaved}</Banner> : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}

      <section className="card gap-[16px] p-[20px]" aria-labelledby="wizard-step-heading">
        <h2 id="wizard-step-heading" className="text-[19px]">
          {STEP_HEADINGS[step]}
        </h2>

        {step === 'review' && vehicle ? (
          <>
            <ReviewStep vehicle={vehicle} />
            <div className="flex flex-wrap gap-[9px] border-t border-(--color-divider) pt-[16px]">
              <ButtonLink href={editPath(vehicle.id, 'pricing')} variant="secondary">
                {VEHICLE_WIZARD_TEXT.back}
              </ButtonLink>
              <ButtonLink href={cancelHref} variant="secondary" className="ml-auto">
                {VEHICLE_WIZARD_TEXT.done}
              </ButtonLink>
            </div>
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
