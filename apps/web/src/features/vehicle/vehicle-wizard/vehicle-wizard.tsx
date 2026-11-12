'use client';

import type {
  BillingSummary,
  CreditPacksResponse,
  DealerVehicle,
  DealerVehiclePhotos,
} from '@dealers-drive/contracts';

import { ButtonLink } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { ListingLifecyclePanel } from '@/features/dealer/listing-lifecycle';
import { createVehicleAction, saveVehicleStepAction } from '@/features/vehicle/actions';
import { PhotoStep } from '@/features/vehicle/photo-step';
import { useNavigationSafeFormAction } from '@/lib/use-navigation-safe-action';

import { BasicsStep } from './basics-step';
import { DetailsStep } from './details-step';
import { PricingStep } from './pricing-step';
import { RegistrationStep } from './registration-step';
import { ReviewStep } from './review-step';
import { SubmitRow } from './submit-row';
import { SubmissionChecklist } from './submission-checklist';
import { submissionBlocker, submissionNeeds } from './submission';
import { SubmittedPanel } from './submitted-panel';
import { STEP_HEADINGS, STEP_LABELS, VEHICLE_WIZARD_TEXT } from './vehicle-wizard.constants';
import { editPath, stepBefore, stepsFor } from './utils';
import type { WizardScope, WizardState, WizardStep } from './vehicle-wizard.types';
import { DEALER_SCOPE, WizardScopeContext } from './wizard-scope';
import { WizardFooter } from './wizard-footer';

const EMPTY: WizardState = {};

const INVENTORY_HREF = '/dealer/inventory';

export interface VehicleWizardProps {
  step: WizardStep;
  vehicle: DealerVehicle | null;
  saved?: boolean;
  submitted?: boolean;
  cancelHref?: string;
  mayPublish?: boolean;
  salesDealerId?: string;
  photos?: DealerVehiclePhotos | null;
  billing?: BillingSummary | null;
  packs?: CreditPacksResponse | null;
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
  mayPublish = true,
  salesDealerId,
  photos = null,
  billing = null,
  packs = null,
}: VehicleWizardProps) {
  const scope: WizardScope = salesDealerId
    ? { kind: 'sales', dealerId: salesDealerId }
    : DEALER_SCOPE;
  return (
    <WizardScopeContext.Provider value={scope}>
      <WizardBody
        step={step}
        vehicle={vehicle}
        saved={saved}
        submitted={submitted}
        cancelHref={cancelHref}
        mayPublish={mayPublish}
        scope={scope}
        photos={scope.kind === 'dealer' ? photos : null}
        billing={scope.kind === 'dealer' ? billing : null}
        packs={scope.kind === 'dealer' ? packs : null}
      />
    </WizardScopeContext.Provider>
  );
}

function WizardBody({
  step,
  vehicle,
  saved,
  submitted,
  cancelHref,
  mayPublish,
  scope,
  photos,
  billing,
  packs,
}: Required<Omit<VehicleWizardProps, 'salesDealerId'>> & { scope: WizardScope }) {
  const [state, onSubmit, pending] = useNavigationSafeFormAction(
    vehicle ? saveVehicleStepAction : createVehicleAction,
    EMPTY,
  );
  const errors = state.errors ?? {};
  const values = state.values ?? {};
  const locked = vehicle !== null && !vehicle.listing.canEdit;
  const photoStep = photos?.enabled === true;
  const steps = stepsFor(photoStep);
  const shown: WizardStep = locked || (step === 'photos' && !photoStep) ? 'review' : step;
  const current = steps.indexOf(shown);
  const listing = vehicle?.listing;
  const needs = vehicle ? submissionNeeds(vehicle, photos, billing) : null;

  if (submitted && listing?.status === 'PENDING_REVIEW') {
    return (
      <SubmittedPanel
        doneHref={scope.kind === 'sales' ? cancelHref : INVENTORY_HREF}
        doneLabel={
          scope.kind === 'sales'
            ? VEHICLE_WIZARD_TEXT.viewDealership
            : VEHICLE_WIZARD_TEXT.viewInventory
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <Stepper steps={steps.map((one) => STEP_LABELS[one])} current={current} />

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
          {STEP_HEADINGS[shown]}
        </h2>

        {locked ? (
          <>
            <ReviewStep vehicle={vehicle} readOnly />
            {scope.kind === 'dealer' ? (
              <ListingLifecyclePanel
                vehicleId={vehicle.id}
                vehicleTitle={vehicle.title}
                listing={vehicle.listing}
              />
            ) : null}
            <div className="flex flex-wrap gap-[9px] border-t border-(--color-divider) pt-[16px]">
              <ButtonLink href={cancelHref} variant="secondary" className="ml-auto">
                {VEHICLE_WIZARD_TEXT.done}
              </ButtonLink>
            </div>
          </>
        ) : shown === 'photos' && vehicle && photos ? (
          <PhotoStep
            vehicleId={vehicle.id}
            photos={photos}
            billing={billing}
            backHref={editPath(vehicle.id, 'pricing', '', scope)}
            nextHref={editPath(vehicle.id, 'review', '', scope)}
          />
        ) : shown === 'review' && vehicle ? (
          <>
            <ReviewStep vehicle={vehicle} photoPlanStep={photoStep} />
            {needs ? (
              <SubmissionChecklist
                needs={needs}
                photos={photos}
                billing={billing}
                packs={packs}
                photosHref={editPath(vehicle.id, 'photos', '', scope)}
              />
            ) : null}
            <SubmitRow
              vehicle={vehicle}
              cancelHref={cancelHref}
              mayPublish={mayPublish}
              backStep={stepBefore('review', photoStep)}
              blocked={needs ? submissionBlocker(needs) : null}
            />
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-[16px]" noValidate>
            {vehicle ? (
              <>
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <input type="hidden" name="step" value={step} />
              </>
            ) : null}
            {scope.kind === 'sales' ? (
              <input type="hidden" name="salesDealerId" value={scope.dealerId} />
            ) : null}
            {photoStep ? <input type="hidden" name="photosStep" value="1" /> : null}

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

            <WizardFooter first={vehicle === null} cancelHref={cancelHref} pending={pending} />
          </form>
        )}
      </section>
    </div>
  );
}
