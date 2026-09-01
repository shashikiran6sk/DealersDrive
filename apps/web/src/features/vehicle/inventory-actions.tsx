'use client';

import type { InventoryRow } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Banner } from '@/components/ui/primitives';
import { markSoldAction, removeListingAction } from '@/features/vehicle/actions';
import { cn } from '@/lib/cn';

/**
 * The per-row actions on the inventory table (DESIGN-SPEC §3.13).
 *
 * Which actions exist is the API's ruling, not this component's: `canMarkSold`
 * and `canRemoveListing` come off the row, computed from the same display
 * status the badge shows. A client deriving them independently would eventually
 * offer "Mark as sold" on a draft, and the 409 would read as a bug.
 *
 * Both actions are confirmed, and the confirmation states the consequence
 * rather than asking "are you sure": the two differ in exactly the way a dealer
 * needs explained — one keeps the car on the marketplace, the other does not.
 */
export function InventoryActions({ row }: { row: InventoryRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<'sold' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [soldPrice, setSoldPrice] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  function confirmSold() {
    setError(null);
    startTransition(async () => {
      const rupees = soldPrice.trim();
      const result = await markSoldAction(row.vehicleId, {
        // Rupees on screen, paise on the wire (Rule 3). Optional and private —
        // the sold price is never shown to buyers.
        ...(rupees === '' ? {} : { soldPricePaise: Math.round(Number(rupees) * 100) }),
      });
      if (!result.ok) {
        setError(result.message ?? 'We could not mark that vehicle sold.');
        return;
      }
      setOpen(null);
      setNotice(result.data?.message ?? 'Marked sold.');
      router.refresh();
    });
  }

  function confirmRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeListingAction(row.vehicleId);
      if (!result.ok) {
        setError(result.message ?? 'We could not remove that listing.');
        return;
      }
      setOpen(null);
      setNotice(result.data?.message ?? 'Removed from the marketplace.');
      router.refresh();
    });
  }

  return (
    <div ref={menuRef} className="flex flex-wrap items-center justify-end gap-1">
      {notice ? (
        <span className="mr-auto text-[11px] text-(--color-ok)">{notice}</span>
      ) : null}

      <Link
        href={`/dealer/vehicles/${row.vehicleId}/edit`}
        className="btn btn-ghost text-[12px]"
      >
        {row.canEdit ? 'Edit' : 'View'}
      </Link>

      {row.canMarkSold ? (
        <button
          type="button"
          className="btn btn-ghost text-[12px]"
          onClick={() => {
            setOpen('sold');
            setError(null);
          }}
        >
          Mark as sold
        </button>
      ) : null}

      {row.canRemoveListing ? (
        <button
          type="button"
          className="btn btn-ghost text-[12px] text-(--color-err)"
          onClick={() => {
            setOpen('remove');
            setError(null);
          }}
        >
          Remove listing
        </button>
      ) : null}

      {open ? (
        <ConfirmDialog
          title={open === 'sold' ? 'Mark this car sold?' : 'Remove this listing?'}
          onClose={() => setOpen(null)}
        >
          {error ? <Banner tone="err">{error}</Banner> : null}

          <p className="text-[13px] leading-[1.6] ink-secondary">
            <strong className="ink">{row.title}</strong>
            {open === 'sold' ? (
              <>
                {' '}
                will stay on the marketplace with a <strong className="ink">Sold</strong> badge.
                Buyers will still see it as proof you move stock, but they will not be able to
                open it or enquire about it. The credit you spent is not returned.
              </>
            ) : (
              <>
                {' '}
                will be taken off the marketplace immediately — buyers will stop seeing it in
                search, on your dealer page and at its own link. The car stays in your inventory
                as an editable draft, and listing it again costs one credit. The credit already
                spent is not returned.
              </>
            )}
          </p>

          {open === 'sold' ? (
            <label className="field" htmlFor="soldPrice">
              <span className="text-[13px]">
                Sold price (₹) <span className="ink-faint">optional, never shown publicly</span>
              </span>
              <input
                id="soldPrice"
                type="number"
                min={10}
                step={1000}
                className="input tnum"
                value={soldPrice}
                onChange={(event) => setSoldPrice(event.target.value)}
              />
            </label>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-(--color-divider) pt-3">
            <Button variant="secondary" size="md" disabled={pending} onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={pending}
              onClick={open === 'sold' ? confirmSold : confirmRemove}
            >
              {open === 'sold' ? 'Mark as sold' : 'Remove from marketplace'}
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

/**
 * A modal, kept local rather than promoted to `components/ui`: it is the only
 * one in the product, and generalising a single use is how a primitive ends up
 * with six props nobody needs.
 */
function ConfirmDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(13,16,23,0.55)] p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('card w-full max-w-[440px] gap-3 p-5 text-left')}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[19px]">{title}</h2>
        {children}
      </div>
    </div>
  );
}
