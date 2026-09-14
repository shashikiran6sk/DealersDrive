'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Banner } from '@/components/ui/primitives';
import type { ActionResult } from '@/types';

import { ApproveBlock } from './approve-block';
import { DEALER_ACTIONS_TEXT } from './dealer-actions.constants';
import { ReinstateBlock } from './reinstate-block';
import { RejectBlock } from './reject-block';
import { RequestChangesBlock } from './request-changes-block';
import { SuspendBlock } from './suspend-block';

/**
 * D4 — the dealer-moderation controls.
 *
 * Which controls appear is the API's answer, not this component's: `actions`
 * comes back on `AdminDealerDetail` already resolved from the dealership's
 * status, so two admins looking at one record cannot reach different conclusions
 * about what is available.
 *
 * **The approve control is rendered from the status, not from `canApprove`.**
 * `canApprove` is `PENDING_APPROVAL && allDocumentsVerified`, so an application
 * whose documents had not been reviewed showed no approve button at all — and,
 * since verifying a document was itself an API-only action, that was every
 * application. The button now always appears on a dealership waiting for a
 * decision, disabled with the unmet condition named. The permission is still the
 * API's to enforce.
 *
 * **The two refusals are separated, and separated hard.** They were one word —
 * "reject" — doing two jobs. *Request changes* hands the application back as
 * DRAFT with a note and deletes nothing. *Reject* deletes the application, and
 * the applicant starts over as a first-time signup. An unreadable GST
 * certificate calls for the first; answering it with the second costs a real
 * business everything they entered.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline renders a standalone credit grant here, gated on
 * `actions.canGrantCredits`, and an onboarding-credits field inside the approval
 * block. Both move credits, which means a `CreditTransaction` through
 * `moveCredits` (rule 4), and neither the model nor the facade exists until
 * **F050**. They return at **F054**; `canGrantCredits` is deliberately unread
 * here rather than removed.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function DealerAdminActions({ dealer }: { dealer: AdminDealerDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [approvalNote, setApprovalNote] = useState('');
  const [approvalConfirm, setApprovalConfirm] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [reinstateNote, setReinstateNote] = useState('');
  const [changesReason, setChangesReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectConfirm, setRejectConfirm] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  // Waiting for a decision. The button appears on this; whether it is *usable*
  // is `canApprove`, which additionally wants the KYC documents verified.
  const awaitingDecision = dealer.status === 'PENDING_APPROVAL';

  function run(
    work: () => Promise<ActionResult>,
    success: string,
    /**
     * Where to go afterwards, when refreshing is not an option. Rejection deletes
     * the dealership, so this page is a 404 the moment it succeeds and
     * `router.refresh()` would replace the confirmation with a not-found screen.
     */
    destination?: string,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message ?? DEALER_ACTIONS_TEXT.failed);
        return;
      }
      setNotice(success);
      if (destination) router.push(destination);
      else router.refresh();
    });
  }

  return (
    <section className="card gap-4 p-4">
      <h2 className="text-[19px]">{DEALER_ACTIONS_TEXT.heading}</h2>

      {error ? <Banner tone="err">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {awaitingDecision ? (
        <ApproveBlock
          dealer={dealer}
          pending={pending}
          run={run}
          note={approvalNote}
          onNoteChange={setApprovalNote}
          confirm={approvalConfirm}
          onConfirmChange={setApprovalConfirm}
        />
      ) : null}

      {dealer.actions.canRequestChanges ? (
        <RequestChangesBlock
          dealer={dealer}
          pending={pending}
          run={run}
          reason={changesReason}
          onReasonChange={setChangesReason}
        />
      ) : null}

      {dealer.actions.canReinstate ? (
        <ReinstateBlock
          dealer={dealer}
          pending={pending}
          run={run}
          note={reinstateNote}
          onNoteChange={setReinstateNote}
        />
      ) : null}

      {dealer.actions.canSuspend ? (
        <SuspendBlock
          dealer={dealer}
          pending={pending}
          run={run}
          reason={suspendReason}
          onReasonChange={setSuspendReason}
        />
      ) : null}

      {dealer.actions.canReject ? (
        <RejectBlock
          dealer={dealer}
          pending={pending}
          run={run}
          open={rejectOpen}
          onOpenChange={setRejectOpen}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          confirm={rejectConfirm}
          onConfirmChange={setRejectConfirm}
        />
      ) : null}

      {/*
        With grants deferred to F054, a suspended-and-reinstated dealership at
        rest has nothing to decide — and a card rendering a bare heading reads as
        a rendering bug rather than as "nothing to do here".
      */}
      {!awaitingDecision &&
      !dealer.actions.canSuspend &&
      !dealer.actions.canReinstate &&
      !dealer.actions.canReject ? (
        <p className="text-[13px] ink-muted">{DEALER_ACTIONS_TEXT.nothingAvailable}</p>
      ) : null}
    </section>
  );
}
