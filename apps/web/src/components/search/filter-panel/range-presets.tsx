'use client';

import type { RangeFacet } from '@dealers-drive/contracts';

import { FacetRow } from './facet-row';
import { FILTER_PANEL_TEXT } from './filter-panel.constants';
import { isPreset } from './utils';

export interface RangePresetsProps {
  name: string;
  idPrefix: string;
  bands: readonly RangeFacet[];
  range: { min: number | null; max: number | null };
  anyLabel: string;
  describe: (range: { min: number | null; max: number | null }) => string;
  onSelect: (min: number | null, max: number | null) => void;
}

export function RangePresets({
  name,
  idPrefix,
  bands,
  range,
  anyLabel,
  describe,
  onSelect,
}: RangePresetsProps) {
  const isAny = range.min === null && range.max === null;
  const isCustom = !isAny && !bands.some((band) => isPreset(band, range));

  return (
    <ul className="flex flex-col gap-[7px]">
      <FacetRow
        type="radio"
        name={`${idPrefix}-${name}`}
        id={`${idPrefix}-${name}-any`}
        label={anyLabel}
        checked={isAny}
        onChange={() => {
          onSelect(null, null);
        }}
      />
      {bands.map((band, index) => (
        <FacetRow
          key={band.label}
          type="radio"
          name={`${idPrefix}-${name}`}
          id={`${idPrefix}-${name}-${String(index)}`}
          label={band.label}
          count={band.count}
          checked={isPreset(band, range)}
          onChange={() => {
            onSelect(band.min, band.max);
          }}
        />
      ))}
      {isCustom ? (
        <FacetRow
          type="radio"
          name={`${idPrefix}-${name}`}
          id={`${idPrefix}-${name}-custom`}
          label={`${FILTER_PANEL_TEXT.customRange}: ${describe(range)}`}
          checked
          onChange={() => undefined}
        />
      ) : null}
    </ul>
  );
}
