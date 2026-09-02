'use client';

import type { CatalogBundle, RcLookupResponse } from '@dealers-drive/contracts';
import { useState, useTransition } from 'react';

import { normalisePlate, PlateInput, validatePlate } from '@/components/forms/plate-input';
import { Button } from '@/components/ui/button';
import { Banner, Stepper } from '@/components/ui/primitives';
import { BasicsStep } from '@/features/vehicle/basics-step';
import { lookupRegistrationAction } from '@/features/vehicle/actions';
import { WIZARD_STEPS } from '@/features/vehicle/steps';

/**
 * Step 0 — the number plate.
 *
 * ## The manual path is never hidden
 *
 * Roughly one lookup in six will not produce a usable match: the RC is very
 * new, the car was transferred between states last month, or the state's
 * server is having an afternoon. Every one of those outcomes lands here with
 * "Enter the details instead" visible and one click away — not behind a retry,
 * and not phrased as a failure the dealer caused.
 *
 * That link is also present *before* anything goes wrong. A dealer who already
 * knows their import is not on VAHAN should not have to be refused first.
 *
 * ## Why this does not create a draft
 *
 * A lookup writes nothing. A dealer appraising three trade-ins types three
 * plates and may add none of them, and creating a draft per plate would fill
 * an inventory with abandoned rows the dealer then has to clean up.
 */
export function RegistrationStep({ catalog }: { catalog: CatalogBundle }) {
  const [pending, startTransition] = useTransition();
  const [plate, setPlate] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [lookup, setLookup] = useState<RcLookupResponse | null>(null);
  const [manual, setManual] = useState(false);

  function submit() {
    setMessage(null);

    // Checked here so a typo costs an inline hint rather than a round trip —
    // and, because the lookup is billed per call, so a malformed plate never
    // reaches a provider at all.
    const invalid = validatePlate(plate);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);

    startTransition(async () => {
      const result = await lookupRegistrationAction({ regNumber: normalisePlate(plate) });

      if (!result.ok || !result.data) {
        setMessage(result.message ?? 'We could not look that number up.');
        return;
      }
      setLookup(result.data);
    });
  }

  // Both onward paths are the same Basics form. There is no second, divergent
  // copy of the dependent make/model/variant logic — the only difference is
  // whether it arrives with a proposal attached.
  if (lookup) {
    return <BasicsStep catalog={catalog} lookup={lookup} />;
  }
  if (manual) {
    return <BasicsStep catalog={catalog} prefillPlate={normalisePlate(plate)} />;
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
          <h2 className="text-[21px]">Start with the number plate</h2>
          <p className="mt-1 text-[13px] ink-muted">
            We look the car up in government records and fill in what we can — make, model, year,
            fuel, owners, RTO and insurance. You confirm the rest.
          </p>
        </div>

        {message ? <Banner tone="err">{message}</Banner> : null}

        <PlateInput value={plate} onChange={setPlate} error={error} disabled={pending} autoFocus />

        <div className="flex flex-wrap items-center gap-[9px] border-t border-(--color-divider) pt-4 max-[375px]:flex-col max-[375px]:items-stretch">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setManual(true)}
            disabled={pending}
          >
            Enter the details instead
          </button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={pending}
            className="ml-auto max-[375px]:ml-0 max-[375px]:w-full"
          >
            Look up
          </Button>
        </div>
      </form>

      <p className="text-[12px] ink-faint">
        Records come from government sources via our records partner and can lag behind reality.
        Nothing is saved until you confirm the details on the next screen.
      </p>
    </div>
  );
}
