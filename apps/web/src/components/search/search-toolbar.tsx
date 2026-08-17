'use client';

import type { FacetsResponse } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { FilterPanel, type FilterGroupKey } from '@/components/search/filter-panel';
import { buildSearchUrl, setParam, SORT_OPTIONS } from '@/lib/url';

/** The free-text field and the sort select, both writing to the URL. */
export function SearchToolbar({
  params,
  basePath,
  showSearch = true,
}: {
  params: Record<string, string>;
  basePath: string;
  showSearch?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(params.q ?? '');

  useEffect(() => setQuery(params.q ?? ''), [params.q]);

  return (
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {showSearch ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            router.push(buildSearchUrl(basePath, setParam(params, 'q', query.trim())));
          }}
        >
          <label className="sr-only" htmlFor="results-search">
            Search make or model
          </label>
          <input
            id="results-search"
            className="input w-auto min-w-[200px]"
            placeholder="Search make or model"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </form>
      ) : null}

      <label className="sr-only" htmlFor="sort">
        Sort results
      </label>
      <select
        id="sort"
        className="input w-auto min-w-[180px]"
        value={params.sort ?? 'relevance'}
        onChange={(event) =>
          router.push(
            buildSearchUrl(
              basePath,
              setParam(params, 'sort', event.target.value === 'relevance' ? undefined : event.target.value),
            ),
          )
        }
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * DESIGN-SPEC §3.3 — the mobile filter sheet. Bottom-aligned, backdrop click
 * closes, body scroll locks while open, and the sticky CTA carries a live
 * count so the user knows what applying will do before they do it.
 */
export function MobileFilterSheet({
  facets,
  params,
  basePath,
  resultCount,
  groups,
  dimZeroRows = false,
}: {
  facets: FacetsResponse;
  params: Record<string, string>;
  basePath: string;
  resultCount: number;
  /** Mirrors the rail: the portfolio's sheet must not offer a dealer filter. */
  groups?: readonly FilterGroupKey[];
  dimZeroRows?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="btn btn-secondary lg:hidden" onClick={() => setOpen(true)}>
        Filters
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] bg-[rgba(20,23,28,0.45)]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filter cars"
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-auto bg-white p-[18px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="text-[19px]">Filters</h3>
              <button
                type="button"
                className="btn btn-ghost text-[12px]"
                onClick={() => {
                  router.push(buildSearchUrl(basePath, params.city ? { city: params.city } : {}));
                  setOpen(false);
                }}
              >
                Clear all
              </button>
            </div>

            <FilterPanel
              facets={facets}
              params={params}
              basePath={basePath}
              dimZeroRows={dimZeroRows}
              {...(groups ? { groups } : {})}
              onNavigate={() => undefined}
            />

            <button
              type="button"
              className="btn btn-primary btn-block sticky bottom-0 mt-4 h-11"
              onClick={() => setOpen(false)}
            >
              Show <span className="tnum">{resultCount}</span> cars
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
