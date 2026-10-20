import type { VehicleFacets } from '@dealers-drive/contracts/public';
import {
  csvOf,
  setCsv,
  setParam,
  setRange,
  PRICE_KEYS,
  YEAR_KEYS,
  KM_KEYS,
  type CsvParamKey,
  type VehicleSearchParams,
} from '@dealers-drive/contracts/vehicle-search';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../../theme/tokens';
import { Icon } from '../../../components/icon';

const groups: readonly { key: CsvParamKey; facet: keyof VehicleFacets }[] = [
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
export function AppliedFilters({
  params,
  facets,
  onChange,
}: {
  params: VehicleSearchParams;
  facets: VehicleFacets;
  onChange: (params: VehicleSearchParams) => void;
}) {
  const chips: { key: string; label: string; remove: () => VehicleSearchParams }[] = [];
  for (const group of groups)
    for (const value of csvOf(params, group.key)) {
      const option = facets[group.facet].find(
        (option) => 'value' in option && option.value === value,
      );
      chips.push({
        key: `${group.key}:${value}`,
        label: option?.label ?? value.replace(/-/g, ' '),
        remove: () => {
          let next = setCsv(
            params,
            group.key,
            csvOf(params, group.key).filter((item) => item !== value),
          );
          if (group.key === 'brand') {
            const orphans = new Set(
              facets.models.filter((model) => model.parent === value).map((model) => model.value),
            );
            next = setCsv(
              next,
              'model',
              csvOf(next, 'model').filter((model) => !orphans.has(model)),
            );
          }
          return next;
        },
      });
    }
  if (params.q)
    chips.push({ key: 'q', label: params.q, remove: () => setParam(params, 'q', undefined) });
  for (const [keys, label] of [
    [PRICE_KEYS, 'Price'],
    [YEAR_KEYS, 'Year'],
    [KM_KEYS, 'Kilometers'],
  ] as const) {
    if (params[keys[0]] || params[keys[1]])
      chips.push({
        key: label,
        label: `${label}: ${params[keys[0]] ? (keys === PRICE_KEYS ? `₹${(BigInt(params[keys[0]] ?? '0') / 100n).toLocaleString('en-IN')}` : params[keys[0]]) : 'Any'}–${params[keys[1]] ? (keys === PRICE_KEYS ? `₹${(BigInt(params[keys[1]] ?? '0') / 100n).toLocaleString('en-IN')}` : params[keys[1]]) : 'Any'}`,
        remove: () => setRange(params, keys, null, null),
      });
  }
  if (!chips.length) return null;
  return (
    <View style={styles.row}>
      {chips.map((chip) => (
        <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${chip.label} filter`}
          onPress={() => onChange(chip.remove())}
          style={styles.chip}
        >
          <Text style={styles.text}>{chip.label}</Text>
          <Icon name="close" size={15} />
        </Pressable>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 48,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  text: {
    flexShrink: 1,
    fontFamily: typography.family,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
});
