import type { AdminListingDetail } from '@dealers-drive/contracts';
import Link from 'next/link';

import { LinkPendingLabel } from '@/components/ui/link-pending';
import { Banner, StatusTag } from '@/components/ui/primitives';

import { CheckRow } from './check-row';
import { DecisionPanel } from './decision-panel';
import { PhotographyPanel } from './photography-panel';
import { LISTING_REVIEW_TEXT } from './listing-review.constants';
import { ReviewSection } from './review-section';

export function ListingReview({ detail }: { detail: AdminListingDetail }) {
  const { listing, dealer } = detail;
  const checkedCount = detail.checks.filter((check) => check.checked).length;

  return (
    <div className="mx-auto flex max-w-[1000px] flex-col gap-5 p-5">
      <Link href="/admin/listings" className="relative btn btn-ghost self-start">
        <LinkPendingLabel>{LISTING_REVIEW_TEXT.back}</LinkPendingLabel>
      </Link>

      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] leading-[1.15]">{listing.title}</h1>
          <p className="mt-1 text-[14px] ink-muted tnum">
            <span className="font-mono">{listing.registrationDisplay}</span>
            {listing.priceLabel ? ` · ${listing.priceLabel}` : ''}
            {listing.location ? ` · ${listing.location}` : ''}
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {listing.submissionCount > 1 ? (
            <StatusTag tone="neutral">
              {LISTING_REVIEW_TEXT.resubmitted(listing.submissionCount)}
            </StatusTag>
          ) : null}
          <StatusTag tone={listing.statusTone}>{listing.statusLabel}</StatusTag>
        </div>
      </header>

      {listing.waitingLabel ? (
        <p className="text-[12px] text-(--color-warn) tnum">
          {LISTING_REVIEW_TEXT.waiting(listing.waitingLabel)}
        </p>
      ) : null}

      {detail.issues.length > 0 ? (
        <Banner tone="warn" title={LISTING_REVIEW_TEXT.incompleteTitle}>
          <ul>
            {detail.issues.map((issue) => (
              <li key={issue.field}>{issue.message}</li>
            ))}
          </ul>
        </Banner>
      ) : null}

      <div className="grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(290px,1fr))] max-md:[grid-template-columns:repeat(auto-fit,minmax(min(290px,100%),1fr))]">
        <div className="flex min-w-0 flex-col gap-5">
          <section aria-labelledby="dealer-heading" className="card gap-[8px] bg-white p-4">
            <h2 id="dealer-heading" className="text-[16px]">
              {LISTING_REVIEW_TEXT.dealer}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-semibold">{dealer.name}</span>
              <StatusTag tone={dealer.statusTone}>{dealer.statusLabel}</StatusTag>
            </div>
            <p className="text-[13px] ink-muted">
              {dealer.location ?? '—'}
              {dealer.phoneDisplay ? (
                <span className="font-mono"> · {dealer.phoneDisplay}</span>
              ) : null}
            </p>
            {detail.assisted.createdBy ? (
              <p className="text-[13px] ink-body">
                {LISTING_REVIEW_TEXT.preparedBy(
                  detail.assisted.createdBy.name ?? detail.assisted.createdBy.email,
                )}
              </p>
            ) : null}
            {detail.assisted.submittedBy ? (
              <p className="text-[13px] ink-body">
                {LISTING_REVIEW_TEXT.submittedBy(
                  detail.assisted.submittedBy.name ?? detail.assisted.submittedBy.email,
                )}
              </p>
            ) : null}
            {detail.assisted.reviewerIsAssistant ? (
              <Banner tone="warn">{LISTING_REVIEW_TEXT.reviewerIsAssistant}</Banner>
            ) : null}
            <Link
              href={`/admin/dealers/${dealer.id}`}
              className="relative btn btn-ghost self-start text-[12px]"
            >
              <LinkPendingLabel>{LISTING_REVIEW_TEXT.openDealer}</LinkPendingLabel>
            </Link>
          </section>

          {detail.sections.map((section) => (
            <ReviewSection key={section.key} section={section} />
          ))}

          <section aria-labelledby="description-heading" className="card gap-[8px] bg-white p-4">
            <h2 id="description-heading" className="text-[16px]">
              {LISTING_REVIEW_TEXT.description}
            </h2>
            <p className="max-w-[66ch] whitespace-pre-line text-[14px] ink-body">
              {detail.description ?? LISTING_REVIEW_TEXT.noDescription}
            </p>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <DecisionPanel detail={detail} />

          <PhotographyPanel detail={detail} />

          <section aria-labelledby="checklist-heading" className="card gap-[4px] bg-white p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="checklist-heading" className="text-[16px]">
                {LISTING_REVIEW_TEXT.checklist}
              </h2>
              <span className="text-[12px] ink-subtle tnum">
                {checkedCount}/{detail.checks.length}
              </span>
            </div>
            <p className="text-[12px] ink-subtle">{LISTING_REVIEW_TEXT.checklistHint}</p>
            <ul>
              {detail.checks.map((check) => (
                <CheckRow
                  key={check.key}
                  listingId={listing.id}
                  check={check}
                  editable={detail.actions.canVerify}
                />
              ))}
            </ul>
          </section>

          <section aria-labelledby="history-heading" className="card gap-[8px] bg-white p-4">
            <h2 id="history-heading" className="text-[16px]">
              {LISTING_REVIEW_TEXT.history}
            </h2>
            {detail.history.length === 0 ? (
              <p className="text-[13px] ink-muted">{LISTING_REVIEW_TEXT.noHistory}</p>
            ) : (
              <ol className="flex flex-col gap-[8px]">
                {detail.history.map((entry) => (
                  <li key={`${entry.action}-${entry.at}`} className="text-[13px]">
                    <div>
                      <span className="font-medium">{entry.label}</span>
                      <span className="ink-subtle"> · {entry.actor} · </span>
                      <span className="ink-subtle tnum">{entry.atLabel}</span>
                    </div>
                    {entry.reason ? (
                      <div className="ink-body">
                        {LISTING_REVIEW_TEXT.reason} {entry.reason}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
