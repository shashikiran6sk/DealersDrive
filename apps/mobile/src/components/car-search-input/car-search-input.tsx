import { useQuery } from '@tanstack/react-query';
import type { CarSuggestion } from '@dealers-drive/contracts/public';
import type { VehicleSearchParams } from '@dealers-drive/contracts/vehicle-search';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { carsApi } from '../../features/cars/cars-api';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { colors, spacing, typography } from '../../theme/tokens';
import { AuthField } from '../auth-field';

export function CarSearchInput({
  params,
  value,
  onChange,
  onSubmit,
  onSelect,
}: {
  params: VehicleSearchParams;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSelect: (suggestion: CarSuggestion) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [debounced, setDebounced] = useState(value.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 350);
    return () => clearTimeout(timer);
  }, [value]);
  const query = useQuery({
    queryKey: ['public', 'car-suggestions', params.district, params.city, params.dealer, debounced],
    queryFn: ({ signal }) => carsApi.suggest(params, debounced, signal),
    enabled: focused && debounced.length > 0 && debounced.length <= 120,
  });
  return (
    <View style={styles.root}>
      <AuthField
        label={CARS_TEXT.searchLabel}
        placeholder={CARS_TEXT.searchPlaceholder}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="search"
        maxLength={120}
        onSubmitEditing={() => {
          setFocused(false);
          onSubmit();
        }}
      />
      {focused && query.data?.search === debounced
        ? query.data.data.map((item) => (
            <Pressable
              key={`${item.kind}:${item.brand}:${item.model}:${item.variant}`}
              accessibilityRole="button"
              onPress={() => {
                setFocused(false);
                onSelect(item);
              }}
              style={styles.row}
            >
              <Text style={styles.text}>{item.label}</Text>
              <Text style={styles.meta}>{item.metaLabel}</Text>
            </Pressable>
          ))
        : null}
      {focused && query.isError ? (
        <Text style={styles.meta}>{CARS_TEXT.suggestionsUnavailable}</Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  row: {
    padding: spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
    backgroundColor: colors.page,
  },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15 },
  meta: { fontFamily: typography.family, color: colors.muted, fontSize: 13 },
});
