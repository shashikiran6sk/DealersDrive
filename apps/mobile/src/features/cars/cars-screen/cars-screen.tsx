import { useDirectoryLocation } from '../../location/use-directory-location';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { NO_VEHICLE_FACETS, type VehicleCardDto } from '@dealers-drive/contracts/public';
import {
  readVehicleSearch,
  setParam,
  clearFilters,
  activeFilterCount,
  pageOf,
  type VehicleSearchParams,
  VEHICLE_PARAM_ORDER,
} from '@dealers-drive/contracts/vehicle-search';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../../components/action-button';
import { CarSearchInput } from '../../../components/car-search-input';
import { CarCard, CarCardSkeleton } from '../../../components/car-card';
import { StatusPanel } from '../../../components/status-panel';
import { colors, spacing, typography } from '../../../theme/tokens';
import { carsApi } from '../cars-api';
import { CARS_TEXT } from '../cars.constants';
import { FilterDialog } from '../filter-dialog';

export function CarsScreen() {
  const initial = useLocalSearchParams<Record<string, string | string[]>>();
  const router = useRouter();
  const params = readVehicleSearch(initial);
  const locationReady = useDirectoryLocation(params.district);
  const [search, setSearch] = useState(params.q ?? '');
  const [filters, setFilters] = useState(false);
  const list = useRef<FlatList<VehicleCardDto>>(null);
  const signature = JSON.stringify(initial);
  useEffect(() => {
    const next = readVehicleSearch(initial);
    setSearch(next.q ?? '');
  }, [signature]);

  const query = useInfiniteQuery({
    queryKey: ['public', 'cars', params],
    enabled: locationReady,
    initialPageParam: pageOf(params),
    queryFn: ({ pageParam, signal }) => carsApi.list(params, pageParam, signal),
    getNextPageParam: (last) =>
      last.page.page < last.page.totalPages ? last.page.page + 1 : undefined,
  });
  const locations = useQuery({
    queryKey: ['public', 'locations'],
    queryFn: ({ signal }) => carsApi.locations(signal),
    staleTime: 600_000,
  });

  const first = query.data?.pages[0];
  const cards = query.data?.pages.flatMap((page) => page.data) ?? [];
  const unique = [...new Map(cards.map((car) => [car.slug, car])).values()];
  const apply = (next: VehicleSearchParams) => {
    const patch = Object.fromEntries(VEHICLE_PARAM_ORDER.map((key) => [key, next[key]]));
    router.setParams(patch);
    setSearch(next.q ?? '');
    setFilters(false);
    list.current?.scrollToOffset({ offset: 0, animated: false });
    Keyboard.dismiss();
  };
  const submit = () => apply(setParam(params, 'q', search.trim() || undefined));
  return (
    <View style={styles.root}>
      <FlatList<VehicleCardDto>
        ref={list}
        data={unique}
        keyExtractor={(car) => car.slug}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage({ cancelRefetch: false });
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {CARS_TEXT.title}
            </Text>
            <CarSearchInput
              params={params}
              value={search}
              onChange={setSearch}
              onSubmit={submit}
              onSelect={(suggestion) => {
                let next = setParam(params, 'brand', suggestion.brand);
                next = setParam(next, 'model', suggestion.model ?? undefined);
                apply(setParam(next, 'q', suggestion.variant ?? undefined));
              }}
            />
            <View style={styles.tools}>
              <View style={styles.half}>
                <ActionButton label={CARS_TEXT.search} onPress={submit} />
              </View>
              <View style={styles.half}>
                <ActionButton
                  variant="secondary"
                  label={`${CARS_TEXT.filters}${activeFilterCount(params) ? ` (${activeFilterCount(params)})` : ''}`}
                  onPress={() => setFilters(true)}
                />
              </View>
            </View>
            <ActionButton
              variant="ghost"
              label={CARS_TEXT.dealerDirectory}
              onPress={() => router.navigate('/dealers')}
            />
            {first ? (
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                {CARS_TEXT.resultCount(first.available)}
              </Text>
            ) : null}
            {params.district ? (
              <Text style={styles.muted}>
                {locations.data?.districts.find((district) => district.slug === params.district)
                  ?.name ?? params.district}
              </Text>
            ) : null}
            {query.isError ? (
              <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.isPending ? (
            <View>
              <CarCardSkeleton />
              <CarCardSkeleton />
              <CarCardSkeleton />
            </View>
          ) : !query.isError ? (
            <View style={styles.header}>
              <Text style={styles.text}>{CARS_TEXT.empty}</Text>
              <Text style={styles.muted}>{CARS_TEXT.emptyHint}</Text>
              <ActionButton label={CARS_TEXT.reset} onPress={() => apply(clearFilters(params))} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <CarCard
            car={item}
            onOpen={() => router.navigate({ pathname: '/car/[slug]', params: { slug: item.slug } })}
            onDealer={() => router.navigate(`/dealers/${encodeURIComponent(item.dealer.slug)}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListFooterComponent={
          query.hasNextPage ? (
            <ActionButton
              label={CARS_TEXT.loadMore}
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
            />
          ) : null
        }
      />
      {filters ? (
        <FilterDialog
          params={params}
          facets={first?.facets ?? NO_VEHICLE_FACETS}
          locations={locations.data}
          onApply={apply}
          onClose={() => setFilters(false)}
        />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 26, fontWeight: '800' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
  muted: { fontFamily: typography.family, color: colors.muted, fontSize: 14 },
  suggestion: {
    backgroundColor: colors.page,
    padding: spacing.md,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 8,
  },
  tools: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  separator: { height: spacing.md },
});
