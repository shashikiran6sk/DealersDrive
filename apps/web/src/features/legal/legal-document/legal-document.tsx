import {
  LEGAL_DOCUMENTS,
  LEGAL_VERSION,
  legalDocumentSnapshot,
  type LegalDocumentId,
} from '@dealers-drive/contracts';
import Link from 'next/link';
function effectiveDateLabel(date: string | null): string {
  return date ? `Effective ${date}` : 'No effective date assigned';
}
export function LegalDocument({
  documentId,
  archived = false,
  version = LEGAL_VERSION,
  controls,
}: {
  documentId: LegalDocumentId;
  archived?: boolean;
  version?: string;
  controls?: React.ReactNode;
}) {
  const document = legalDocumentSnapshot(documentId, version);
  if (!document) throw new Error('The requested document snapshot is unavailable.');
  return (
    <article className="mx-auto max-w-[1120px] px-4 pt-8 pb-16 sm:px-6">
      <div className="mb-6 text-[12px] ink-subtle">
        <Link href="/" className="underline">
          Home
        </Link>
        <span aria-hidden="true"> / </span>Legal documents
      </div>
      <header className="mb-8 max-w-[76ch]">
        <h1 className="font-heading text-[30px] font-extrabold leading-[1.2] sm:text-[38px]">
          {document.title}
        </h1>
        <p className="mt-3 text-[13px] ink-secondary">
          Version {document.version} · {effectiveDateLabel(document.effectiveDate)}
        </p>
        {archived ? (
          <p className="mt-3 text-[14px]">
            Archived snapshot.{' '}
            <Link href={document.route} className="underline">
              Read the current version
            </Link>
            .
          </p>
        ) : null}
        {!document.reviewed ? (
          <p
            role="note"
            className="mt-4 border-l-4 border-(--color-warn) bg-(--color-warn-bg) p-4 text-[14px] leading-[1.7]"
          >
            Draft for review. This document is not effective or approved for publication. Business
            identity, full address and grievance contacts must be completed and Indian legal counsel
            must approve the release.
          </p>
        ) : null}
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-[230px_1fr] lg:gap-12">
        <nav
          aria-label="On this page"
          className="border-y border-(--color-divider) py-4 lg:sticky lg:top-6"
        >
          <h2 className="mb-3 text-[14px] font-semibold">On this page</h2>
          <ol className="list-none space-y-3 text-[13px] leading-[1.6]">
            {document.sections.map((section, index) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="ink-secondary hover:underline">
                  {index + 1}. {section.heading}
                </a>
              </li>
            ))}
          </ol>
          <div className="mt-5 border-t border-(--color-divider) pt-4">
            <Link
              href={`/legal/${documentId}/${document.version}`}
              className="text-[12px] underline"
            >
              Permanent version link
            </Link>
          </div>
        </nav>
        <div className="min-w-0 max-w-[76ch]">
          {document.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="mb-8 scroll-mt-8">
              <h2 className="mb-3 text-[19px] font-bold leading-[1.4]">
                {index + 1}. {section.heading}
              </h2>
              {section.paragraphs.map((paragraph, paragraphIndex) => (
                <p
                  key={paragraphIndex}
                  className="mb-4 text-[15px] leading-[1.85] [overflow-wrap:anywhere]"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
          {controls}
        </div>
      </div>
      <nav
        aria-label="Related legal documents"
        className="mt-8 flex flex-wrap gap-x-5 gap-y-3 border-t border-(--color-divider) pt-6 text-[13px]"
      >
        {Object.values(LEGAL_DOCUMENTS).map((related) => (
          <Link key={related.id} href={related.route} className="underline">
            {related.title}
          </Link>
        ))}
      </nav>
    </article>
  );
}
