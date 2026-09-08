'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, type ReactNode } from 'react';

import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plate } from '@/components/ui/primitives';
import { cn } from '@/lib/cn';
import { stateCode } from '@/lib/state-codes';

/**
 * DESIGN-SPEC §2.14 / §2.18 — the header's location button, and the dialog it
 * opens.
 *
 * ## Districts, not cities
 *
 * The baseline's version of this listed cities, off a five-row `cities` table
 * that **D6** removed. Districts is the better question at this level and would
 * have been even with the table: a district is the area somebody would drive
 * across, the towns inside it give no hint they are related — Arakkonam and
 * Walajapet share a district with Arcot and with nothing else — and a header
 * dropdown listing every town on the platform stops being readable at about
 * thirty. The towns are the chips on the directory, narrowed to whatever is
 * chosen here.
 *
 * ## Why it is a dialog now (R22)
 *
 * R19 restored the baseline's 220px panel with no height cap, and wrote down
 * what that cost: *"past roughly fifteen districts the menu is taller than a
 * short viewport and the last rows go under the fold. Tamil Nadu has 38, so
 * this is a decision to revisit when the platform is in more than a handful of
 * them."* It also listed those 38 as one flat column — and a flat column is the
 * real problem, not the height. `Vellore`, `Bangalore`, `Madurai` in one list
 * asks a buyer to know which state each is in, and the ones who would ask are
 * exactly the ones who do not know.
 *
 * So the menu became a centred dialog that says it: a **state** is a heading
 * you cannot click, and the **districts** under it are the buttons. The
 * hierarchy is the whole point — nothing here selects a state, and there is no
 * second way to select a district either.
 *
 * ## The selection is still immediate
 *
 * Choosing a district pushes the URL and closes, exactly as the dropdown did.
 * The design reference draws a `Confirm selection →` footer; adding one would
 * be new business logic in a change that is about the shape of the list, so the
 * footer carries what *is* chosen and the way back to all of it instead.
 *
 * ## Choosing a district drops the towns
 *
 * `?district=ranipet&city=katpadi` is an empty page: Katpadi is in Vellore.
 * Rather than let a buyer navigate into that and wonder what they did, changing
 * the district clears `city` — the chips underneath are about to be a different
 * set of towns anyway.
 *
 * ## Keyboard
 *
 * Enter or Space opens; the dialog then takes focus, traps it, closes on
 * Escape or a backdrop click and hands focus back to this button — all of it
 * Radix's, which is why `Dialog` exists (see its docblock, and component-map
 * finding **D-C**). Every district is a real `<button>`, so Tab reaches them
 * and Enter and Space choose them without anything here re-implementing that.
 *
 * The arrow-key roving R19 added went with the listbox. A `role="listbox"`
 * promises the arrows work and this is not one any more: it is a document with
 * a search field, filter chips and grouped buttons, and Tab is what moves
 * through a document.
 */
export function LocationSelector({ locations }: { locations: PublicLocations }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get('district');
  const chosen = locations.districts.find((row) => row.slug === active) ?? null;

  function select(slug: string | null): void {
    const next = new URLSearchParams(searchParams.toString());
    if (slug === null) next.delete('district');
    else next.set('district', slug);
    // The towns belonged to the district being left, and the page number to a
    // result set that no longer exists.
    next.delete('city');
    next.delete('page');

    /*
     * A district filters dealerships, so it goes to the directory — from
     * anywhere that is not already showing one. Choosing a place from the home
     * page is a person saying where they are, and the useful answer to that is
     * the dealerships there, not the same home page with a query string on it.
     */
    const target = pathname.startsWith('/dealers') ? pathname : '/dealers';
    const query = next.toString();
    router.push(query ? `${target}?${query}` : target);
    setOpen(false);
  }

  return (
    <LocationDialog
      open={open}
      onOpenChange={setOpen}
      locations={locations}
      chosen={chosen}
      onSelect={select}
      trigger={
        /*
          The button is handed to the dialog rather than wired up here. Radix's
          modal content restores focus to *its* trigger on close, so a button it
          does not know about leaves focus on `<body>` — see `Dialog`. It also
          means `aria-haspopup="dialog"` and `aria-expanded` are Radix's to keep
          true rather than two more attributes to remember.
        */
        <button type="button" className="btn btn-secondary flex items-center gap-[7px]">
          <span className="block h-[14px] w-[5px] bg-(--color-accent)" aria-hidden="true" />
          {chosen?.name ?? 'All districts'} <span aria-hidden="true">▾</span>
        </button>
      }
    />
  );
}

/**
 * The dialog itself.
 *
 * Mounted only while open, so its search box and its state filter start empty
 * every time rather than remembering a search somebody abandoned three pages
 * ago. That is also what keeps the work below off every render of the header.
 */
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

  /**
   * What the body shows: either the state groups, or — while something is
   * typed — one flat list of matches.
   *
   * The flat list is the reason search is a separate mode rather than a filter
   * over the groups. A query that matches four districts across four states
   * would otherwise be four headings with one row under each, and the answer to
   * "which state is Vellore in" would be a heading a reader has to look up to.
   * In the flat list every row carries its own state, so no result is ambiguous
   * on its own (**R22**).
   */
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
      /* §2.14's 440px is the width of a confirmation. This is a grid of 38
         districts, so it takes the reference design's 880 and the same
         `min(…, 100%)` shape, which is what keeps it inside a 360px phone. */
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
              /* It says what it searches. The reference's placeholder offers
                 taluk and pincode; the payload is districts and the states they
                 are in, and a placeholder promising a field the data does not
                 have is a bug report waiting to be filed. */
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
          {/* The way back, and it carries its own count rather than being an
              escape hatch with a blank beside it. */}
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
      {/*
        The state row is navigation, never a selection: pressing `Tamil Nadu`
        narrows what is on screen and changes nobody's location. It appears only
        when there is more than one state to move between — on a platform
        trading in one state it would be a control with a single meaningful
        option, which is a control that only takes up room.
      */}
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
                  /* Every result names its state, so no row is ambiguous on its
                     own — the whole reason search is a flat list. */
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

/**
 * A state, as a heading and nothing else.
 *
 * Deliberately not a `<button>`, not focusable, with no hover, no pressed
 * styling and no cursor change: a state is not a place this product can be
 * filtered to, and anything that looks pressable here would be an invitation to
 * a dead end. That is the one rule this section has, so it is worth stating
 * where somebody might otherwise "improve" it.
 *
 * The plate carries the RTO code because that is what the code *is* — `TN 09 BX
 * 4412` starts with the same two letters — which stretches §4.5's enumeration
 * of four plate uses by one, and does so on the one motif in the system that
 * means "a registration authority said this". A state the code map does not
 * recognise renders without one; see `lib/state-codes.ts`.
 */
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

/**
 * The grid the districts sit in. One column on a phone, four on a desktop —
 * `auto-fill` rather than fixed counts, so a state with three districts does
 * not leave a gap the width of a fourth.
 */
function DistrictGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
      {children}
    </div>
  );
}

/**
 * A district — the only selectable thing in the dialog.
 *
 * A real `<button>`, so Tab reaches it and Enter and Space choose it (§2.1:
 * never a `<div>` with an `onClick`). `min-h-11` is 44px, the mobile touch
 * minimum (§4.15), which the two-line body clears on its own everywhere else.
 *
 * Selection is announced three ways over, because colour alone is not a status
 * (§4.15): `aria-pressed` for a screen reader, a ✓ for an eye, and the cobalt
 * border and `accent-100` fill for a glance. Remove the tick and the control
 * still says which one it is.
 *
 * No shadow — §4.1 allows the dialog one and nothing inside it.
 */
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

/** A state filter. Navigation, not a selection — see the call site. */
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
  /** Stable across renders and safe in an `id`; the state name is neither. */
  key: string;
  state: string | null;
  districts: DistrictChip[];
}

/**
 * The districts, grouped under the state each one is in.
 *
 * The pairing comes off the payload — `DistrictChip.state`, which the API takes
 * from the dealership's own address (**R22**). Nothing here infers a state from
 * a district's name, and there is nothing it could infer one from: D6 removed
 * the table that would have held the pair.
 *
 * Order is the API's, twice over. Districts arrive busiest first and stay that
 * way; states are ordered by the dealerships in them, then by name, so two
 * states of the same size cannot swap places between requests. The districts
 * with no state recorded sort last whatever their size — it is a heading that
 * explains an absence, and an absence does not lead.
 */
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
