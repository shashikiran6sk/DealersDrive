'use client';

import type { CatalogBundle, RcLookupResponse } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { ReportPanel } from '@/features/report/report-panel';
import { createVehicleAction } from '@/features/vehicle/actions';
import {
  BasicsFields,
  EMPTY_BASICS,
  validateBasics,
  type BasicsValue,
} from '@/features/vehicle/basics-fields';
import { RcSummary } from '@/features/vehicle/rc-summary';
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
export function BasicsStep({
  catalog,
  lookup,
  prefillPlate,
}: {
  catalog: CatalogBundle;
  /** Present when the dealer arrived via a number-plate lookup. */
  lookup?: RcLookupResponse;
  /** The plate they typed, when the lookup failed and they chose manual entry. */
  prefillPlate?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  /**
   * Seeded from the lookup where it resolved something.
   *
   * `?? ''` throughout, so an unresolved field is an empty dropdown the dealer
   * fills rather than a plausible guess they might not check. The variant and
   * the transmission are *always* empty — see `RcSummary` for why.
   */
  const [basics, setBasics] = useState<BasicsValue>(() =>
    lookup
      ? {
          makeId: lookup.basics.makeId.value ?? '',
          modelId: lookup.basics.modelId.value ?? '',
          variantId: '',
          year: lookup.basics.year.value === null ? '' : String(lookup.basics.year.value),
          fuel: lookup.basics.fuel.value ?? '',
          transmission: '',
          bodyType: lookup.basics.bodyType.value ?? '',
        }
      : EMPTY_BASICS,
  );

  function submit() {
    setMessage(null);

    const invalid = validateBasics(basics);
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid);
      setMessage('Every field on this page is required. Check the highlighted ones.');
      return;
    }

    startTransition(async () => {
      const plate = lookup?.regNumber ?? prefillPlate;

      const result = await createVehicleAction({
        makeId: basics.makeId,
        modelId: basics.modelId,
        variantId: basics.variantId,
        year: Number(basics.year),
        fuel: basics.fuel,
        transmission: basics.transmission,
        bodyType: basics.bodyType,
        ...(plate ? { regNumberMasked: plate } : {}),
        /**
         * One id, not the resolved fields.
         *
         * The server re-reads what the provider actually said under this id
         * and applies the RC-derived details itself, so a crafted request
         * cannot claim an RC reported one owner and full insurance.
         */
        ...(lookup ? { rcLookupId: lookup.lookupId } : {}),
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
          <h2 className="text-[21px]">{lookup ? 'Confirm the car' : 'Vehicle basics'}</h2>
          <p className="mt-1 text-[13px] ink-muted">
            {lookup
              ? 'We filled in what the registration records told us. Check it, pick the variant and the gearbox, and correct anything that is wrong.'
              : 'These seven fields identify the car, and all seven are required. You can change them later — including after you have filled in the details.'}
          </p>
        </div>

        {message ? <Banner tone="err">{message}</Banner> : null}

        {lookup ? <RcSummary lookup={lookup} /> : null}

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

      {/*
        Shown while the dealer is still deciding whether to add the car, which
        is exactly when unpaid challans and a blacklist flag are most useful.
        No refresh button: nothing is saved yet, so there is nothing to refresh
        against — re-running the lookup is what the back button is for.
      */}
      {lookup?.report ? <ReportPanel report={lookup.report} /> : null}
    </div>
  );
}
