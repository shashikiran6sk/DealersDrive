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
  suspendDealerAction,
} from '@/features/admin/actions';

/**
 * D4 — the dealer-moderation controls.
 *
 * Which controls appear is the API's answer, not this component's: `actions`
 * comes back on `AdminDealerDetail` already resolved from the dealership's
 * status, so two admins looking at one record cannot reach different
 * conclusions about what is available.
 *
 * Suspending pulls every one of this dealer's listings out of the catalogue at
 * once, so the count is stated before the button is pressed (rule 6) — and the
 * button stays disabled until there is a reason of substance behind it, because
 * the dealer reads that reason verbatim.
 *
 * **The approve control is rendered from the status, not from `canApprove`.**
 * That is the fix for a screen that read as broken: `canApprove` is
 * `PENDING_APPROVAL && allDocumentsVerified`, so an application whose documents
 * had not been reviewed yet showed no approve button at all — and, since
 * verifying a document was itself an API-only action, that was every
 * application. A moderator looking at a dealership waiting for a decision now
 * always sees the button; when the documents are not verified it is disabled
 * and says which condition is unmet. The permission is still the API's to
 * enforce, and it still does.
 *
 * **Reinstate is here for the same reason.** SUSPENDED is not a terminal state
 * and the console should not present it as one.
 *
 * ── Reconstruction slice ────────────────────────────────────────────────────
 * The baseline renders a third block here — a standalone credit grant, gated on
 * `actions.canGrantCredits` — and an onboarding-credits field inside the
 * approval block. Both move credits, which means a `CreditTransaction` through
 * `moveCredits` (rule 4), and neither the model nor the facade exists until
 * **F050**. They return at **F054** with the endpoint that backs them;
 * `canGrantCredits` is already in the contract and is deliberately unread here
 * rather than removed.
 * ────────────────────────────────────────────────────────────────────────────
 */
export function DealerAdminActions({ dealer }: { dealer: AdminDealerDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [approvalNote, setApprovalNote] = useState('');
  const [suspendReason, setSuspendReason] = useState('');
  const [reinstateNote, setReinstateNote] = useState('');

  // Waiting for a decision. The button appears on this; whether it is *usable*
  // is `canApprove`, which additionally wants the KYC documents verified.
  const awaitingDecision = dealer.status === 'PENDING_APPROVAL';

  function run(work: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      if (!result.ok) {
        setError(result.message ?? 'That action did not go through.');
        return;
      }
      setNotice(success);
      router.refresh();
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
          <Button
            variant="primary"
            size="md"
            loading={pending}
            disabled={!dealer.actions.canApprove}
            onClick={() =>
              run(
                () =>
                  approveDealerAction(dealer.id, {
                    ...(approvalNote.trim() ? { note: approvalNote.trim() } : {}),
                  }),
                'Dealer approved.',
              )
            }
          >
            Approve dealer
          </Button>
          {/*
            A disabled button with no explanation is indistinguishable from a
            broken one. This is the missing condition, stated.
          */}
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
                  reinstateDealerAction(dealer.id, {
                    ...(reinstateNote.trim() ? { note: reinstateNote.trim() } : {}),
                  }),
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
                () => suspendDealerAction(dealer.id, { reason: suspendReason.trim() }),
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

      {/*
        With grants deferred to F054, a DRAFT or REJECTED dealership has nothing
        to decide — and a card rendering a bare heading reads as a rendering bug
        rather than as "nothing to do here".
      */}
      {!awaitingDecision && !dealer.actions.canSuspend && !dealer.actions.canReinstate ? (
        <p className="text-[13px] ink-muted">
          No decisions are available from this state.{' '}
          {dealer.status === 'DRAFT'
            ? 'The dealership is still completing its application.'
            : 'The application was rejected and has not been resubmitted.'}
        </p>
      ) : null}
    </section>
  );
}
