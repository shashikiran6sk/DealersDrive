import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { VehicleCardDto } from '@dealers-drive/contracts/public';
import { NO_VEHICLE_FACETS } from '@dealers-drive/contracts/public';
import { GoogleMapsUrl, SlugParam } from '@dealers-drive/contracts/common';
import {
  readVehicleSearch,
  setParam,
  type VehicleSearchParams,
} from '@dealers-drive/contracts/vehicle-search';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import cover from '../../../assets/dealer-cover.svg';
import { ActionButton } from '../../../components/action-button';
import { AuthField } from '../../../components/auth-field';
import { CarCard } from '../../../components/car-card';
import { PhotoGallery } from '../../../components/photo-gallery';
import { StatusPanel } from '../../../components/status-panel';
import { colors, spacing, typography } from '../../../theme/tokens';
import { CARS_TEXT } from '../../cars/cars.constants';
import { FilterDialog } from '../../cars/filter-dialog';
import { dealersApi } from '../dealers-api';
import { DEALERS_TEXT } from '../dealers.constants';

export function DealerProfileScreen() {
  const input = useLocalSearchParams<{ slug: string }>();
  const slug = input.slug;
  const router = useRouter();
  const valid = SlugParam.safeParse({ slug }).success;
  const [params, setParams] = useState<VehicleSearchParams>(() =>
    readVehicleSearch(input, 'dealer'),
  );
  const [search, setSearch] = useState(params.q ?? '');
  const [filters, setFilters] = useState(false);
  const profile = useQuery({
    queryKey: ['public', 'dealer', slug],
    queryFn: ({ signal }) => dealersApi.profile(slug, signal),
    enabled: valid,
  });
  const inventory = useInfiniteQuery({
    queryKey: ['public', 'dealer-cars', slug, params],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => dealersApi.inventory(slug, params, pageParam, signal),
    getNextPageParam: (last) =>
      last.page.page < last.page.totalPages ? last.page.page + 1 : undefined,
    enabled: valid,
  });
  const dealer = profile.data;
  const photos = useMemo(
    () =>
      dealer?.portfolio.map((photo, index) => ({
        url: photo.url,
        alt: photo.caption ?? `${dealer.brandName} · ${index + 1}`,
      })) ?? [],
    [dealer?.portfolio, dealer?.brandName],
  );
  const first = inventory.data?.pages[0];
  const cars = [
    ...new Map(
      (inventory.data?.pages.flatMap((page) => page.data) ?? []).map((car) => [car.slug, car]),
    ).values(),
  ];
  const back = () => (router.canGoBack() ? router.back() : router.replace('/dealers'));
  if (!valid || profile.isError || !dealer)
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ActionButton variant="ghost" label={DEALERS_TEXT.back} onPress={back} />
        <StatusPanel
          pending={profile.isPending && valid}
          message={
            !valid ? DEALERS_TEXT.unavailable : (profile.error?.message ?? DEALERS_TEXT.loading)
          }
          retry={profile.isError ? () => void profile.refetch() : undefined}
        />
      </SafeAreaView>
    );
  const maps = GoogleMapsUrl.safeParse(dealer.address.mapsUrl);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <FlatList<VehicleCardDto>
        data={cars}
        keyExtractor={(car) => car.slug}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshing={
          profile.isRefetching || (inventory.isRefetching && !inventory.isFetchingNextPage)
        }
        onRefresh={() => {
          void profile.refetch();
          void inventory.refetch();
        }}
        onEndReached={() => {
          if (inventory.hasNextPage && !inventory.isFetchingNextPage)
            void inventory.fetchNextPage({ cancelRefetch: false });
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ActionButton variant="ghost" label={DEALERS_TEXT.back} onPress={back} />
            <View style={styles.headingRow}>
              <Text style={styles.initials}>{dealer.initials}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {dealer.brandName}
              </Text>
            </View>
            {dealer.isVerified ? <Text style={styles.badge}>{CARS_TEXT.verified}</Text> : null}
            {dealer.tagline ? <Text style={styles.text}>{dealer.tagline}</Text> : null}
            <Text style={styles.muted}>{dealer.address.full}</Text>
            {dealer.portfolio.length ? (
              <PhotoGallery images={photos} title={dealer.brandName} />
            ) : (
              <View>
                <Image
                  source={cover}
                  style={styles.cover}
                  contentFit="cover"
                  accessibilityLabel={DEALERS_TEXT.illustration}
                />
                <Text style={styles.muted}>{DEALERS_TEXT.fallbackNote}</Text>
              </View>
            )}
            <View style={styles.box}>
              <Text accessibilityRole="header" style={styles.heading}>
                {DEALERS_TEXT.details}
              </Text>
              {[...dealer.contact, ...dealer.stats.filter((row) => row.key !== 'location')].map(
                (row) => (
                  <View key={row.key} style={styles.row}>
                    <Text style={styles.muted}>{row.label}</Text>
                    <Text style={styles.value}>{row.value}</Text>
                  </View>
                ),
              )}
              {dealer.services.map((service) => (
                <Text key={service} style={styles.text}>
                  {service}
                </Text>
              ))}
            </View>
            <View style={styles.box}>
              <Text style={styles.text}>{dealer.address.full}</Text>
              {maps.success ? (
                <>
                  <ActionButton
                    variant="secondary"
                    label={DEALERS_TEXT.directions}
                    onPress={() => void Linking.openURL(maps.data).catch(() => undefined)}
                  />
                  <Text style={styles.muted}>{DEALERS_TEXT.mapNotice}</Text>
                </>
              ) : (
                <Text style={styles.muted}>{DEALERS_TEXT.directionsUnavailable}</Text>
              )}
            </View>
            <Text accessibilityRole="header" style={styles.heading}>
              {DEALERS_TEXT.inventory}
            </Text>
            <AuthField
              label={CARS_TEXT.searchLabel}
              placeholder={CARS_TEXT.searchPlaceholder}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              maxLength={120}
              onSubmitEditing={() => setParams(setParam(params, 'q', search.trim() || undefined))}
            />
            <ActionButton
              label={CARS_TEXT.search}
              onPress={() => setParams(setParam(params, 'q', search.trim() || undefined))}
            />
            <ActionButton
              variant="secondary"
              label={DEALERS_TEXT.filterCars}
              onPress={() => setFilters(true)}
            />
            {first ? (
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                {CARS_TEXT.resultCount(first.available)}
              </Text>
            ) : null}
            {inventory.isError ? (
              <StatusPanel
                message={inventory.error.message}
                retry={() => void inventory.refetch()}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CarCard
            car={item}
            onOpen={() => router.navigate({ pathname: '/car/[slug]', params: { slug: item.slug } })}
            onDealer={() => router.navigate(`/dealers/${encodeURIComponent(dealer.slug)}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          <StatusPanel
            pending={inventory.isPending}
            message={
              inventory.isPending
                ? CARS_TEXT.loading
                : inventory.isError
                  ? inventory.error.message
                  : DEALERS_TEXT.noCars
            }
          />
        }
        ListFooterComponent={
          inventory.hasNextPage ? (
            <ActionButton
              label={DEALERS_TEXT.loadMore}
              pending={inventory.isFetchingNextPage}
              onPress={() => void inventory.fetchNextPage({ cancelRefetch: false })}
            />
          ) : null
        }
      />
      {filters ? (
        <FilterDialog
          params={params}
          facets={first?.facets ?? NO_VEHICLE_FACETS}
          locations={undefined}
          scope="dealer"
          cacheScope={slug}
          previewList={(draft, signal) => dealersApi.inventory(slug, draft, 1, signal)}
          onApply={(next) => {
            setParams(next);
            setSearch(next.q ?? '');
            setFilters(false);
          }}
          onClose={() => setFilters(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  initials: {
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    fontFamily: typography.family,
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  title: {
    flex: 1,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 26,
    fontWeight: '800',
  },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 21, fontWeight: '800' },
  text: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: 23,
  },
  muted: { fontFamily: typography.family, color: colors.muted, fontSize: 14, lineHeight: 21 },
  cover: { width: '100%', aspectRatio: 2.5, borderRadius: 16 },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 6,
    borderRadius: 5,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  box: {
    padding: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
  },
});
