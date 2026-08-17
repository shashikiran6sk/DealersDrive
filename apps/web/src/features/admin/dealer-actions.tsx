'use client';

import type { AdminDealerDetail } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { Field } from '@/components/forms/field';
import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import {
  approveDealerAction,
  grantCreditsAction,
  suspendDealerAction,
} from '@/features/admin/actions';

/**
 * D4 and D6 — the dealer-moderation controls.
 *
 * Approving may grant credits, and granting is a real ledger movement with a
 * reason attached, not a number typed into a balance field. Suspending pulls
 * every one of this dealer's listings out of the catalogue at once, so the
 * count is stated before the button is pressed (Rule 6).
 */
export function DealerAdminActions({ dealer }: { dealer: AdminDealerDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [grantCredits, setGrantCredits] = useState('10');
  const [grantReason, setGrantReason] = useState('Onboarding bonus');
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
          <Field id="grantCredits" label="Credits to grant on approval" className="w-[180px]">
            <input
              id="grantCredits"
              type="number"
              min={0}
              max={1000}
              className="input tnum"
              value={grantCredits}
              onChange={(event) => setGrantCredits(event.target.value)}
            />
          </Field>
          <Field id="grantNote" label="Note" className="min-w-[220px] flex-1">
            <input
              id="grantNote"
              className="input"
              value={grantReason}
              onChange={(event) => setGrantReason(event.target.value)}
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
                    ...(Number(grantCredits) > 0 ? { grantCredits: Number(grantCredits) } : {}),
                    ...(grantReason.trim() ? { note: grantReason.trim() } : {}),
                  }),
                'Dealer approved.',
              )
            }
          >
            Approve dealer
          </Button>
        </div>
      ) : null}

      {dealer.actions.canGrantCredits ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
          <Field id="extraCredits" label="Grant credits" className="w-[180px]">
            <input
              id="extraCredits"
              type="number"
              min={1}
              max={1000}
              className="input tnum"
              value={grantCredits}
              onChange={(event) => setGrantCredits(event.target.value)}
            />
          </Field>
          <Field id="grantReason" label="Reason" className="min-w-[220px] flex-1">
            <input
              id="grantReason"
              className="input"
              value={grantReason}
              onChange={(event) => setGrantReason(event.target.value)}
            />
          </Field>
          <Button
            variant="secondary"
            size="md"
            loading={pending}
            disabled={grantReason.trim().length < 3 || Number(grantCredits) < 1}
            onClick={() =>
              run(
                () =>
                  grantCreditsAction(dealer.id, {
                    credits: Number(grantCredits),
                    reason: grantReason.trim(),
                  }),
                `${grantCredits} credits granted.`,
              )
            }
          >
            Grant
          </Button>
        </div>
      ) : null}

      {dealer.actions.canSuspend ? (
        <div className="flex flex-wrap items-end gap-3 border-t border-(--color-divider) pt-3">
          <Field id="suspendReason" label="Reason for suspension" className="min-w-[240px] flex-1">
            <input
              id="suspendReason"
              className="input"
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
    </section>
  );
}
