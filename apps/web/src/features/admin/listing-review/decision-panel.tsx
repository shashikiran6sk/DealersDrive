import type { AdminListingDetail } from '@dealers-drive/contracts';

import { rejectListingAction, requestListingChangesAction } from '@/features/admin/listing-actions';

import { DecisionDialog } from './decision-dialog';
import { LISTING_REVIEW_TEXT } from './listing-review.constants';

export function DecisionPanel({ detail }: { detail: AdminListingDetail }) {
  const { actions, listing } = detail;
  if (!actions.canRequestChanges && !actions.canReject) return null;

  return (
    <section aria-labelledby="decision-heading" className="card gap-[10px] bg-white p-4">
      <h2 id="decision-heading" className="text-[16px]">
        {LISTING_REVIEW_TEXT.moderation}
      </h2>
      <div className="flex flex-wrap gap-[8px]">
        {actions.canRequestChanges ? (
          <DecisionDialog
            id="changes-reason"
            triggerLabel={LISTING_REVIEW_TEXT.requestChanges}
            title={LISTING_REVIEW_TEXT.requestChangesTitle}
            description={LISTING_REVIEW_TEXT.requestChangesBody}
            confirmLabel={LISTING_REVIEW_TEXT.requestChangesConfirm}
            submit={requestListingChangesAction.bind(null, listing.id)}
          />
        ) : null}
        {actions.canReject ? (
          <DecisionDialog
            id="reject-reason"
            triggerLabel={LISTING_REVIEW_TEXT.reject}
            title={LISTING_REVIEW_TEXT.rejectTitle}
            description={LISTING_REVIEW_TEXT.rejectBody}
            confirmLabel={LISTING_REVIEW_TEXT.rejectConfirm}
            destructive
            submit={rejectListingAction.bind(null, listing.id)}
          />
        ) : null}
      </div>
      <p className="text-[12px] ink-subtle">{LISTING_REVIEW_TEXT.decisionNote}</p>
    </section>
  );
}
