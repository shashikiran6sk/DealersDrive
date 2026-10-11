'use client';
import type {
  ProgressiveState,
  DealerProfile,
  DealerDocumentDto,
  CompletenessResponse,
} from '@dealers-drive/contracts';
import { useActionState } from 'react';
import { Field } from '@/components/forms/field';
import { Banner, Stepper } from '@/components/ui/primitives';
import { DocumentUploader } from '@/features/auth/document-uploader';
import { saveProgressiveAction, submitProgressiveAction } from './actions';

export function ProgressiveWorkspace({
  progressive,
  dealer,
  documents,
  completeness,
}: {
  progressive: ProgressiveState;
  dealer: DealerProfile;
  documents: DealerDocumentDto[];
  completeness: CompletenessResponse;
}) {
  const [state, action, pending] = useActionState(saveProgressiveAction, {});
  const [submission, submit, submitting] = useActionState(
    async () => submitProgressiveAction(),
    {},
  );
  const locked = dealer.status !== 'DRAFT';
  return (
    <div className="flex flex-col gap-5">
      <Stepper
        steps={['Register', 'Verify', 'Activate']}
        current={progressive.stage === 'ACTIVATE' ? 2 : 1}
      />
      <h1 className="text-[28px]">{dealer.brandName}</h1>
      <p className="text-[14px] ink-secondary">
        Registration saved. You can return to finish your application. Public marketplace activation
        requires approval.
      </p>
      {dealer.statusReason ? <Banner tone="warn">{dealer.statusReason}</Banner> : null}
      {!progressive.classificationReviewed ? (
        <Banner tone="warn">
          Support must review the applicable business requirements. You can save details now;
          document requirements will appear after that review.
        </Banner>
      ) : null}
      {state.message || submission.message ? (
        <Banner tone="err">{state.message ?? submission.message}</Banner>
      ) : null}
      {state.saved ? <Banner tone="ok">Details saved.</Banner> : null}
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ['addressLine', 'Business address', dealer.address.line, 200],
            ['pincode', 'PIN code', dealer.address.pincode, 6],
            ['pan', 'PAN, when applicable', dealer.pan, 10],
            ['gstin', 'GSTIN, when applicable', dealer.gstin, 15],
          ] as const
        ).map(([name, label, value, max]) => (
          <Field id={name} key={name} label={label} error={state.errors?.[name]}>
            <input
              className="input"
              id={name}
              name={name}
              maxLength={max}
              defaultValue={value ?? ''}
              disabled={locked}
            />
          </Field>
        ))}
        <p className="text-[12px] ink-secondary sm:col-span-2">
          Save any completed fields. Blank fields preserve previously saved values. A supplied GSTIN
          is not proof of active registration. Do not upload unmasked Aadhaar.
        </p>
        {!locked ? (
          <button className="btn btn-secondary min-h-11" disabled={pending}>
            {pending ? 'Saving…' : 'Save progress'}
          </button>
        ) : null}
      </form>
      <section className="flex flex-col gap-3" aria-label="Applicable evidence">
        <h2 className="text-[20px]">Applicable evidence</h2>
        {documents
          .filter((doc) => progressive.requiredDocuments.includes(doc.type))
          .map((doc) => (
            <DocumentUploader key={doc.type} document={doc} />
          ))}
        {!progressive.requiredDocuments.length ? (
          <p className="text-[13px] ink-muted">Awaiting the applicable evidence review.</p>
        ) : null}
      </section>
      {!locked ? (
        <>
          {!completeness.isComplete ? (
            <Banner tone="warn">
              <ul className="list-disc pl-4">
                {completeness.steps
                  .slice(0, 3)
                  .flatMap((step) => step.missing)
                  .map((field) => (
                    <li key={field}>
                      {field === 'applicableVerificationReview'
                        ? 'Review of the current business details'
                        : field
                            .replace(/([A-Z])/g, ' $1')
                            .replaceAll('_', ' ')
                            .toLowerCase()}
                    </li>
                  ))}
              </ul>
            </Banner>
          ) : null}
          <form action={submit}>
            <button
              className="btn btn-primary min-h-11 w-full"
              disabled={submitting || !progressive.canSubmit}
            >
              {submitting ? 'Submitting…' : 'Request activation review'}
            </button>
          </form>
        </>
      ) : (
        <Banner tone="ok">
          {dealer.status === 'ACTIVE'
            ? 'Approved for permitted marketplace activities.'
            : 'Submitted. Our team is reviewing your application; listings remain unpublished until activation.'}
        </Banner>
      )}
    </div>
  );
}
