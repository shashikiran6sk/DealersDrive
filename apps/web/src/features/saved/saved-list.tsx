'use client';

import type { VehicleBatchResponse } from '@dealers-drive/contracts';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { EmptyState, ErrorState } from '@/components/ui/primitives';
import { VehicleCard, VehicleCardSkeleton } from '@/components/vehicle/vehicle-card';
import { useSavedCars } from '@/features/saved/saved-store';

/**
 * DESIGN-SPEC §3.7.
 *
 * The ids are in `localStorage`, so only the browser can start this — the
 * server has no idea what this device saved. `POST /v1/vehicles/batch` turns
 * them into cards, and anything it reports as `unavailable` (sold, expired,
 * removed) is pruned from storage rather than left to rot as a dead row.
 */
export function SavedCarsList({ activeCount }: { activeCount: number }) {
  const { ids, hydrated, clear, prune } = useSavedCars();
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; data: VehicleBatchResponse } | { status: 'error' }
  >({ status: 'loading' });

  useEffect(() => {
    if (!hydrated) return;

    if (ids.length === 0) {
      setState({ status: 'ready', data: { data: [], unavailable: [], savedCountLabel: 'No cars saved' } });
      return;
    }

    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch('/api/vehicles/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids.slice(0, 100) }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as VehicleBatchResponse;
        setState({ status: 'ready', data });
      } catch {
        if (controller.signal.aborted) return;
        setState({ status: 'error' });
      }
    })();

    return () => controller.abort();
    // `ids` is the dependency, but pruning below rewrites it; keying on the
    // joined string means an unchanged set does not refetch in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, ids.join(',')]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    prune(state.data.unavailable.map((entry) => entry.id));
    // `prune` is a no-op when nothing changed, so this cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!hydrated || state.status === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <VehicleCardSkeleton />
        <VehicleCardSkeleton />
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <ErrorState
        message="We could not load your saved cars. Your list is safe on this device — try again in a moment."
        action={
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
            Try again
          </button>
        }
      />
    );
  }

  const { data } = state;

  if (data.data.length === 0) {
    return (
      <EmptyState
        title="No saved cars yet"
        message="Tap the heart on any car to keep it here. Your list stays on this device — no account needed."
        action={
          <Link href="/cars" className="btn btn-primary">
            Browse <span className="tnum">{activeCount}</span> cars
          </Link>
        }
      />
    );
  }

  return (
    <>
      <div className="mb-[14px] flex items-baseline gap-3">
        <span className="text-[14px] ink-muted tnum">{data.savedCountLabel}</span>
        <button type="button" className="btn btn-ghost ml-auto text-[12px]" onClick={clear}>
          Clear all
        </button>
      </div>

      {data.unavailable.length > 0 ? (
        <p className="mb-3 text-[12px] ink-subtle">
          <span className="tnum">{data.unavailable.length}</span> saved{' '}
          {data.unavailable.length === 1 ? 'car has' : 'cars have'} been sold or withdrawn and were
          removed from this list.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {data.data.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} variant="list" />
        ))}
      </div>
    </>
  );
}
