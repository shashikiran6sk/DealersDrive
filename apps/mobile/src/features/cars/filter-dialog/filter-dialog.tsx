import { SelectionSheet } from '../../../components/selection-sheet';
import { Icon } from '../../../components/icon';
import { StatusPanel } from '../../../components/status-panel';
import { useQuery } from '@tanstack/react-query';
import {
  PublicVehicleQuery,
  DealerVehicleQuery,
  type PublicVehiclesResponse,
  type VehicleFacets,
  type PublicLocations,
} from '@dealers-drive/contracts/public';
import {
  csvOf,
  toggleCsv,
  setParam,
  setRange,
  clearFilters,
  rangeOf,
  PRICE_KEYS,
  YEAR_KEYS,
  KM_KEYS,
  setCsv,
  searchHref,
  type VehicleSearchParams,
  type CsvParamKey,
} from '@dealers-drive/contracts/vehicle-search';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { AuthField } from '../../../components/auth-field';
import { ConsentChoice } from '../../../components/consent-choice';
import { colors, spacing, typography } from '../../../theme/tokens';
import { CARS_TEXT, FILTER_LABELS } from '../cars.constants';
import { carsApi } from '../cars-api';

const GROUPS: readonly {
  key: CsvParamKey;
  facet: keyof Pick<
    VehicleFacets,
    | 'cities'
    | 'brands'
    | 'models'
    | 'fuelTypes'
    | 'transmissions'
    | 'bodyTypes'
    | 'colors'
    | 'ownerCounts'
    | 'dealers'
  >;
}[] = [
  { key: 'city', facet: 'cities' },
  { key: 'brand', facet: 'brands' },
  { key: 'model', facet: 'models' },
  { key: 'fuel', facet: 'fuelTypes' },
  { key: 'transmission', facet: 'transmissions' },
  { key: 'bodyType', facet: 'bodyTypes' },
  { key: 'color', facet: 'colors' },
  { key: 'owners', facet: 'ownerCounts' },
  { key: 'dealer', facet: 'dealers' },
];
export function FilterDialog({
  params,
  facets,
  locations,
  onApply,
  onClose,
  scope = 'marketplace',
  cacheScope = 'marketplace',
  previewList,
}: {
  params: VehicleSearchParams;
  facets: VehicleFacets;
  locations: PublicLocations | undefined;
  onApply: (next: VehicleSearchParams) => void;
  onClose: () => void;
  scope?: 'marketplace' | 'dealer';
  cacheScope?: string;
  previewList?: (
    params: VehicleSearchParams,
    signal: AbortSignal,
  ) => Promise<PublicVehiclesResponse>;
}) {
  const [draft, setDraft] = useState(params);
  const [debounced, setDebounced] = useState(params);
  const [districtOpen, setDistrictOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ city: true, brand: true });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft), 350);
    return () => clearTimeout(timer);
  }, [draft]);
  const preview = useQuery({
    queryKey: ['public', 'cars', 'filter-preview', cacheScope, debounced],
    queryFn: ({ signal }) =>
      previewList ? previewList(debounced, signal) : carsApi.list(debounced, 1, signal),
    enabled: (scope === 'dealer' ? DealerVehicleQuery : PublicVehicleQuery).safeParse(debounced)
      .success,
  });
  const matchesDraft = searchHref('', draft) === searchHref('', debounced);
  const verified = matchesDraft && preview.isSuccess && !preview.isFetching;
  const baseChoices = matchesDraft && preview.data ? preview.data.facets : facets;
  const choices = {
    ...baseChoices,
    cities:
      draft.district === (matchesDraft && preview.data ? debounced.district : params.district)
        ? baseChoices.cities
        : [],
    dealers:
      draft.district === (matchesDraft && preview.data ? debounced.district : params.district)
        ? baseChoices.dealers
        : [],
    models:
      draft.brand === (matchesDraft && preview.data ? debounced.brand : params.brand)
        ? baseChoices.models
        : [],
  };
  const choose = (key: CsvParamKey, value: string) => {
    let next = toggleCsv(draft, key, value);
    if (key === 'brand' && !csvOf(next, 'brand').includes(value)) {
      const orphaned = new Set(
        choices.models.filter((model) => model.parent === value).map((model) => model.value),
      );
      next = setCsv(
        next,
        'model',
        csvOf(next, 'model').filter((model) => !orphaned.has(model)),
      );
    }
    setDraft(next);
  };
  const range = (
    keys:
      | readonly ['minPrice', 'maxPrice']
      | readonly ['minYear', 'maxYear']
      | readonly ['minKm', 'maxKm'],
    label: string,
    paise = false,
  ) => {
    const current = rangeOf(draft, keys);
    const input = (value: string, min: boolean) => {
      const digits = value.replace(/\D/g, '');
      let converted: string | undefined;
      if (digits) {
        const amount = BigInt(digits) * (paise ? 100n : 1n);
        if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
          setError(CARS_TEXT.invalidFilter);
          return;
        }
        converted = String(amount);
      }
      setError(null);
      setDraft(setParam(draft, min ? keys[0] : keys[1], converted));
    };
    return (
      <View key={label} style={styles.group}>
        <View style={styles.range}>
          <View style={styles.half}>
            <AuthField
              label={`${label} ${CARS_TEXT.rangeMin}`}
              value={
                current.min === null
                  ? ''
                  : String(paise ? Math.trunc(current.min / 100) : current.min)
              }
              keyboardType="number-pad"
              maxLength={15}
              onChangeText={(value) => input(value, true)}
            />
          </View>
          <View style={styles.half}>
            <AuthField
              label={`${label} ${CARS_TEXT.rangeMax}`}
              value={
                current.max === null
                  ? ''
                  : String(paise ? Math.trunc(current.max / 100) : current.max)
              }
              keyboardType="number-pad"
              maxLength={15}
              onChangeText={(value) => input(value, false)}
            />
          </View>
        </View>
      </View>
    );
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.headingRow}>
            <Text accessibilityRole="header" style={styles.title}>
              {CARS_TEXT.filters}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={CARS_TEXT.close}
              style={styles.close}
              onPress={onClose}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          {scope === 'marketplace' ? (
            <>
              <Text accessibilityRole="header" style={styles.heading}>
                {CARS_TEXT.district}
              </Text>
              {!locations ? (
                <ConsentChoice
                  label={CARS_TEXT.allDistricts}
                  checked={!draft.district}
                  onChange={() => {
                    const next = { ...draft };
                    delete next.district;
                    delete next.city;
                    delete next.dealer;
                    delete next.page;
                    setDraft(next);
                  }}
                />
              ) : null}
              {locations ? (
                <Pressable
                  accessibilityRole="button"
                  style={styles.location}
                  onPress={() => setDistrictOpen(true)}
                >
                  <Text style={styles.text}>
                    {locations.districts.find((item) => item.slug === draft.district)?.name ??
                      CARS_TEXT.district}
                  </Text>
                  <Icon name="chevron" />
                </Pressable>
              ) : null}
            </>
          ) : null}
          {GROUPS.filter(
            (group) =>
              (scope === 'marketplace' || (group.key !== 'city' && group.key !== 'dealer')) &&
              choices[group.facet].length > 0,
          ).map((group) => (
            <View key={group.key} style={styles.group}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={FILTER_LABELS[group.key]}
                accessibilityState={{ expanded: Boolean(expanded[group.key]) }}
                onPress={() => setExpanded({ ...expanded, [group.key]: !expanded[group.key] })}
                style={styles.groupHeading}
              >
                <Text style={styles.heading}>
                  {FILTER_LABELS[group.key]}
                  {csvOf(draft, group.key).length ? ` (${csvOf(draft, group.key).length})` : ''}
                </Text>
                <Icon name="chevron" size={18} />
              </Pressable>
              {choices[group.facet]
                .filter(() => expanded[group.key])
                .map((option) => (
                  <ConsentChoice
                    key={option.value}
                    label={verified ? `${option.label} (${option.count})` : option.label}
                    checked={csvOf(draft, group.key).includes(option.value)}
                    onChange={() => choose(group.key, option.value)}
                  />
                ))}
            </View>
          ))}
          <View style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Price"
              accessibilityState={{ expanded: Boolean(expanded.price) }}
              onPress={() => setExpanded({ ...expanded, price: !expanded.price })}
              style={styles.groupHeading}
            >
              <Text style={styles.heading}>Price</Text>
              <Icon name="chevron" size={18} />
            </Pressable>
            {expanded.price ? (
              <>
                <ConsentChoice
                  label={CARS_TEXT.anyPrice}
                  checked={!draft.minPrice && !draft.maxPrice}
                  onChange={() => setDraft(setRange(draft, PRICE_KEYS, null, null))}
                />
                {choices.price.map((band, index) => (
                  <ConsentChoice
                    key={index}
                    label={verified ? `${band.label} (${band.count})` : band.label}
                    checked={
                      rangeOf(draft, PRICE_KEYS).min === band.min &&
                      rangeOf(draft, PRICE_KEYS).max === band.max
                    }
                    onChange={() => setDraft(setRange(draft, PRICE_KEYS, band.min, band.max))}
                  />
                ))}
                {range(PRICE_KEYS, CARS_TEXT.customPrice, true)}
              </>
            ) : null}
          </View>
          <View style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manufacturing year"
              accessibilityState={{ expanded: Boolean(expanded.year) }}
              onPress={() => setExpanded({ ...expanded, year: !expanded.year })}
              style={styles.groupHeading}
            >
              <Text style={styles.heading}>Manufacturing year</Text>
              <Icon name="chevron" size={18} />
            </Pressable>
            {expanded.year ? range(YEAR_KEYS, CARS_TEXT.customYear) : null}
          </View>
          <View style={styles.group}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kilometers driven"
              accessibilityState={{ expanded: Boolean(expanded.km) }}
              onPress={() => setExpanded({ ...expanded, km: !expanded.km })}
              style={styles.groupHeading}
            >
              <Text style={styles.heading}>Kilometers driven</Text>
              <Icon name="chevron" size={18} />
            </Pressable>
            {expanded.km ? (
              <>
                {choices.kilometers.map((band, index) => (
                  <ConsentChoice
                    key={index}
                    label={verified ? `${band.label} (${band.count})` : band.label}
                    checked={
                      rangeOf(draft, KM_KEYS).min === band.min &&
                      rangeOf(draft, KM_KEYS).max === band.max
                    }
                    onChange={() => setDraft(setRange(draft, KM_KEYS, band.min, band.max))}
                  />
                ))}
                {range(KM_KEYS, CARS_TEXT.customKm)}
              </>
            ) : null}
          </View>
          {preview.isError ? (
            <StatusPanel
              message="Filter options could not refresh. You can still apply your selection."
              retry={() => void preview.refetch()}
            />
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={styles.text}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <ActionButton
            variant="ghost"
            label={CARS_TEXT.reset}
            onPress={() => setDraft(clearFilters(draft))}
          />
          <ActionButton
            label={
              preview.data && verified
                ? CARS_TEXT.resultCount(preview.data.available)
                : CARS_TEXT.apply
            }
            onPress={() => {
              if (
                !(scope === 'dealer' ? DealerVehicleQuery : PublicVehicleQuery).safeParse(draft)
                  .success
              ) {
                setError(CARS_TEXT.invalidFilter);
                return;
              }
              onApply(draft);
            }}
          />
        </View>
        {districtOpen ? (
          <SelectionSheet
            title="Choose district"
            searchable
            value={draft.district ?? ''}
            options={[
              { value: '', label: CARS_TEXT.allDistricts },
              ...(locations?.districts.map((item) => ({
                value: item.slug,
                label: item.name,
                description: item.state ?? undefined,
              })) ?? []),
            ]}
            onClose={() => setDistrictOpen(false)}
            onSelect={(value) => {
              const next = setParam(draft, 'district', value || undefined);
              delete next.city;
              delete next.dealer;
              setDraft(next);
              setDistrictOpen(false);
            }}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'center' },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
  },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  content: { padding: spacing.md, gap: spacing.md },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderColor: colors.divider },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 26, fontWeight: '800' },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 18, fontWeight: '700' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
  group: { gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8 },
  range: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
