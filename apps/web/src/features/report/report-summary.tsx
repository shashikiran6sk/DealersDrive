import type { VehicleReportSummary } from '@dealers-drive/contracts';

import { StatusTag } from '@/components/ui/primitives';

/**
 * The records check, as a buyer sees it.
 *
 * ## Why this is a separate component and not a prop
 *
 * It takes `VehicleReportSummary`, which has no `challanDetails`, no challan
 * references and no registration number. `ReportPanel` takes
 * `VehicleReportDto`, which has all three. Two components over two types
 * rather than one with a `detailed` boolean, because a boolean is one careless
 * `true` away from publishing a stranger's offence history — and this file is
 * rendered on a page that is indexed by Google.
 *
 * The reasoning is ARCHITECTURE §6.1 applied consistently: the plate is hidden
 * from public responses because full registration numbers "enable
 * vehicle-history scraping", and a page rendering a complete itemised challan
 * record *is* a vehicle-history service. Aggregates and offence types carry
 * the whole trust signal a buyer needs while being worthless in bulk.
 *
 * ## No server component boundary
 *
 * Deliberately not `'use client'`. Nothing here is interactive, and a records
 * check is exactly the sort of content that should be in the HTML a crawler
 * and a slow phone receive rather than behind a hydration step.
 */
export function ReportSummary({ report }: { report: VehicleReportSummary }) {
  return (
    <section className="card gap-[14px] p-5" aria-labelledby="records-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="records-heading" className="text-[19px]">
            Government records check
          </h2>
          <p className="mt-1 text-[14px] ink-secondary">{report.headline}</p>
        </div>
        <StatusTag tone={report.verdictTone}>{report.verdictLabel}</StatusTag>
      </header>

      <dl className="flex flex-col gap-[10px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-(--color-divider) pb-[8px]">
          <dt className="text-[14px]">Blacklist &amp; theft records</dt>
          <dd>
            <StatusTag tone={report.blacklistTone}>{report.blacklistLabel}</StatusTag>
          </dd>
        </div>

        <div className="flex flex-col gap-[4px] border-b border-(--color-divider) pb-[8px]">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <dt className="text-[14px]">Traffic challans</dt>
            <dd>
              {/*
                A silent state feed renders as "unavailable", never as a clean
                record. Getting this wrong is how a buyer inherits somebody
                else's fines on the strength of a page we published.
              */}
              {!report.challans.available ? (
                <StatusTag tone="neutral">Records unavailable</StatusTag>
              ) : report.challans.unpaid > 0 ? (
                <span className="tnum text-[14px]">
                  {report.challans.unpaid} unpaid · {report.challans.outstandingLabel}
                </span>
              ) : (
                <StatusTag tone="ok">None found</StatusTag>
              )}
            </dd>
          </div>

          {report.challans.available && report.challans.summary.length > 0 ? (
            // Offence types and years. No references, no exact dates, no
            // places, and no names — those were stripped before storage.
            <dd className="text-[13px] ink-muted">{report.challans.summary.join(' · ')}</dd>
          ) : null}
        </div>

        {report.financed !== null ? (
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-(--color-divider) pb-[8px]">
            <dt className="text-[14px]">Loan on record</dt>
            <dd className="text-[14px]">{report.financed ? 'Yes — ask the dealer' : 'No'}</dd>
          </div>
        ) : null}

        {report.validity.map((row) => (
          <div
            key={row.label}
            className="flex flex-wrap items-baseline justify-between gap-2 border-b border-(--color-divider) pb-[8px] last:border-b-0"
          >
            <dt className="text-[14px]">{row.label}</dt>
            <dd className="tnum text-[14px]">
              {row.tone === 'err' ? (
                <StatusTag tone="err">Expired {row.value}</StatusTag>
              ) : (
                `Valid to ${row.value}`
              )}
            </dd>
          </div>
        ))}
      </dl>

      {report.blacklistNote ? (
        <p className="text-[13px] text-(--color-err)">{report.blacklistNote}</p>
      ) : null}
      {report.nocNote ? <p className="text-[13px] ink-secondary">{report.nocNote}</p> : null}

      {/*
        The date is not fine print. "No challans found in government records as
        of 12 Feb" and "this car has no challans" are different claims, and the
        second one is a warranty we are not offering.
      */}
      <footer className="border-t border-(--color-divider) pt-3 text-[11px] ink-faint">
        {report.source} · {report.asOfLabel}. {report.disclaimer}
      </footer>
    </section>
  );
}
