import { LEGAL_V1_PUBLICATION, type LegalDocument as Document } from '@dealers-drive/contracts';

import { LEGAL_DOCUMENT_TEXT as TEXT } from './legal-document.constants';

export interface LegalDocumentProps {
  document: Document & { effectiveDate?: string; changeSummary?: string };
}

export function LegalDocument({ document }: LegalDocumentProps) {
  const details = LEGAL_V1_PUBLICATION;
  const effectiveDate = document.effectiveDate ?? details.effectiveDate;
  return (
    <article className="mx-auto w-full max-w-[860px] px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-10 border-b border-(--color-rule) pb-8">
        <h1 className="font-heading text-[32px] font-extrabold tracking-[-0.03em] sm:text-[44px]">
          {document.title}
        </h1>
        <p className="mt-4 text-[14px] ink-muted">
          {TEXT.effective}
          {effectiveDate ? <time dateTime={effectiveDate}>{effectiveDate}</time> : TEXT.pending}
        </p>
        <p className="mt-2 text-[13px] ink-muted">{document.version}</p>
        {document.changeSummary ? (
          <p className="mt-2 max-w-[68ch] text-[13px] ink-muted">{document.changeSummary}</p>
        ) : null}
      </header>
      <div className="space-y-9">
        {document.sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="scroll-mt-24">
            <h2
              id={section.id}
              className="font-heading text-[21px] font-bold leading-snug sm:text-[24px]"
            >
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-4 text-[16px] leading-7 ink-body [overflow-wrap:anywhere]"
              >
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <section aria-labelledby="legal-contact">
          <h2 id="legal-contact" className="font-heading text-[21px] font-bold">
            {TEXT.contact}
          </h2>
          {details.operatorName ? (
            <p className="mt-4">
              {TEXT.operator}
              {details.operatorName} ({details.operatorForm})
            </p>
          ) : null}
          {details.operatorAddress ? (
            <p className="mt-3">
              {TEXT.address}
              {details.operatorAddress}
            </p>
          ) : null}
          {details.grievanceName ? (
            <p className="mt-3">
              {TEXT.grievance}
              {details.grievanceName}, {details.grievanceDesignation}
            </p>
          ) : null}
          {details.grievanceEmail ? (
            <p className="mt-3">
              <a
                href={`mailto:${details.grievanceEmail}`}
                className="underline [overflow-wrap:anywhere]"
              >
                {details.grievanceEmail}
              </a>
            </p>
          ) : null}
          {details.grievanceAddress ? (
            <p className="mt-3">
              {TEXT.postal}
              {details.grievanceAddress}
            </p>
          ) : null}
          {details.customerCarePhone ? (
            <p className="mt-3">
              {TEXT.phone}
              <a href={`tel:${details.customerCarePhone}`} className="underline">
                {details.customerCarePhone}
              </a>
            </p>
          ) : null}
          <p className="mt-4">
            <a href="/contact" className="underline underline-offset-4">
              {TEXT.support}
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
