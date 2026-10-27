'use client';

import type { AdminListingDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { updateListingVehicleAction } from '@/features/admin/listing-actions';
import { BasicsStep } from '@/features/vehicle/vehicle-wizard/basics-step';
import { DetailsStep } from '@/features/vehicle/vehicle-wizard/details-step';
import { PricingStep } from '@/features/vehicle/vehicle-wizard/pricing-step';
import { RegistrationStep } from '@/features/vehicle/vehicle-wizard/registration-step';
import { payloadFor } from '@/features/vehicle/vehicle-wizard/form-payload';
import { formField } from '@/features/vehicle/vehicle-wizard/utils';
import { STEP_FIELDS } from '@/features/vehicle/vehicle-wizard/vehicle-wizard.constants';
import { useNavigationSafeAction } from '@/lib/use-navigation-safe-action';

export function ListingVehicleEditor({ detail }: { detail: AdminListingDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useNavigationSafeAction();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const [source, setSource] = useState(detail.vehicle);
  if (!detail.actions.canEdit) return null;

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const details = payloadFor(
      Object.values(STEP_FIELDS).flat(),
      new FormData(event.currentTarget),
    );
    setErrors({});
    setMessage(undefined);
    startTransition(async () => {
      const result = await updateListingVehicleAction(detail.listing.id, {
        details,
        expectedUpdatedAt: source.updatedAt,
      });
      if (!result.ok) {
        setMessage(result.message);
        setErrors(
          Object.fromEntries(
            Object.entries(result.errors ?? {}).map(([field, error]) => [formField(field), error]),
          ),
        );
        return;
      }
      setEditing(false);
      setMessage('Vehicle details saved.');
      router.refresh();
    });
  }

  const props = { vehicle: source, errors, values: {} };
  return (
    <section className="card gap-3 bg-white p-4" aria-labelledby="vehicle-editor-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="vehicle-editor-heading" className="text-[16px]">
          Vehicle details
        </h2>
        {!editing ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSource(detail.vehicle);
              setMessage(undefined);
              setErrors({});
              setEditing(true);
            }}
          >
            Edit details
          </Button>
        ) : null}
      </div>
      {message ? <Banner tone={editing ? 'err' : 'ok'}>{message}</Banner> : null}
      {editing ? (
        <form onSubmit={save} className="flex flex-col gap-5">
          <fieldset disabled={pending} className="flex min-w-0 flex-col gap-5">
            <RegistrationStep {...props} />
            <BasicsStep {...props} />
            <DetailsStep {...props} />
            <PricingStep {...props} />
          </fieldset>
          <div className="flex gap-2">
            <Button variant="primary" type="submit" loading={pending}>
              Save details
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setMessage(undefined);
                setErrors({});
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
