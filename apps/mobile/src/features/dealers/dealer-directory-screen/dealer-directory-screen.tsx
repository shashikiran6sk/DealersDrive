import { readVehicleSearch } from '@dealers-drive/contracts/vehicle-search';
import { useDirectoryLocation } from '../../location/use-directory-location';
import { carsApi } from '../../cars/cars-api';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { DealerCard as Dealer } from '@dealers-drive/contracts/public';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { AuthField } from '../../../components/auth-field';
import { ConsentChoice } from '../../../components/consent-choice';
import { DealerCard } from '../../../components/dealer-card';
import { StatusPanel } from '../../../components/status-panel';
import { colors, spacing, typography } from '../../../theme/tokens';
import { dealersApi, type DirectoryParams } from '../dealers-api';
import { DEALERS_TEXT } from '../dealers.constants';

export function DealerDirectoryScreen() {
  const router = useRouter();
  const route = useLocalSearchParams<Record<string, string | string[]>>();
  const parsed = readVehicleSearch(route);
  const params: DirectoryParams = { district: parsed.district, city: parsed.city, q: parsed.q };
  const locationReady = useDirectoryLocation(params.district);
  const setParams = (next: DirectoryParams) =>
    router.setParams({ district: next.district, city: next.city, q: next.q });
  const [search, setSearch] = useState(params.q ?? '');
  useEffect(() => setSearch(params.q ?? ''), [params.q]);
  const [debounced, setDebounced] = useState('');
  const [focus, setFocus] = useState(false);
  const [location, setLocation] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  const query = useInfiniteQuery({
    queryKey: ['public', 'dealers', params],
    enabled: locationReady,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => dealersApi.directory(params, pageParam, signal),
    getNextPageParam: (last) =>
      last.page.page < Math.min(last.page.totalPages, 40) ? last.page.page + 1 : undefined,
  });
  const suggestions = useQuery({
    queryKey: ['public', 'dealer-suggestions', params.district, params.city, debounced],
    queryFn: ({ signal }) => dealersApi.suggest(params, debounced, signal),
    enabled: focus && debounced.length > 0 && debounced.length <= 120,
  });
  const locations = useQuery({
    queryKey: ['public', 'locations'],
    queryFn: ({ signal }) => carsApi.locations(signal),
    staleTime: 600000,
  });
  const first = query.data?.pages[0];
  const data = [
    ...new Map(
      (query.data?.pages.flatMap((page) => page.data) ?? []).map((dealer) => [dealer.slug, dealer]),
    ).values(),
  ];
  const submit = () => {
    setParams({ ...params, q: search.trim() || undefined });
    setFocus(false);
  };
  return (
    <View style={styles.root}>
      <FlatList<Dealer>
        data={data}
        keyExtractor={(dealer) => dealer.slug}
        contentContainerStyle={styles.content}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => void query.refetch()}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage({ cancelRefetch: false });
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {DEALERS_TEXT.title}
            </Text>
            <AuthField
              label={DEALERS_TEXT.search}
              placeholder={DEALERS_TEXT.searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setFocus(true)}
              onSubmitEditing={submit}
              returnKeyType="search"
              maxLength={120}
            />
            {focus && suggestions.data?.search === debounced
              ? suggestions.data.data.map((item) => (
                  <Pressable
                    key={item.slug}
                    accessibilityRole="button"
                    onPress={() => router.navigate(`/dealers/${encodeURIComponent(item.slug)}`)}
                    style={styles.suggestion}
                  >
                    <Text style={styles.text}>{item.brandName}</Text>
                    <Text style={styles.muted}>{item.metaLabel}</Text>
                  </Pressable>
                ))
              : null}
            <ActionButton label={DEALERS_TEXT.submit} onPress={submit} />
            <ActionButton
              variant="secondary"
              label={DEALERS_TEXT.showLocation}
              onPress={() => setLocation(true)}
            />
            {first ? (
              <Text accessibilityLiveRegion="polite" style={styles.text}>
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
          <StatusPanel
            pending={query.isPending}
            message={
              query.isPending
                ? DEALERS_TEXT.loading
                : query.isError
                  ? query.error.message
                  : DEALERS_TEXT.empty
            }
          />
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
      {location ? (
        <Modal visible animationType="slide" onRequestClose={() => setLocation(false)}>
          <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
            <ScrollView contentContainerStyle={styles.content}>
              <Text style={styles.title}>{DEALERS_TEXT.location}</Text>
              <ActionButton
                variant="ghost"
                label={DEALERS_TEXT.close}
                onPress={() => setLocation(false)}
              />
              <ConsentChoice
                label={DEALERS_TEXT.allDistricts}
                checked={!params.district}
                onChange={() => setParams({ ...params, district: undefined, city: undefined })}
              />
              {locations.data?.districts.map((district) => (
                <ConsentChoice
                  key={district.slug}
                  label={`${district.name}${district.state ? `, ${district.state}` : ''}`}
                  checked={params.district === district.slug}
                  onChange={() =>
                    setParams({ ...params, district: district.slug, city: undefined })
                  }
                />
              ))}
              <ConsentChoice
                label={DEALERS_TEXT.allTowns}
                checked={!params.city}
                onChange={() => setParams({ ...params, city: undefined })}
              />
              {first?.cities.map((city) => (
                <ConsentChoice
                  key={city.slug}
                  label={`${city.name} (${city.count})`}
                  checked={params.city?.split(',').includes(city.slug) ?? false}
                  onChange={() => {
                    const selected = params.city?.split(',') ?? [];
                    const next = selected.includes(city.slug)
                      ? selected.filter((entry) => entry !== city.slug)
                      : [...selected, city.slug];
                    setParams({ ...params, city: next.sort().join(',') || undefined });
                  }}
                />
              ))}
              <ActionButton label={DEALERS_TEXT.apply} onPress={() => setLocation(false)} />
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
  muted: { fontFamily: typography.family, color: colors.muted, fontSize: 13 },
  suggestion: {
    padding: spacing.md,
    minHeight: 48,
    backgroundColor: colors.page,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
