'use client';

import type { DistrictChip, PublicLocations } from '@dealers-drive/contracts';
import { useMemo, useState, type ReactNode } from 'react';

import { Dialog, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import { DISTRICT_PICKER_TEXT } from './district-picker.constants';
import { DistrictGrid } from './district-grid';
import { DistrictOption } from './district-option';
import { FilterChip } from './filter-chip';
import { StateHeading } from './state-heading';
import { groupByState } from './utils';

export interface LocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: ReactNode;
  locations: PublicLocations;
  chosen: DistrictChip | null;
  onSelect: (slug: string | null) => void;
}

/**
 * The dialog itself. Mounted only while open, so its search box and its state
 * filter start empty every time rather than remembering a search somebody
 * abandoned three pages ago — which is also what keeps the work below off every
 * render of the header.
 */
export function LocationDialog({
  open,
  onOpenChange,
  trigger,
  locations,
  chosen,
  onSelect,
}: LocationDialogProps) {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<string | null>(null);

  const groups = useMemo(() => groupByState(locations.districts), [locations.districts]);
  const query = search.trim().toLowerCase();

  /**
   * Either the state groups, or — while something is typed — one flat list of
   * matches. The flat list is why search is a separate mode rather than a filter
   * over the groups: a query matching four districts across four states would
   * otherwise be four headings with one row under each, and "which state is
   * Vellore in" would be a heading a reader has to look up to. Every row in the
   * flat list carries its own state (**R22**).
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
      title={DISTRICT_PICKER_TEXT.title}
      closeLabel={DISTRICT_PICKER_TEXT.closeLabel}
      /* §2.14's 440px is the width of a confirmation. This is a grid of 38
         districts, so it takes the reference design's 880 and the same
         `min(…, 100%)` shape, which keeps it inside a 360px phone. */
      className="w-[min(880px,100%)]"
      contentClassName="px-[18px] py-[16px] space-y-[18px]"
      header={
        <div className="flex flex-col gap-[10px] md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <DialogTitle>{DISTRICT_PICKER_TEXT.title}</DialogTitle>
            <DialogDescription>{DISTRICT_PICKER_TEXT.description}</DialogDescription>
          </div>
          <div className="w-full md:max-w-[300px]">
            <label className="sr-only" htmlFor="location-search">
              {DISTRICT_PICKER_TEXT.searchLabel}
            </label>
            <Input
              id="location-search"
              type="search"
              autoComplete="off"
              placeholder={DISTRICT_PICKER_TEXT.searchPlaceholder}
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
                <span className="ink-subtle">{DISTRICT_PICKER_TEXT.selectedPrefix}</span>
                <span className="font-medium text-(--color-ink)">
                  {DISTRICT_PICKER_TEXT.selectedDistrict(chosen.name, chosen.state)}
                </span>
              </>
            ) : (
              DISTRICT_PICKER_TEXT.everyDistrict
            )}
          </p>
          {/* The way back, carrying its own count rather than being an escape
              hatch with a blank beside it. */}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={chosen === null}
            onClick={() => {
              onSelect(null);
            }}
          >
            {DISTRICT_PICKER_TEXT.allDistricts}{' '}
            <span className="tnum ink-muted">({locations.total})</span>
          </button>
        </>
      }
    >
      {/*
        The state row is navigation, never a selection: pressing `Tamil Nadu`
        narrows what is on screen and changes nobody's location. It appears only
        when there is more than one state to move between.
      */}
      {!searching && groups.length > 1 ? (
        <div
          className="flex flex-wrap items-center gap-[7px]"
          role="group"
          aria-label={DISTRICT_PICKER_TEXT.stateFilterLabel}
        >
          <FilterChip
            pressed={stateFilter === null}
            onClick={() => {
              setStateFilter(null);
            }}
          >
            {DISTRICT_PICKER_TEXT.allStates}
          </FilterChip>
          {groups.map((group) => (
            <FilterChip
              key={group.key}
              pressed={stateFilter === group.key}
              onClick={() => {
                setStateFilter(group.key);
              }}
            >
              {group.state ?? DISTRICT_PICKER_TEXT.unknownState}{' '}
              <span className="tnum opacity-60">{group.districts.length}</span>
            </FilterChip>
          ))}
        </div>
      ) : null}

      {searching ? (
        <section aria-labelledby="location-results-heading" className="space-y-[10px]">
          <h3 id="location-results-heading" className="eyebrow ink-subtle">
            {matches.length === 0
              ? DISTRICT_PICKER_TEXT.noMatches
              : DISTRICT_PICKER_TEXT.matchCount(matches.length)}
          </h3>
          {matches.length === 0 ? (
            <p className="text-[13px] ink-muted">
              {DISTRICT_PICKER_TEXT.noMatchHint(search.trim())}
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
        <p className="text-[13px] ink-muted">{DISTRICT_PICKER_TEXT.nothingListed}</p>
      ) : (
        visible.map((group) => (
          <section key={group.key} aria-labelledby={`state-${group.key}`} className="space-y-[10px]">
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
