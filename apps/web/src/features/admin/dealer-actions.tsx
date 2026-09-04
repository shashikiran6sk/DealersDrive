'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banner } from '@/components/ui/primitives';
import { approveDealerAction, suspendDealerAction } from '@/features/admin/actions';

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

      {dealer.actions.canApprove ? (
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
        The slice above, made visible. At the baseline a SUPER_ADMIN always has
        the grant block, so this card is never empty; with grants deferred to
        F054 a suspended or rejected dealership would render a bare heading,
        which reads as a rendering bug rather than as "nothing to do here".
        Those two states have no console control at the baseline either — the
        reject and reinstate endpoints exist and are documented, but nothing
        calls them — so the line says that rather than inventing a button.
      */}
      {!dealer.actions.canApprove && !dealer.actions.canSuspend ? (
        <p className="text-[13px] ink-muted">
          No decisions are available from this state.{' '}
          {dealer.actions.canReinstate
            ? 'Reinstating is an API-only action for now.'
            : 'The dealership is still completing its application.'}
        </p>
      ) : null}
    </section>
  );
}
