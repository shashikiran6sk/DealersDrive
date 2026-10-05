import type { SavedVehiclesResponse } from '@dealers-drive/contracts';
import Link from 'next/link';

import { ButtonLink } from '@/components/ui/button';
import { LinkPendingLabel } from '@/components/ui/link-pending';
import { EmptyState } from '@/components/ui/primitives';
import { VehicleCard } from '@/components/vehicle/vehicle-card';

import { SAVED_GROUPS, SAVED_LIST_TEXT, savedHref } from './saved-list.constants';

export interface SavedListProps {
  saved: SavedVehiclesResponse;
}

export function SavedList({ saved }: SavedListProps) {
  return (
    <div className="flex flex-col gap-[26px]">
      <div>
        <h1 className="text-[26px] sm:text-[30px]">{SAVED_LIST_TEXT.title}</h1>
        <p className="mt-[6px] text-[14px] ink-muted">{SAVED_LIST_TEXT.intro}</p>
      </div>

      {saved.data.length === 0 ? (
        <EmptyState
          title={SAVED_LIST_TEXT.emptyTitle}
          message={SAVED_LIST_TEXT.emptyMessage}
          action={
            <ButtonLink href={SAVED_LIST_TEXT.browseHref} variant="primary">
              {SAVED_LIST_TEXT.browse}
            </ButtonLink>
          }
        />
      ) : (
        SAVED_GROUPS.map((group) => {
          const rows = saved.data.filter((row) =>
            group.includes.includes(row.vehicle.availability),
          );
          if (rows.length === 0) return null;
          return (
            <section
              key={group.key}
              aria-labelledby={`saved-${group.key}`}
              className="flex flex-col gap-[12px]"
            >
              <div>
                <h2 id={`saved-${group.key}`} className="text-[18px]">
                  {group.title}{' '}
                  <span className="text-[14px] font-medium ink-subtle tnum">
                    {SAVED_LIST_TEXT.count(rows.length)}
                  </span>
                </h2>
                {group.note ? <p className="text-[13px] ink-muted">{group.note}</p> : null}
              </div>
              <div className="grid items-stretch gap-[16px] [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
                {rows.map((row) => (
                  <VehicleCard key={row.vehicle.slug} vehicle={row.vehicle} />
                ))}
              </div>
            </section>
          );
        })
      )}

      {saved.page.nextCursor ? (
        <Link
          href={savedHref(saved.page.nextCursor)}
          className="relative btn btn-secondary self-center"
        >
          <LinkPendingLabel>{SAVED_LIST_TEXT.more}</LinkPendingLabel>
        </Link>
      ) : null}
    </div>
  );
}
