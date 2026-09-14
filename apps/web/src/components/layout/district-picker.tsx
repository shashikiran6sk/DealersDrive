'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { stateCode } from '@/lib/state-codes';

export function DistrictPicker({
  locations,
  children,
}: {
  locations: PublicLocations;
  children: (chosen: DistrictChip | null) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { chosen, select } = useDistrictSelection(locations);

  return (
    <LocationDialog
      open={open}
      onOpenChange={setOpen}
      locations={locations}
      chosen={chosen}
      onSelect={(slug) => {
        select(slug);
        setOpen(false);
      }}
      trigger={children(chosen)}
    />
  );
}

export function useDistrictSelection(locations: PublicLocations): {
  chosen: DistrictChip | null;
  select: (slug: string | null) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get('district');
  const chosen = locations.districts.find((row) => row.slug === active) ?? null;

  function select(slug: string | null): void {
    const next = new URLSearchParams(searchParams.toString());
    if (slug === null) next.delete('district');
    else next.set('district', slug);
    next.delete('city');
    next.delete('page');

    const target = pathname.startsWith('/dealers') ? pathname : '/dealers';
    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
  }

  return { chosen, select };
}

function LocationDialog({
  open,
  onOpenChange,
  trigger,
  locations,
  chosen,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  locations: PublicLocations;
  chosen: DistrictChip | null;
  onSelect: (slug: string | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string | null>(null);

  const groups = useMemo(() => groupByState(locations.districts), [locations.districts]);
  const query = search.trim().toLowerCase();

  const matches = useMemo(
    () =>
      query === ''
        ? []
        : locations.districts.filter(
            (district) =>
              district.name.toLowerCase().includes(query) ||
              (district.state ?? '').toLowerCase().includes(query),
          ),
    [locations.districts, query],
  );

  const visible = stateFilter === null ? groups : groups.filter((g) => g.key === stateFilter);
  const searching = query !== '';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={trigger}
      title="Select location"
      closeLabel="Close location picker"
      className="w-[min(880px,100%)]"
      contentClassName="px-[18px] py-[16px] space-y-[18px]"
      header={
        <div className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <DialogTitle>Select location</DialogTitle>
            <DialogDescription>Choose a district to browse dealerships</DialogDescription>
          </div>
          <div className="w-full md:max-w-[300px]">
            <label className="sr-only" htmlFor="location-search">
              Search districts
            </label>
            <Input
              id="location-search"
              type="search"
              autoComplete="off"
              placeholder="Search district or state"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
        </div>
      }
      footer={
        <>
          <p className="text-[13px] ink-muted">
            {chosen ? (
              <>
                <span className="ink-subtle">Selected: </span>
                <span className="font-medium text-(--color-ink)">
                  {chosen.state ? `${chosen.name}, ${chosen.state}` : chosen.name}
                </span>
              </>
            ) : (
              'Showing dealerships in every district'
            )}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={chosen === null}
            onClick={() => {
              onSelect(null);
            }}
          >
            All districts <span className="tnum ink-muted">({locations.total})</span>
          </button>
        </>
      }
    >
      {!searching && groups.length > 1 ? (
        <div
          className="flex flex-wrap items-center gap-[7px]"
          role="group"
          aria-label="Filter by state"
        >
          <FilterChip
            pressed={stateFilter === null}
            onClick={() => {
              setStateFilter(null);
            }}
          >
            All states
          </FilterChip>
          {groups.map((group) => (
            <FilterChip
              key={group.key}
              pressed={stateFilter === group.key}
              onClick={() => {
                setStateFilter(group.key);
              }}
            >
              {group.state ?? 'State not recorded'}{' '}
              <span className="tnum opacity-60">{group.districts.length}</span>
            </FilterChip>
          ))}
        </div>
      ) : null}

      {searching ? (
        <section aria-labelledby="location-results-heading" className="space-y-[10px]">
          <h3 id="location-results-heading" className="eyebrow ink-subtle">
            {matches.length === 0
              ? 'No matching districts'
              : `${matches.length} matching ${matches.length === 1 ? 'district' : 'districts'}`}
          </h3>
          {matches.length === 0 ? (
            <p className="text-[13px] ink-muted">
              Nothing here matches “{search.trim()}”. Try the district, or the state it is in.
            </p>
          ) : (
            <DistrictGrid>
              {matches.map((district) => (
                <DistrictOption
                  key={district.slug}
                  district={district}
                  showState
                  selected={district.slug === chosen?.slug}
                  onSelect={onSelect}
                />
              ))}
            </DistrictGrid>
          )}
        </section>
      ) : locations.districts.length === 0 ? (
        <p className="text-[13px] ink-muted">
          No dealerships are listed yet. “All districts” shows everything the platform has.
        </p>
      ) : (
        visible.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`state-${group.key}`}
            className="space-y-[10px]"
          >
            <StateHeading group={group} />
            <DistrictGrid>
              {group.districts.map((district) => (
                <DistrictOption
                  key={district.slug}
                  district={district}
                  selected={district.slug === chosen?.slug}
                  onSelect={onSelect}
                />
              ))}
            </DistrictGrid>
          </section>
        ))
      )}
    </Dialog>
  );
}

function StateHeading({ group }: { group: StateGroup }) {
  const code = stateCode(group.state);
  const districts = group.districts.length;
  const dealers = group.districts.reduce((sum, district) => sum + district.count, 0);

  return (
    <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[4px] border-b border-(--color-divider) pb-[7px]">
      {code ? <Plate>{code}</Plate> : null}
      <h3
        id={`state-${group.key}`}
        className="font-heading text-[14px] font-semibold uppercase tracking-[0.04em]"
      >
        {group.state ?? 'State not recorded'}
      </h3>
      <span className="text-[11px] ink-faint tnum">
        {districts} {districts === 1 ? 'district' : 'districts'}
      </span>
      <span className="ml-auto text-[11px] ink-subtle tnum">
        {dealers} {dealers === 1 ? 'dealership' : 'dealerships'}
      </span>
    </div>
  );
}

function DistrictGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
      {children}
    </div>
  );
}

function DistrictOption({
  district,
  selected,
  showState = false,
  onSelect,
}: {
  district: DistrictChip;
  selected: boolean;
  showState?: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        onSelect(district.slug);
      }}
      className={cn(
        'flex min-h-11 items-center gap-[8px] border p-[10px] text-left transition-colors duration-[120ms] ease-out',
        selected
          ? 'border-(--color-accent) bg-(--color-accent-100)'
          : 'border-(--color-divider) bg-white hover:bg-(--color-bg) hover:border-[color-mix(in_srgb,var(--color-ink)_45%,transparent)]',
      )}
    >
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[13px] font-medium',
            selected && 'text-(--color-accent-700)',
          )}
        >
          {district.name}
        </span>
        <span className="block truncate text-[11px] ink-subtle">
          {showState ? (
            <>
              {district.state ?? 'State not recorded'}
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <span className="tnum">{district.count}</span>{' '}
          {district.count === 1 ? 'dealership' : 'dealerships'}
        </span>
      </span>
      {selected ? (
        <span className="flex-none text-[13px] text-(--color-accent)" aria-hidden="true">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function FilterChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'btn text-[12px] px-[10px] py-[4px]',
        pressed ? 'btn-primary' : 'btn-secondary',
      )}
    >
      {children}
    </button>
  );
}

interface StateGroup {
  key: string;
  state: string | null;
  districts: DistrictChip[];
}

function groupByState(districts: readonly DistrictChip[]): StateGroup[] {
  const groups = new Map<string, StateGroup>();

  for (const district of districts) {
    const key = district.state ?? '';
    const group = groups.get(key);
    if (group) group.districts.push(district);
    else
      groups.set(key, {
        key: key === '' ? 'unknown' : key,
        state: district.state,
        districts: [district],
      });
  }

  const total = (group: StateGroup) =>
    group.districts.reduce((sum, district) => sum + district.count, 0);

  return [...groups.values()].sort((a, b) => {
    if ((a.state === null) !== (b.state === null)) return a.state === null ? 1 : -1;
    return total(b) - total(a) || (a.state ?? '').localeCompare(b.state ?? '');
  });
}
