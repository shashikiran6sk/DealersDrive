'use client';
import type { ProgressiveState } from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { Field } from '@/components/forms/field';
import { Banner } from '@/components/ui/primitives';
import { reviewProgressiveAction } from './actions';
export function ProgressiveAdminReview({
  progressive,
  editable,
}: {
  progressive: ProgressiveState;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState(reviewProgressiveAction, {});
  return (
    <section className="card gap-4 p-4">
      <h2 className="text-[20px]">Applicable business verification</h2>
      <p className="text-[13px] ink-secondary">
        Record checks actually performed and protected case references. Review the business
        classification and applicable authorization and GST obligations. If applicability is
        uncertain, leave the application pending. Yard ownership is not a verification criterion.
      </p>
      <p className="text-[13px]">
        {progressive.classificationReviewed
          ? 'Current business details reviewed.'
          : 'Business requirements awaiting review.'}
      </p>
      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      {state.saved ? <Banner tone="ok">Review recorded.</Banner> : null}
      {editable ? (
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="dealerId" value={progressive.dealerId} />
          <input type="hidden" name="version" value={progressive.version} />
          <Field
            id="classification"
            label="Reviewed business classification"
            error={state.errors?.classification}
          >
            <select className="input" id="classification" name="classification">
              <option value="REGISTERED_VEHICLE_DEALER">
                Vehicle dealer — applicable authorization checked
              </option>
              <option value="INTERMEDIARY_REVIEWED">
                Intermediary — applicability individually reviewed
              </option>
            </select>
          </Field>
          <Field
            id="gstRequirement"
            label="GST registration requirement"
            error={state.errors?.gstRequirement}
          >
            <select className="input" id="gstRequirement" name="gstRequirement">
              <option value="REQUIRED">Required for this business</option>
              <option value="NOT_REQUIRED_REVIEWED">
                Reviewed — not required for this business
              </option>
            </select>
          </Field>
          <Field
            id="regulatoryOutcome"
            label="Applicable authorization review"
            error={state.errors?.regulatoryOutcome}
          >
            <select className="input" id="regulatoryOutcome" name="regulatoryOutcome">
              <option value="CHECKED_VALID">Applicable authorization checked</option>
              <option value="NOT_APPLICABLE_REVIEWED">
                Non-applicability reviewed and documented
              </option>
            </select>
          </Field>
          <Field
            id="requiredDocuments"
            label="Applicable private document requirements"
            error={state.errors?.requiredDocuments}
          >
            <fieldset id="requiredDocuments" className="flex flex-col gap-2">
              {(['PAN_CARD', 'ADDRESS_PROOF', 'GST_CERTIFICATE'] as const).map((type) => (
                <label key={type} className="flex items-center gap-2 text-[13px]">
                  <input
                    name="requiredDocuments"
                    type="checkbox"
                    value={type}
                    defaultChecked={progressive.requiredDocuments.includes(type)}
                  />
                  {type.replaceAll('_', ' ')}
                </label>
              ))}
            </fieldset>
          </Field>
          {(
            [
              ['classificationReference', 'Classification review reference'],
              ['representativeIdentityReference', 'Representative identity check reference'],
              ['representativeAuthorityReference', 'Representative authority check reference'],
              ['businessExistenceReference', 'Business existence check reference'],
              ['regulatoryReference', 'Authorization / applicability review reference'],
              ['gstReference', 'GST applicability review reference'],
            ] as const
          ).map(([name, label]) => (
            <Field key={name} id={name} label={label} error={state.errors?.[name]}>
              <textarea
                className="input min-h-20"
                id={name}
                name={name}
                minLength={20}
                maxLength={1000}
                required
              />
            </Field>
          ))}
          <p className="text-[12px] ink-muted sm:col-span-2">
            Use protected case references and review rationale. Keep document numbers and private
            document URLs out of comments.
          </p>
          <button className="btn btn-primary min-h-11" disabled={pending}>
            {pending ? 'Recording…' : 'Record applicable review'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
