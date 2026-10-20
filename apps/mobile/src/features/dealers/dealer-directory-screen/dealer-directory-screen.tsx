import { useInfiniteQuery } from '@tanstack/react-query';
import type { DealerCard as Dealer } from '@dealers-drive/contracts/public';
import {
  csvOf,
  readVehicleSearch,
  toggleCsv,
  setParam,
  pageOf,
} from '@dealers-drive/contracts/vehicle-search';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../../components/action-button';
import { DealerCard } from '../../../components/dealer-card';
import { EmptyState } from '../../../components/empty-state';
import { StatusPanel } from '../../../components/status-panel';
import { TownPills } from '../../../components/town-pills';
import { colors, spacing, typography } from '../../../theme/tokens';
import { useDirectoryLocation } from '../../location/use-directory-location';
import { dealersApi, type DirectoryParams } from '../dealers-api';
import { DEALERS_TEXT } from '../dealers.constants';
import { DealerSearchInput } from '../dealer-search-input';

export function DealerDirectoryScreen() {
  const router = useRouter();
  const route = useLocalSearchParams<Record<string, string | string[]>>();
  const parsed = readVehicleSearch(route);
  const params: DirectoryParams = { district: parsed.district, city: parsed.city, q: parsed.q };
  const locationReady = useDirectoryLocation(params.district);
  const list = useRef<FlatList<Dealer>>(null);
  const apply = (next: DirectoryParams) => {
    router.setParams({ district: next.district, city: next.city, q: next.q, page: undefined });
    list.current?.scrollToOffset({ offset: 0, animated: false });
    Keyboard.dismiss();
  };
  const [search, setSearch] = useState(params.q ?? '');
  useEffect(() => setSearch(params.q ?? ''), [params.q]);
  const initialPage = Math.min(40, pageOf(parsed));
  const query = useInfiniteQuery({
    queryKey: ['public', 'dealers', params, initialPage],
    enabled: locationReady,
    initialPageParam: initialPage,
    queryFn: ({ pageParam, signal }) => dealersApi.directory(params, pageParam, signal),
    getNextPageParam: (last) =>
      last.page.page < Math.min(last.page.totalPages, 40) ? last.page.page + 1 : undefined,
  });
  const first = query.data?.pages[0];
  const data = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.data) ?? []).map((dealer) => [dealer.slug, dealer]),
    ).values(),
  ];
  const submit = () => apply({ ...params, q: search.trim() || undefined });
  return (
    <View style={styles.root}>
      <FlatList<Dealer>
        ref={list}
        data={data}
        keyExtractor={(dealer) => dealer.slug}
        contentContainerStyle={styles.content}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onScrollBeginDrag={Keyboard.dismiss}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => {
          if (locationReady) void query.refetch();
        }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage({ cancelRefetch: false });
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text testID="dealers-title" accessibilityRole="header" style={styles.title}>
              {DEALERS_TEXT.title}
            </Text>
            <Text style={styles.muted}>Find the dealership behind your next car.</Text>
            <DealerSearchInput
              params={params}
              value={search}
              onChange={setSearch}
              onSubmit={submit}
              onSelect={(slug) => router.navigate(`/dealers/${encodeURIComponent(slug)}`)}
            />
            {search.trim() && search.trim() !== params.q ? (
              <ActionButton variant="ghost" label="Search dealer directory" onPress={submit} />
            ) : null}
            {params.district && first ? (
              <TownPills
                options={first.cities.map((city) => ({
                  value: city.slug,
                  label: city.name,
                  count: city.count,
                }))}
                selected={csvOf(parsed, 'city')}
                onToggle={(city) => apply(toggleCsv(params, 'city', city))}
                onClear={() => apply(setParam(params, 'city', undefined))}
              />
            ) : null}
            {first ? (
              <Text accessibilityLiveRegion="polite" style={styles.count}>
                {first.countLabel}
              </Text>
            ) : null}
            {query.isError ? (
              <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <DealerCard
            dealer={item}
            onPress={() => router.navigate(`/dealers/${encodeURIComponent(item.slug)}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          query.isPending ? (
            <StatusPanel pending message={DEALERS_TEXT.loading} />
          ) : !query.isError ? (
            <EmptyState
              title="No dealerships found"
              description="Try another town or remove your search to explore this district."
              action="Clear search and towns"
              onAction={() => {
                setSearch('');
                apply({ district: params.district });
              }}
            />
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <ActionButton
              label={DEALERS_TEXT.loadMore}
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
            />
          ) : null
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: 12, marginBottom: spacing.md },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 28, fontWeight: '800' },
  count: { fontFamily: typography.family, color: colors.ink, fontSize: 14, fontWeight: '600' },
  muted: {
    fontFamily: typography.family,
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});
