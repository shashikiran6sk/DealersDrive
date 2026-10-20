'use client';

import {
  SELECTABLE_DOC_CATEGORIES,
  type CompletenessResponse,
  type DealerDocumentDto,
  type DealerProfile,
} from '@dealers-drive/contracts';

import { useLegalEnabled } from '@/features/legal/legal-provider';
import { Banner } from '@/components/ui/primitives';
import { DocumentUploader, documentForCategory } from '@/features/auth/document-uploader';

import { ONBOARDING_TEXT } from './onboarding-wizard.constants';
import { stepOutstanding } from './utils';

export interface DocumentsStepProps {
  documents: DealerDocumentDto[];
  dealer: DealerProfile | null;
  completeness: CompletenessResponse | null;
  onBack: () => void;
  onDone: () => void;
}

export function DocumentsStep({
  documents,
  dealer,
  completeness,
  onBack,
  onDone,
}: DocumentsStepProps) {
  const legal = useLegalEnabled();
  const outstanding = stepOutstanding(completeness, 'documents').concat(
    stepOutstanding(completeness, 'business'),
  );

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="font-heading text-[34px] font-extrabold leading-[1.1] tracking-[-0.02em]">
          {ONBOARDING_TEXT.documentsHeading}
        </h1>
        <p className="mt-[8px] text-[15px] ink-secondary">{ONBOARDING_TEXT.documentsIntro}</p>
      </div>

      {legal ? (
        <p className="text-[13px] leading-[1.7]">
          {ONBOARDING_TEXT.documentsPrivacy}{' '}
          <a
            href="/privacy#clause-5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {ONBOARDING_TEXT.privacyPolicy}
          </a>
          .
        </p>
      ) : null}
      <div className="flex flex-col gap-[6px] text-[13px] ink-muted">
        <p>{ONBOARDING_TEXT.documentsRule}</p>
        <p>{ONBOARDING_TEXT.gstResponsibility}</p>
      </div>
      <div className="flex flex-col gap-[10px]">
        {SELECTABLE_DOC_CATEGORIES.map((category) => (
          <DocumentUploader
            key={category}
            category={category}
            document={documentForCategory(documents, category)}
            gstin={dealer?.gstin ?? null}
          />
        ))}
      </div>

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

      <p className="text-[13px] ink-muted">{ONBOARDING_TEXT.draftSaved}</p>
    </div>
  );
}
