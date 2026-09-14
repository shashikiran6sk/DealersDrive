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

  const awaitingDecision = dealer.status === 'PENDING_APPROVAL';

  function run(work: () => Promise<ActionResult>, success: string, destination?: string) {
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

      {!awaitingDecision &&
      !dealer.actions.canSuspend &&
      !dealer.actions.canReinstate &&
      !dealer.actions.canReject ? (
        <p className="text-[13px] ink-muted">{DEALER_ACTIONS_TEXT.nothingAvailable}</p>
      ) : null}
    </section>
  );
}
