import { useQuery } from '@tanstack/react-query';
import {
  PublicVehicleQuery,
  VEHICLE_SORT_LABELS,
  VehicleSort,
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
  type VehicleSearchParams,
  type CsvParamKey,
} from '@dealers-drive/contracts/vehicle-search';
import { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
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
}: {
  params: VehicleSearchParams;
  facets: VehicleFacets;
  locations: PublicLocations | undefined;
  onApply: (next: VehicleSearchParams) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(params);
  const [debounced, setDebounced] = useState(params);
  const [districtSearch, setDistrictSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(draft), 350);
    return () => clearTimeout(timer);
  }, [draft]);
  const preview = useQuery({
    queryKey: ['public', 'cars', 'filter-preview', debounced],
    queryFn: ({ signal }) => carsApi.list(debounced, 1, signal),
    enabled: PublicVehicleQuery.safeParse(debounced).success,
  });
  const choices = preview.data?.facets ?? facets;
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
        <Text accessibilityRole="header" style={styles.heading}>
          {label}
        </Text>
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
          <Text accessibilityRole="header" style={styles.title}>
            {CARS_TEXT.filters}
          </Text>
          <ActionButton variant="ghost" label={CARS_TEXT.close} onPress={onClose} />
          <Text accessibilityRole="header" style={styles.heading}>
            {CARS_TEXT.district}
          </Text>
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
          <AuthField
            label={CARS_TEXT.district}
            value={districtSearch}
            onChangeText={setDistrictSearch}
            placeholder={CARS_TEXT.districtSearch}
          />
          {locations?.districts
            .filter((district) =>
              `${district.name} ${district.state ?? ''}`
                .toLowerCase()
                .includes(districtSearch.toLowerCase()),
            )
            .slice(0, 60)
            .map((district) => (
              <ConsentChoice
                key={district.slug}
                label={`${district.name}${district.state ? `, ${district.state}` : ''}`}
                checked={draft.district === district.slug}
                onChange={() => {
                  const next = { ...draft, district: district.slug };
                  delete next.city;
                  delete next.dealer;
                  delete next.page;
                  setDraft(next);
                }}
              />
            ))}
          <Text accessibilityRole="header" style={styles.heading}>
            {CARS_TEXT.sort}
          </Text>
          {VehicleSort.options.map((sort) => (
            <ConsentChoice
              key={sort}
              label={VEHICLE_SORT_LABELS[sort]}
              checked={(draft.sort ?? 'newest') === sort}
              onChange={() => setDraft(setParam(draft, 'sort', sort))}
            />
          ))}
          {GROUPS.map((group) => (
            <View key={group.key} style={styles.group}>
              <Text accessibilityRole="header" style={styles.heading}>
                {FILTER_LABELS[group.key]}
              </Text>
              {choices[group.facet]
                .filter(
                  (option, index) =>
                    expanded[group.key] ||
                    index < 6 ||
                    csvOf(draft, group.key).includes(option.value),
                )
                .map((option) => (
                  <ConsentChoice
                    key={option.value}
                    label={`${option.label} (${option.count})`}
                    checked={csvOf(draft, group.key).includes(option.value)}
                    onChange={() => choose(group.key, option.value)}
                  />
                ))}
              {choices[group.facet].length > 6 ? (
                <ActionButton
                  label={
                    expanded[group.key]
                      ? CARS_TEXT.showFewer
                      : CARS_TEXT.showAll(choices[group.facet].length)
                  }
                  onPress={() => setExpanded({ ...expanded, [group.key]: !expanded[group.key] })}
                />
              ) : null}
            </View>
          ))}
          <View style={styles.group}>
            <Text accessibilityRole="header" style={styles.heading}>
              {FILTER_LABELS.price}
            </Text>
            <ConsentChoice
              label={CARS_TEXT.anyPrice}
              checked={!draft.minPrice && !draft.maxPrice}
              onChange={() => setDraft(setRange(draft, PRICE_KEYS, null, null))}
            />
            {choices.price.map((band, index) => (
              <ConsentChoice
                key={index}
                label={`${band.label} (${band.count})`}
                checked={
                  rangeOf(draft, PRICE_KEYS).min === band.min &&
                  rangeOf(draft, PRICE_KEYS).max === band.max
                }
                onChange={() => setDraft(setRange(draft, PRICE_KEYS, band.min, band.max))}
              />
            ))}
          </View>
          {range(PRICE_KEYS, CARS_TEXT.customPrice, true)}
          {range(YEAR_KEYS, CARS_TEXT.customYear)}
          <View style={styles.group}>
            <Text accessibilityRole="header" style={styles.heading}>
              {FILTER_LABELS.km}
            </Text>
            {choices.kilometers.map((band, index) => (
              <ConsentChoice
                key={index}
                label={`${band.label} (${band.count})`}
                checked={
                  rangeOf(draft, KM_KEYS).min === band.min &&
                  rangeOf(draft, KM_KEYS).max === band.max
                }
                onChange={() => setDraft(setRange(draft, KM_KEYS, band.min, band.max))}
              />
            ))}
          </View>
          {range(KM_KEYS, CARS_TEXT.customKm)}
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
              preview.data &&
              !preview.isFetching &&
              JSON.stringify(draft) === JSON.stringify(debounced)
                ? CARS_TEXT.resultCount(preview.data.available)
                : CARS_TEXT.apply
            }
            onPress={() => {
              if (!PublicVehicleQuery.safeParse(draft).success) {
                setError(CARS_TEXT.invalidFilter);
                return;
              }
              onApply(draft);
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.md, gap: spacing.md },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderColor: colors.divider },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 26, fontWeight: '800' },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 18, fontWeight: '700' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
  group: { gap: spacing.sm },
  range: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
});
