'use client';

import type { VehicleReportDto } from '@dealers-drive/contracts';

import { Banner, StatusTag } from '@/components/ui/primitives';

/**
 * The records check, as the dealer and the moderator see it.
 *
 * Itemised on purpose: a dealer has to *clear* the challans before selling,
 * and a list they cannot see is a list they cannot settle. A moderator gets
 * the same view because they are the last human between a flagged vehicle and
 * the public marketplace.
 *
 * The public component is `report-summary.tsx`, and it is a different file
 * taking a different type rather than this one with a `detailed` prop. That is
 * deliberate — a boolean prop is one careless `true` away from publishing a
 * stranger's offence history, whereas `VehicleReportSummary` has no field to
 * put it in.
 */
export function ReportPanel({
  report,
  onRefresh,
  refreshing = false,
  refreshError,
}: {
  report: VehicleReportDto;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshError?: string | null;
}) {
  return (
    <section className="card gap-[14px] p-5" aria-labelledby="report-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="report-heading" className="text-[19px]">
            Government records
          </h2>
          <p className="mt-1 text-[13px] ink-muted">
            {report.headline} · {report.asOfLabel}
          </p>
        </div>
        <StatusTag tone={report.verdictTone}>{report.verdictLabel}</StatusTag>
      </header>

      {/*
        A stale report is not wrong, it is old — and the difference matters
        enough to say out loud rather than silently serve a month-old claim.
      */}
      {report.stale && onRefresh ? (
        <Banner tone="warn">
          These records were last read {report.asOfLabel.replace('as of ', 'on ')}. They are
          refreshed automatically when you submit the listing.
        </Banner>
      ) : null}

      {refreshError ? <Banner tone="err">{refreshError}</Banner> : null}

      <dl className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <Row label="Blacklist" value={report.blacklistLabel} tone={report.blacklistTone} />
        {report.nocIssuedTo ? <Row label="NOC issued to" value={report.nocIssuedTo} /> : null}
        {report.rcStatus ? <Row label="RC status" value={report.rcStatus} /> : null}
        {report.financed !== null ? (
          <Row label="Loan on record" value={report.financed ? 'Yes' : 'No'} />
        ) : null}
      </dl>

      {report.blacklistReasons.length > 0 ? (
        <Banner tone="err">
          <strong>Why this vehicle is flagged</strong>
          <ul className="mt-1 list-disc pl-4">
            {report.blacklistReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div>
        <h3 className="text-[15px]">Traffic challans</h3>

        {/*
          The distinction the whole report rests on. A silent state feed must
          never render as a clean record — a dealer who reads "none" here and
          repeats it to a buyer has made a promise on our behalf.
        */}
        {!report.challans.available ? (
          <Banner tone="warn" className="mt-2">
            Challan records were not available for this vehicle&apos;s state. This is not the same
            as having none — check the government portal before telling a buyer it is clear.
          </Banner>
        ) : report.challanDetails.length === 0 ? (
          <p className="mt-2 text-[13px] ink-muted">No challans found in government records.</p>
        ) : (
          <>
            <p className="mt-1 text-[13px] ink-muted">
              {report.challans.unpaid} unpaid of {report.challans.total} ·{' '}
              <strong className="tnum">{report.challans.outstandingLabel}</strong> outstanding
            </p>
            <ul className="mt-2 flex flex-col gap-[6px]">
              {report.challanDetails.map((challan) => (
                <li
                  key={challan.challanRef + challan.offenceDate}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-(--color-divider) pb-[6px] text-[13px] last:border-b-0"
                >
                  <span>
                    {challan.offence}
                    {challan.court ? (
                      <span className="ml-2 text-[11px] text-(--color-err)">referred to court</span>
                    ) : null}
                    <span className="ml-2 ink-faint">
                      {challan.offenceDate
                        ? new Date(challan.offenceDate).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : 'date not recorded'}
                      {' · '}#{challan.challanRef}
                    </span>
                  </span>
                  <span className="tnum">
                    {challan.amountLabel}
                    <StatusTag
                      tone={challan.status === 'UNPAID' ? 'err' : 'neutral'}
                      className="ml-2"
                    >
                      {challan.statusLabel}
                    </StatusTag>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {report.insuranceUpto || report.pucUpto || report.fitnessUpto || report.taxUpto ? (
        <dl className="grid gap-[10px] [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <Validity label="Insurance" iso={report.insuranceUpto} />
          <Validity label="Pollution certificate" iso={report.pucUpto} />
          <Validity label="Fitness" iso={report.fitnessUpto} />
          <Validity label="Road tax" iso={report.taxUpto} />
        </dl>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-(--color-divider) pt-3">
        {/*
          Provenance travels with the claim. A records check rendered without
          its source and date is a warranty, not a report.
        */}
        <p className="text-[11px] ink-faint">
          {report.source}. {report.disclaimer}
        </p>
        {onRefresh ? (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Checking…' : 'Check again'}
          </button>
        ) : null}
      </footer>
    </section>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'err' | 'neutral' | 'accent';
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] ink-faint">{label}</dt>
      <dd className="mt-[2px] text-[14px]">
        {tone ? <StatusTag tone={tone}>{value}</StatusTag> : value}
      </dd>
    </div>
  );
}

function Validity({ label, iso }: { label: string; iso: string | null }) {
  if (!iso) return null;
  const date = new Date(iso);
  // An expiry in the past is a cost the buyer inherits on day one, so it reads
  // as an error rather than as a neutral date.
  const expired = date.getTime() < Date.now();

  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.06em] ink-faint">{label}</dt>
      <dd className={`mt-[2px] text-[14px] tnum ${expired ? 'text-(--color-err)' : ''}`}>
        {date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
        {expired ? ' · expired' : ''}
      </dd>
    </div>
  );
}
