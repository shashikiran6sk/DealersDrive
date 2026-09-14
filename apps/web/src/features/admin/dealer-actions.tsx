'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import {
  approveDealerAction,
  reinstateDealerAction,
  rejectDealerAction,
  requestDealerChangesAction,
  suspendDealerAction,
} from '@/features/admin/actions';

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
  const approvalPhrase = `approve ${dealer.brandName.trim().toLowerCase()}`;
  const canApprove =
    dealer.actions.canApprove && approvalConfirm.trim().toLowerCase() === approvalPhrase;

  function run(
    work: () => Promise<{ ok: boolean; message?: string }>,
    success: string,
    destination?: string,
  ) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message ?? 'That action did not go through.');
        return;
      }
      setNotice(success);
      if (destination) router.push(destination);
      else router.refresh();
    });
  }

  return (
    <section className="card gap-4 p-4">
      <h2 className="text-[19px]">Actions</h2>

      {error ? <Banner tone="err">{error}</Banner> : null}
      {notice ? <Banner tone="ok">{notice}</Banner> : null}

      {awaitingDecision ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
          <Field id="approvalNote" label="Note" className="min-w-[220px] flex-1">
            <Input
              id="approvalNote"
              value={approvalNote}
              onChange={(event) => setApprovalNote(event.target.value)}
              placeholder="Internal — not shown to the dealer"
            />
          </Field>
          <Field
            id="approvalConfirm"
            label="Confirm approval"
            hint={`type “${approvalPhrase}”`}
            className="min-w-[220px] flex-1"
          >
            <Input
              id="approvalConfirm"
              value={approvalConfirm}
              onChange={(event) => setApprovalConfirm(event.target.value)}
              autoComplete="off"
              disabled={pending}
            />
          </Field>
          <Button
            variant="primary"
            size="md"
            loading={pending}
            disabled={!canApprove}
            onClick={() => {
              if (!canApprove || pending) return;
              run(async () => {
                const result = await approveDealerAction(
                  dealer.id,
                  { ...(approvalNote.trim() ? { note: approvalNote.trim() } : {}) },
                  dealer.slug,
                );
                if (result.ok) setApprovalConfirm('');
                return result;
              }, 'Dealer approved.');
            }}
          >
            Approve dealer
          </Button>
          {!dealer.actions.canApprove ? (
            <p className="w-full text-[12px] ink-muted">
              Verify all three KYC documents above before approving — approval makes every one of
              this dealer&rsquo;s listings eligible to appear publicly.
            </p>
          ) : (
            <p className="w-full text-[12px] ink-muted">
              Approving makes this dealer&rsquo;s listings eligible to appear publicly.
            </p>
          )}
        </div>
      ) : null}

      {dealer.actions.canRequestChanges ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
          <Field
            id="changesReason"
            label="What the dealer needs to change"
            className="min-w-[240px] flex-1"
          >
            <Input
              id="changesReason"
              value={changesReason}
              onChange={(event) => setChangesReason(event.target.value)}
              placeholder="Shown to the dealer verbatim — say exactly what to fix"
            />
          </Field>
          <Button
            variant="secondary"
            size="md"
            loading={pending}
            disabled={changesReason.trim().length < 6}
            onClick={() =>
              run(
                () =>
                  requestDealerChangesAction(
                    dealer.id,
                    { reason: changesReason.trim() },
                    dealer.slug,
                  ),
                'Sent back to the dealer for changes.',
              )
            }
          >
            Request changes
          </Button>
          <p className="w-full text-[12px] ink-muted">
            Reopens their application as a draft with everything they entered still in it. They
            correct what you named here and submit again. Nothing is deleted.
          </p>
        </div>
      ) : null}

      {dealer.actions.canReinstate ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
          <Field id="reinstateNote" label="Note" className="min-w-[220px] flex-1">
            <Input
              id="reinstateNote"
              value={reinstateNote}
              onChange={(event) => setReinstateNote(event.target.value)}
              placeholder="Internal — why the suspension is being lifted"
            />
          </Field>
          <Button
            variant="primary"
            size="md"
            loading={pending}
            onClick={() =>
              run(
                () =>
                  reinstateDealerAction(
                    dealer.id,
                    { ...(reinstateNote.trim() ? { note: reinstateNote.trim() } : {}) },
                    dealer.slug,
                  ),
                'Dealer reinstated.',
              )
            }
          >
            Reinstate dealer
          </Button>
          <p className="w-full text-[12px] ink-muted">
            Lifting the suspension clears the reason the dealer was shown and puts their listings
            back in front of buyers.
          </p>
        </div>
      ) : null}

      {dealer.actions.canSuspend ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
          <Field id="suspendReason" label="Reason for suspension" className="min-w-[240px] flex-1">
            <Input
              id="suspendReason"
              value={suspendReason}
              onChange={(event) => setSuspendReason(event.target.value)}
              placeholder="Shown to the dealer verbatim"
            />
          </Field>
          <Button
            variant="destructive"
            size="md"
            loading={pending}
            disabled={suspendReason.trim().length < 6}
            onClick={() =>
              run(
                () => suspendDealerAction(dealer.id, { reason: suspendReason.trim() }, dealer.slug),
                'Dealer suspended and their listings withdrawn.',
              )
            }
          >
            Suspend
          </Button>
          <p className="w-full text-[12px] ink-muted">
            Suspending removes all <span className="tnum">{dealer.counts.active}</span> of this
            dealer&rsquo;s live listings from the catalogue immediately.
          </p>
        </div>
      ) : null}

      {dealer.actions.canReject ? (
        <div className="flex flex-col gap-2 border-t border-(--color-divider) pt-3">
          {rejectOpen ? (
            <>
              <p className="text-[13px] font-medium text-(--color-err)">
                Rejecting deletes this application permanently.
              </p>
              <p className="text-[12px] ink-muted">
                The {dealer.documents.length} KYC document
                {dealer.documents.length === 1 ? '' : 's'} and the yard photo are erased from
                storage, and the dealership record is removed along with everything{' '}
                {dealer.contactName ?? 'the applicant'} entered. They keep their Google sign-in and
                nothing else — signing in again starts onboarding from the first step, as a new
                applicant. This cannot be undone.
              </p>
              <p className="text-[12px] ink-muted">
                If you only need something corrected, use <strong>Request changes</strong> above
                instead — it keeps everything.
              </p>

              <Field id="rejectReason" label="Reason" className="flex-1">
                <Input
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Shown to the dealer verbatim"
                />
              </Field>

              <Field
                id="rejectConfirm"
                label={`Type "${dealer.brandName}" to confirm`}
                className="flex-1"
              >
                <Input
                  id="rejectConfirm"
                  value={rejectConfirm}
                  onChange={(event) => setRejectConfirm(event.target.value)}
                  placeholder={dealer.brandName}
                  autoComplete="off"
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  size="md"
                  loading={pending}
                  disabled={
                    rejectReason.trim().length < 6 ||
                    rejectConfirm.trim().toLowerCase() !== dealer.brandName.toLowerCase()
                  }
                  onClick={() =>
                    run(
                      () =>
                        rejectDealerAction(dealer.id, { reason: rejectReason.trim() }, dealer.slug),
                      'Application rejected and deleted.',
                      '/admin/dealers',
                    )
                  }
                >
                  Reject and delete permanently
                </Button>
                <Button variant="ghost" size="md" onClick={() => setRejectOpen(false)}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setRejectOpen(true)}
            >
              Reject application…
            </Button>
          )}
        </div>
      ) : null}

      {!awaitingDecision &&
      !dealer.actions.canSuspend &&
      !dealer.actions.canReinstate &&
      !dealer.actions.canReject ? (
        <p className="text-[13px] ink-muted">No decisions are available from this state.</p>
      ) : null}
    </section>
  );
}
