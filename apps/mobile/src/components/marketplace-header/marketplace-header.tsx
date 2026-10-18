import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { carsApi } from '../../features/cars/cars-api';
import { locationStore, useDistrict } from '../../features/location/location';
import { colors, spacing, typography } from '../../theme/tokens';
import { Brand } from '../brand';
import { Icon } from '../icon';
import { SelectionSheet } from '../selection-sheet';
import { MARKETPLACE_HEADER_TEXT } from './marketplace-header.constants';

export function MarketplaceHeader() {
  const path = usePathname();
  const { width } = useWindowDimensions();
  const discovery = path === '/' || path === '/cars' || path === '/dealers' || path === '/explore';
  const district = useDistrict();
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ['public', 'locations'],
    queryFn: ({ signal }) => carsApi.locations(signal),
    staleTime: 600000,
    enabled: discovery,
  });
  const label =
    query.data?.districts.find((item) => item.slug === district)?.name ??
    (district ? district.replace(/-/g, ' ') : MARKETPLACE_HEADER_TEXT.allDistricts);
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Brand compact={width < 390} />
        {discovery ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`District: ${label}. Change district`}
            accessibilityState={{ expanded: open }}
            onPress={() => setOpen(true)}
            style={styles.pill}
          >
            <Icon name="location" size={17} />
            <Text style={styles.label} numberOfLines={1}>
              {label}
            </Text>
            <Icon name="chevron" size={16} />
          </Pressable>
        ) : null}
      </View>
      {open ? (
        <SelectionSheet
          title={MARKETPLACE_HEADER_TEXT.chooseDistrict}
          searchable
          value={district ?? ''}
          pending={query.isPending}
          error={query.error?.message}
          retry={() => void query.refetch()}
          options={[
            { value: '', label: MARKETPLACE_HEADER_TEXT.allDistricts },
            ...(query.data?.districts.map((item) => ({
              value: item.slug,
              label: item.name,
              description: item.state ?? undefined,
            })) ?? []),
          ]}
          onSelect={(value) => {
            locationStore.choose(value || undefined);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.page,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    minHeight: 48,
    maxWidth: '100%',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 24,
  },
  label: {
    flexShrink: 1,
    fontFamily: typography.family,
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'capitalize',
  },
});
