'use client';
import type { SalesDealerDetail } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { Field } from '@/components/forms/field';
import { Banner, Stepper } from '@/components/ui/primitives';
import { saveProgressiveAssistedAction } from './actions';
export function AssistedProgress({ dealer }: { dealer: SalesDealerDetail }) {
  const [state, action, pending] = useActionState(
    saveProgressiveAssistedAction.bind(null, dealer.id),
    {},
  );
  return (
    <div className="flex flex-col gap-4">
      <Stepper
        steps={['Register', 'Verify', 'Activate']}
        current={dealer.status === 'DRAFT' ? 1 : 2}
      />
      <p className="text-[13px] ink-secondary">
        Registration saved. Complete the evidence applicable to this business and coordinate email
        verification. Only an independent authorized reviewer can activate the dealership.
      </p>
      {!dealer.progressive?.classificationReviewed ? (
        <Banner tone="warn">
          Applicable business requirements are awaiting review. Save available information now.
        </Banner>
      ) : null}
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      {state.saved ? <Banner tone="ok">Progress saved.</Banner> : null}
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['addressLine', 'Business address', dealer.address.line, 200],
            ['pincode', 'PIN code', dealer.address.pincode, 6],
            ['pan', 'PAN, when applicable', dealer.pan, 10],
            ['gstin', 'GSTIN, when applicable', dealer.gstin, 15],
          ] as const
        ).map(([name, label, value, max]) => (
          <Field key={name} id={name} label={label} error={state.errors?.[name]}>
            <input
              className="input"
              id={name}
              name={name}
              defaultValue={value ?? ''}
              maxLength={max}
              disabled={!dealer.canEdit}
            />
          </Field>
        ))}
        <p className="text-[12px] ink-muted sm:col-span-2">
          Save completed fields. Blank fields preserve previous values. Do not upload unmasked
          Aadhaar.
        </p>
        {dealer.canEdit ? (
          <button className="btn btn-secondary min-h-11" disabled={pending}>
            {pending ? 'Saving…' : 'Save progress'}
          </button>
        ) : null}
      </form>
    </div>
  );
}
