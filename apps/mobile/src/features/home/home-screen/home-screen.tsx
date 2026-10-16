import { useQueries, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import hero from '../../../assets/home-hero.webp';
import { ActionButton } from '../../../components/action-button';
import { CarSearchInput } from '../../../components/car-search-input';
import { CarCardSkeleton } from '../../../components/car-card';
import { StatusPanel } from '../../../components/status-panel';
import { colors, spacing, typography } from '../../../theme/tokens';
import { dealersApi } from '../../dealers/dealers-api';
import { suggestionParams } from '../../cars/suggestion-params';
import { locationStore, useDistrict, useLocationReady } from '../../location/location';
import { DISCOVERY_SECTIONS, HERO_ALT, HOME_TEXT } from '../home.constants';
import { loadHomeSection } from '../load-home-section';
import { InventoryRow } from '../inventory-row';

export function HomeScreen() {
  const router = useRouter();
  const district = useDistrict();
  const ready = useLocationReady();
  const [search, setSearch] = useState('');
  const [heroFailed, setHeroFailed] = useState(false);
  const config = useQuery({
    queryKey: ['public', 'config'],
    queryFn: ({ signal }) => dealersApi.config(signal),
    staleTime: 600000,
  });
  const rows = useQueries({
    queries: DISCOVERY_SECTIONS.map((section) => ({
      queryKey: ['public', 'home', district, section.key],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        loadHomeSection({ ...section.params, district }, signal),
      enabled: ready,
    })),
  });
  const hasCars = rows.some((row) => Boolean(row.data?.data.length));
  const settled = rows.every((row) => !row.isPending);
  const empty = settled && !hasCars && rows[0]?.data?.available === 0;
  const failed = rows.some((row) => row.isError);
  const retry = () =>
    rows.forEach((row) => {
      if (row.isError) void row.refetch();
    });
  const browse = (params = {}) =>
    router.navigate({ pathname: '/cars', params: { ...params, district } });
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScrollBeginDrag={Keyboard.dismiss}
    >
      <View style={styles.hero}>
        <Image
          source={config.data?.heroImage && !heroFailed ? { uri: config.data.heroImage.src } : hero}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={config.data?.heroImage?.alt ?? HERO_ALT}
          onError={() => setHeroFailed(true)}
        />
        <View style={styles.overlay} />
        <View style={styles.heroContent}>
          <Text style={styles.eyebrow}>LOCAL DEALERSHIPS. YOUR NEXT CAR.</Text>
          <Text testID="home-title" accessibilityRole="header" style={styles.title}>
            {HOME_TEXT.title}
          </Text>
          <Text style={styles.lede}>
            Find used cars nearby. Compare your options and speak directly to the dealership.
          </Text>
          <CarSearchInput
            params={{ district }}
            value={search}
            onChange={setSearch}
            onSelect={(suggestion) => browse(suggestionParams({ district }, suggestion))}
          />
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => browse()} style={styles.primary}>
              <Text style={styles.primaryText}>Explore cars →</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate({ pathname: '/dealers', params: { district } })}
              style={styles.secondary}
            >
              <Text style={styles.secondaryText}>Find dealers</Text>
            </Pressable>
          </View>
        </View>
      </View>
      {empty ? (
        <View style={styles.empty}>
          <Text accessibilityRole="header" style={styles.heading}>
            {district ? 'No cars available in this district' : 'New cars will appear here'}
          </Text>
          <Text style={styles.text}>
            Explore local dealerships, or choose another district to see available cars.
          </Text>
          <ActionButton
            label="Browse dealers"
            onPress={() => router.navigate({ pathname: '/dealers', params: { district } })}
          />
          {district ? (
            <ActionButton
              variant="secondary"
              label="Browse all districts"
              onPress={() => {
                locationStore.choose(undefined);
                router.navigate('/cars');
              }}
            />
          ) : null}
        </View>
      ) : null}
      {rows.map((row, index) => {
        const section = DISCOVERY_SECTIONS[index];
        if (!section || !row.data?.data.length) return null;
        return (
          <InventoryRow
            key={section.key}
            title={section.title}
            cars={row.data.data}
            onBrowse={() => browse(section.params)}
          />
        );
      })}
      {!hasCars && !settled ? (
        <View testID="home-inventory-loading" style={styles.empty}>
          <CarCardSkeleton />
        </View>
      ) : null}
      {failed && !empty ? (
        <StatusPanel
          message={
            hasCars
              ? 'Some selections could not load. Your available cars are shown above.'
              : 'We couldn’t load cars right now.'
          }
          retry={retry}
        />
      ) : null}
      {settled && !hasCars && !empty && !failed ? (
        <View style={styles.empty}>
          <Text style={styles.text}>Browse the full selection to see available cars.</Text>
          <ActionButton label="Explore cars" onPress={() => browse()} />
        </View>
      ) : null}
      <View style={styles.trust}>
        <Text style={styles.kicker}>SHOP WITH CLARITY</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          Know who you’re buying from.
        </Text>
        <Text style={styles.text}>
          Look for Dealer Verified for reviewed business details. Confirm the car’s documents and
          condition with the dealership.
        </Text>
        <View style={styles.rule} />
        <Text style={styles.trustPoint}>Dealer-set prices · Direct conversations</Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { paddingBottom: spacing.xl },
  hero: { backgroundColor: colors.accent },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.70)',
  },
  heroContent: { padding: 20, gap: 12 },
  eyebrow: {
    fontFamily: typography.family,
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: typography.family,
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 39,
  },
  lede: {
    fontFamily: typography.family,
    color: '#efefec',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  actions: { flexDirection: 'row', gap: 10 },
  primary: {
    flex: 1,
    backgroundColor: colors.page,
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
  },
  secondary: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ffffff66',
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: typography.family,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  empty: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 16,
    gap: 12,
  },
  trust: {
    margin: spacing.md,
    marginTop: spacing.xl,
    padding: 20,
    gap: 12,
    backgroundColor: colors.background,
    borderRadius: 18,
  },
  kicker: {
    fontFamily: typography.family,
    fontSize: 10,
    fontWeight: '800',
    color: colors.muted,
    letterSpacing: 1.3,
  },
  heading: { fontFamily: typography.family, fontSize: 23, fontWeight: '800', color: colors.ink },
  text: {
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '500',
    color: colors.muted,
    lineHeight: 23,
  },
  rule: { height: 1, backgroundColor: colors.divider },
  trustPoint: { fontFamily: typography.family, fontSize: 13, fontWeight: '700', color: colors.ink },
});
