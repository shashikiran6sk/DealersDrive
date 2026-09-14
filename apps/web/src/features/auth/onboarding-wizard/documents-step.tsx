'use client';

import type {
  CompletenessResponse,
  DealerDocumentDto,
  DealerProfile,
  YardPhotoDto,
} from '@dealers-drive/contracts';
import { useActionState } from 'react';

import { Field, invalidProps } from '@/components/forms/field';
import { Banner } from '@/components/ui/primitives';
import { saveBusinessIdsAction, type ActionState } from '@/features/auth/actions';
import { DocumentUploader } from '@/features/auth/document-uploader';
import { YardPhotoUploader } from '@/features/auth/yard-photo-uploader';

import { ONBOARDING_TEXT } from './onboarding-wizard.constants';
import { stepOutstanding } from './utils';

export interface DocumentsStepProps {
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  yardPhoto: YardPhotoDto | null;
  completeness: CompletenessResponse | null;
  onBack: () => void;
  onDone: () => void;
}

export function DocumentsStep({
  documents,
  dealer,
  yardPhoto,
  completeness,
  onBack,
  onDone,
}: DocumentsStepProps) {
  const [state, submit, pending] = useActionState<ActionState, FormData>(saveBusinessIdsAction, {});
  const values = state.values ?? {};

  const outstanding = stepOutstanding(completeness, 'documents').concat(
    stepOutstanding(completeness, 'business'),
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="font-heading text-[34px] font-semibold leading-[1.1] tracking-[-0.02em]">
          {ONBOARDING_TEXT.documentsHeading}
        </h1>
        <p className="mt-[8px] text-[15px] ink-secondary">{ONBOARDING_TEXT.documentsIntro}</p>
      </div>

      {state.message ? <Banner tone="err">{state.message}</Banner> : null}
      {state.saved ? <Banner tone="ok">{ONBOARDING_TEXT.saved}</Banner> : null}

      <form action={submit} className="flex flex-col gap-[14px]" noValidate>
        <div className="grid gap-[14px] sm:grid-cols-2">
          <Field id="gstin" label="GSTIN" error={state.errors?.gstin}>
            <input
              id="gstin"
              name="gstin"
              className="input font-mono uppercase"
              placeholder="33ABCDE1234F1Z5"
              maxLength={15}
              defaultValue={values.gstin ?? dealer?.gstin ?? ''}
              required
              aria-required="true"
              {...invalidProps('gstin', state.errors?.gstin)}
            />
          </Field>

          <Field id="pan" label="PAN" error={state.errors?.pan}>
            <input
              id="pan"
              name="pan"
              className="input font-mono uppercase"
              placeholder="ABCDE1234F"
              maxLength={10}
              defaultValue={values.pan ?? dealer?.pan ?? ''}
              required
              aria-required="true"
              {...invalidProps('pan', state.errors?.pan)}
            />
          </Field>
        </div>

        <button type="submit" className="btn btn-secondary self-start" disabled={pending}>
          {pending ? ONBOARDING_TEXT.saving : ONBOARDING_TEXT.saveRegistrations}
        </button>
      </form>

      <div className="flex flex-col gap-[10px]">
        {documents.map((document) => (
          <DocumentUploader key={document.type} document={document} />
        ))}
      </div>

      {yardPhoto ? <YardPhotoUploader photo={yardPhoto} /> : null}

      {outstanding.length > 0 ? (
        <Banner tone="warn" title={ONBOARDING_TEXT.stillNeeded}>
          <ul className="mt-[4px] list-disc pl-[18px]">
            {outstanding.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div className="flex gap-[8px]">
        <button type="button" className="btn btn-secondary h-[42px] px-[18px]" onClick={onBack}>
          {ONBOARDING_TEXT.back}
        </button>
        <button
          type="button"
          className="btn btn-primary h-[42px] flex-1"
          disabled={outstanding.length > 0}
          onClick={onDone}
        >
          {ONBOARDING_TEXT.continue}
        </button>
      </div>
    </div>
  );
}
