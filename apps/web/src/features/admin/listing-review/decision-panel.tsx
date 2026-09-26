import type { AdminListingDetail } from '@dealers-drive/contracts';

import { Button } from '@/components/ui/button';
import {
  approveListingAction,
  rejectListingAction,
  requestListingChangesAction,
} from '@/features/admin/listing-actions';

import { ApproveDialog } from './approve-dialog';

import { DecisionDialog } from './decision-dialog';
import { LISTING_REVIEW_TEXT } from './listing-review.constants';

export function DecisionPanel({ detail }: { detail: AdminListingDetail }) {
  const { actions, listing, blockers } = detail;
  if (!actions.canRequestChanges && !actions.canReject && !actions.canApprove) return null;

  return (
    <section aria-labelledby="decision-heading" className="card gap-[10px] bg-white p-4">
      <h2 id="decision-heading" className="text-[16px]">
        {LISTING_REVIEW_TEXT.moderation}
      </h2>
      <div className="flex flex-wrap gap-[8px]">
        {actions.canApprove ? (
          <ApproveDialog submit={approveListingAction.bind(null, listing.id)} />
        ) : (
          <Button variant="primary" size="md" disabled>
            {LISTING_REVIEW_TEXT.approve}
          </Button>
        )}
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
      {blockers.length > 0 ? (
        <div className="text-[12px]" aria-labelledby="blockers-heading">
          <p id="blockers-heading" className="font-medium text-(--color-warn)">
            {LISTING_REVIEW_TEXT.blockedTitle}
          </p>
          <ul className="list-disc pl-[18px] ink-body">
            {blockers.map((blocker) => (
              <li key={blocker.code}>{blocker.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
