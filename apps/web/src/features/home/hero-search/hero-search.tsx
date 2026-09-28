'use client';

import type { FacetOption } from '@dealers-drive/contracts';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { heroFacetsAction } from '@/features/home/actions';

import { HeroDistrict } from './hero-district';
import { BUDGET_OPTIONS, CARS_PATH, HERO_SEARCH_TEXT } from './hero-search.constants';
import type { HeroSearchProps, HeroSearchValues } from './hero-search.types';
import { heroHref } from './utils';

const EMPTY: HeroSearchValues = { district: '', brand: '', model: '', maxPrice: '' };

function optionLabel(option: FacetOption): string {
  return HERO_SEARCH_TEXT.optionCount(option.label, option.count);
}

export function HeroSearch({
  locations,
  brands: initialBrands,
  loadFacets = heroFacetsAction,
}: HeroSearchProps) {
  const router = useRouter();
  const ids = useId();
  const [values, setValues] = useState<HeroSearchValues>(EMPTY);
  const [brands, setBrands] = useState(initialBrands);
  const [models, setModels] = useState<FacetOption[]>([]);
  const [loading, startTransition] = useTransition();
  const latest = useRef(0);

  function refresh(district: string, brand: string) {
    latest.current += 1;
    const request = latest.current;
    startTransition(async () => {
      const facets = await loadFacets(district || undefined, brand || undefined);
      if (request !== latest.current) return;
      setBrands(facets.brands);
      setModels(facets.models);
    });
  }

  function chooseDistrict(district: string) {
    setValues((current) => ({ ...current, district }));
    refresh(district, values.brand);
  }

  function chooseBrand(brand: string) {
    setValues((current) => ({ ...current, brand, model: '' }));
    setModels([]);
    refresh(values.district, brand);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(heroHref(values));
  }

  return (
    <form
      action={CARS_PATH}
      method="get"
      role="search"
      aria-label={HERO_SEARCH_TEXT.formLabel}
      onSubmit={submit}
      className="blueprint flex flex-col gap-[12px] bg-white p-[14px]"
    >
      <div className="grid gap-[10px] sm:grid-cols-2 lg:grid-cols-4">
        <HeroDistrict
          id={`${ids}-district`}
          locations={locations}
          value={values.district}
          onChange={chooseDistrict}
        />

        <div className="field m-0">
          <label htmlFor={`${ids}-brand`}>{HERO_SEARCH_TEXT.brand}</label>
          <Select
            id={`${ids}-brand`}
            name="brand"
            className="h-[48px]"
            value={values.brand}
            onChange={(event) => chooseBrand(event.target.value)}
          >
            <option value="">{HERO_SEARCH_TEXT.anyBrand}</option>
            {brands.map((option) => (
              <option key={option.value} value={option.value}>
                {optionLabel(option)}
              </option>
            ))}
          </Select>
        </div>

        <div className="field m-0">
          <label htmlFor={`${ids}-model`}>{HERO_SEARCH_TEXT.model}</label>
          <Select
            id={`${ids}-model`}
            name="model"
            className="h-[48px]"
            value={values.model}
            disabled={!values.brand || (loading && models.length === 0)}
            aria-busy={loading || undefined}
            onChange={(event) =>
              setValues((current) => ({ ...current, model: event.target.value }))
            }
          >
            <option value="">
              {values.brand ? HERO_SEARCH_TEXT.anyModel : HERO_SEARCH_TEXT.chooseBrandFirst}
            </option>
            {models.map((option) => (
              <option key={option.value} value={option.value}>
                {optionLabel(option)}
              </option>
            ))}
          </Select>
        </div>

        <div className="field m-0">
          <label htmlFor={`${ids}-budget`}>{HERO_SEARCH_TEXT.budget}</label>
          <Select
            id={`${ids}-budget`}
            name="maxPrice"
            className="h-[48px]"
            value={values.maxPrice}
            onChange={(event) =>
              setValues((current) => ({ ...current, maxPrice: event.target.value }))
            }
          >
            <option value="">{HERO_SEARCH_TEXT.anyBudget}</option>
            {BUDGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Button type="submit" variant="primary" size="lg" block>
        {HERO_SEARCH_TEXT.submit}
      </Button>
    </form>
  );
}
