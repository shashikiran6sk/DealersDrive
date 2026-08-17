'use client';

import type { AdminListingDetail } from '@dealers-drive/contracts';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import {
  approveListingAction,
  rejectListingAction,
  requestChangesAction,
  takedownListingAction,
} from '@/features/admin/actions';

/**
 * DESIGN-SPEC §3.17 review actions, §2.14 dialog.
 *
 * Approve is one click; everything that hurts a dealer asks for a reason first,
 * and the dialog says what the decision does to their held credit before it is
 * taken. A reviewer should never have to remember which of these refunds.
 */
export function ReviewActions({ listing }: { listing: AdminListingDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setError(null);
    startTransition(async () => {
      const outcome = await work();
      if (!outcome.ok) {
        setError(outcome.message ?? 'That action did not go through.');
        return;
      }
      setResult(success);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <Banner tone="err">{error}</Banner> : null}
      {result ? <Banner tone="ok">{result}</Banner> : null}

      <div className="flex flex-wrap gap-2">
        {listing.actions.canApprove ? (
          <Button
            variant="primary"
            size="md"
            loading={pending}
            onClick={() =>
              run(() => approveListingAction(listing.listingId), 'Listing approved and live.')
            }
          >
            Approve listing
          </Button>
        ) : null}

        {listing.actions.canReject ? (
          <ReasonDialog
            trigger={<Button variant="secondary" size="md">Reject</Button>}
            title="Reject this listing"
            body="The held credit is returned to the dealer in full. Your reason is shown to them verbatim, so write something they can act on."
            label="Reason for rejection"
            presets={listing.rejectionReasonPresets}
            confirmLabel="Reject listing"
            pending={pending}
            onConfirm={(reason) =>
              run(
                () => rejectListingAction(listing.listingId, { reason }),
                'Listing rejected. The credit has been returned.',
              )
            }
          />
        ) : null}

        {listing.actions.canRequestChanges ? (
          <ReasonDialog
            trigger={<Button variant="secondary" size="md">Request changes</Button>}
            title="Request changes"
            body="The credit stays held, so the dealer can fix the listing and resubmit without paying twice. That is the difference between this and a rejection."
            label="What needs to change"
            presets={[]}
            confirmLabel="Send request"
            pending={pending}
            onConfirm={(note) =>
              run(
                () => requestChangesAction(listing.listingId, { note }),
                'Changes requested. The credit remains held.',
              )
            }
          />
        ) : null}

        {listing.actions.canTakedown ? (
          <ReasonDialog
            trigger={<Button variant="destructive" size="md">Take down</Button>}
            title="Take this listing down"
            body="It leaves the catalogue immediately. Use this for a live listing that should not be public."
            label="Reason for takedown"
            presets={[]}
            confirmLabel="Take down"
            pending={pending}
            onConfirm={(reason) =>
              run(
                () => takedownListingAction(listing.listingId, { reason, refundCredit: false }),
                'Listing removed from the catalogue.',
              )
            }
          />
        ) : null}
      </div>

      <p className="text-[12px] ink-muted">{listing.actions.consequenceNote}</p>
    </div>
  );
}

/**
 * §2.14 — the destructive-confirmation dialog: title, one paragraph naming the
 * consequence, a required reason, then the action. Escape and the backdrop both
 * cancel; Radix handles the focus trap and restore.
 */
function ReasonDialog({
  trigger,
  title,
  body,
  label,
  presets,
  confirmLabel,
  pending,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  body: string;
  label: string;
  presets: string[];
  confirmLabel: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const tooShort = reason.trim().length < 6;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setReason('');
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-[rgba(20,23,28,0.45)]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-[7px] bg-white p-5 shadow-[var(--shadow-lg)]">
          <Dialog.Title className="text-[21px]">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-[13px] leading-[1.55] ink-secondary">
            {body}
          </Dialog.Description>

          {presets.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-[6px]">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className="tag tag-outline cursor-pointer text-[11px]"
                  onClick={() => setReason(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          ) : null}

          <div className="field mt-3">
            <label htmlFor="reason">{label}</label>
            <textarea
              id="reason"
              className="input"
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            {tooShort && reason.length > 0 ? (
              <div className="mt-1 text-[11px] text-(--color-err)">
                At least 6 characters — the dealer sees this.
              </div>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Cancel</Button>
            </Dialog.Close>
            <Button
              variant="primary"
              loading={pending}
              disabled={tooShort}
              onClick={() => {
                onConfirm(reason.trim());
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
