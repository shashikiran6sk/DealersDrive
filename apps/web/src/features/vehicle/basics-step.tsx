'use client';

import type { CatalogBundle } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { createVehicleAction } from '@/features/vehicle/actions';
import {
  BasicsFields,
  EMPTY_BASICS,
  validateBasics,
  type BasicsValue,
} from '@/features/vehicle/basics-fields';
import { WIZARD_STEPS } from '@/features/vehicle/steps';

/**
 * DESIGN-SPEC §3.14 step 1 — Basics.
 *
 * Standing alone because C7 takes exactly these seven fields and answers with a
 * DRAFT that has an id. Everything after this point — details, photos, price —
 * is a PATCH against a real row, which is what makes "Save draft", a
 * direct-to-storage uploader, and going *back* to this step without losing
 * anything possible at all.
 *
 * All seven fields are required. The check here is for the messages; the API
 * runs the same one and is what actually enforces it, so a dealer who submits
 * this form with a crafted request gets a 400 rather than a draft with holes.
 */
export function BasicsStep({ catalog }: { catalog: CatalogBundle }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [basics, setBasics] = useState<BasicsValue>(EMPTY_BASICS);

  function submit() {
    setMessage(null);

    const invalid = validateBasics(basics);
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      setMessage('Every field on this page is required. Check the highlighted ones.');
      return;
    }

    startTransition(async () => {
      const result = await createVehicleAction({
        makeId: basics.makeId,
        modelId: basics.modelId,
        variantId: basics.variantId,
        year: Number(basics.year),
        fuel: basics.fuel,
        transmission: basics.transmission,
        bodyType: basics.bodyType,
      });

      if (!result.ok || !result.data) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? 'We could not create that vehicle.');
        return;
      }
      router.push(`/dealer/vehicles/${result.data.id}/edit?step=1`);
    });
  }

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-[18px] p-[22px]">
      <h1 className="text-[26px]">Add a vehicle</h1>
      <Stepper steps={WIZARD_STEPS} current={0} />

      <form
        className="card gap-[16px] p-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div>
          <h2 className="text-[21px]">Vehicle basics</h2>
          <p className="mt-1 text-[13px] ink-muted">
            These seven fields identify the car, and all seven are required. You can change them
            later — including after you have filled in the details.
          </p>
        </div>

        {message ? <Banner tone="err">{message}</Banner> : null}

        <BasicsFields
          catalog={catalog}
          value={basics}
          onChange={(next) => {
            setBasics(next);
            setErrors({});
          }}
          errors={errors}
        />

        <div className="flex flex-wrap gap-[9px] border-t border-(--color-divider) pt-4 max-[375px]:flex-col">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={pending}
            className="ml-auto max-[375px]:ml-0 max-[375px]:w-full"
          >
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
