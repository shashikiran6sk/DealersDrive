import { setParam } from '@dealers-drive/contracts/vehicle-search';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { VehicleCardDto } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import hero from '../../../assets/home-hero.webp';
import { ActionButton } from '../../../components/action-button';
import { CarSearchInput } from '../../../components/car-search-input';
import { CarCard, CarCardSkeleton } from '../../../components/car-card';
import { StatusPanel } from '../../../components/status-panel';
import { colors, spacing, typography } from '../../../theme/tokens';
import { dealersApi } from '../../dealers/dealers-api';
import {
  HOME_TEXT,
  DISCOVERY_SECTIONS,
  HOME_FLOW,
  JOURNEY_STEPS,
  JOURNEY_TEXT,
  TRUST_POINTS,
  TRUST_TEXT,
  HERO_ALT,
  BUYER_INFO,
} from '../home.constants';

export function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [heroFailed, setHeroFailed] = useState(false);
  const config = useQuery({
    queryKey: ['public', 'config'],
    queryFn: ({ signal }) => dealersApi.config(signal),
    staleTime: 600000,
  });
  const rows = useQueries({
    queries: DISCOVERY_SECTIONS.map((section) => ({
      queryKey: ['public', 'home', section.key],
      queryFn: ({ signal }: { signal: AbortSignal }) => dealersApi.home(section.params, signal),
    })),
  });
  const browse = (params: (typeof DISCOVERY_SECTIONS)[number]['params']) =>
    router.navigate({ pathname: '/(tabs)/explore', params });
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
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
          <Text style={styles.eyebrow}>{HOME_TEXT.eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {HOME_TEXT.title}
          </Text>
          <Text style={styles.lede}>{HOME_TEXT.lede}</Text>
          <View style={styles.search}>
            <CarSearchInput
              params={{}}
              value={search}
              onChange={setSearch}
              onSubmit={() => browse({ q: search.trim() || undefined })}
              onSelect={(suggestion) => {
                let params = setParam({}, 'brand', suggestion.brand);
                params = setParam(params, 'model', suggestion.model ?? undefined);
                browse(setParam(params, 'q', suggestion.variant ?? undefined));
              }}
            />

            <ActionButton
              label={HOME_TEXT.browseAll}
              onPress={() => browse({ q: search.trim() || undefined })}
            />
            <ActionButton
              variant="secondary"
              label={HOME_TEXT.browseDealers}
              onPress={() => router.navigate('/dealers')}
            />
          </View>
        </View>
      </View>
      {HOME_FLOW.map((flow) => {
        if (flow.kind === 'info') {
          if (flow.key === 'audience')
            return (
              <View key={flow.key} style={styles.section}>
                <Text style={styles.smallEyebrow}>{BUYER_INFO.eyebrow}</Text>
                <Text accessibilityRole="header" style={styles.heading}>
                  {BUYER_INFO.title}
                </Text>
                <Text style={styles.text}>{BUYER_INFO.body}</Text>
                <Text style={styles.pointTitle}>{BUYER_INFO.buyerTitle}</Text>
                <Text style={styles.text}>{BUYER_INFO.buyerBody}</Text>
                <ActionButton
                  variant="secondary"
                  label={BUYER_INFO.link}
                  onPress={() => router.navigate('/dealers')}
                />
              </View>
            );
          const info = flow.key === 'journey' ? JOURNEY_TEXT : TRUST_TEXT;
          const points = flow.key === 'journey' ? JOURNEY_STEPS : TRUST_POINTS;
          return (
            <View key={flow.key} style={styles.section}>
              <Text style={styles.smallEyebrow}>{info.eyebrow}</Text>
              <Text accessibilityRole="header" style={styles.heading}>
                {info.title}
              </Text>
              {points.map((point) => (
                <View key={point.number} style={styles.point}>
                  <Text style={styles.pointTitle}>{point.title}</Text>
                  <Text style={styles.text}>{point.body}</Text>
                </View>
              ))}
            </View>
          );
        }
        const index = DISCOVERY_SECTIONS.findIndex((section) => section.key === flow.key);
        const section = DISCOVERY_SECTIONS[index];
        const query = rows[index];
        if (!section || !query) return null;
        const cars = query.data?.data.filter((car) => car.availability === 'AVAILABLE') ?? [];
        return (
          <View key={section.key} style={styles.section}>
            <View style={styles.headingRow}>
              <Text accessibilityRole="header" style={styles.heading}>
                {section.title}
              </Text>
              <ActionButton
                variant="ghost"
                label={HOME_TEXT.viewAll}
                onPress={() => browse(section.params)}
              />
            </View>
            {query.isError ? (
              <StatusPanel
                message={HOME_TEXT.unavailableMessage}
                retry={() => void query.refetch()}
              />
            ) : null}
            {query.isPending ? (
              <CarCardSkeleton />
            ) : !query.isError && cars.length === 0 ? (
              <Text style={styles.text}>{HOME_TEXT.noCars}</Text>
            ) : null}
            <FlatList<VehicleCardDto>
              horizontal
              data={cars}
              keyExtractor={(car) => car.slug}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ width: spacing.md }} />}
              renderItem={({ item }) => (
                <View style={styles.tile}>
                  <CarCard
                    car={item}
                    onOpen={() =>
                      router.navigate({ pathname: '/car/[slug]', params: { slug: item.slug } })
                    }
                    onDealer={() =>
                      router.navigate(`/dealers/${encodeURIComponent(item.dealer.slug)}`)
                    }
                  />
                </View>
              )}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { paddingBottom: spacing.xl },
  hero: { minHeight: 560, backgroundColor: colors.accent },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  heroContent: { padding: spacing.lg, gap: spacing.md },
  eyebrow: {
    fontFamily: typography.family,
    color: '#ffffff',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.family,
    color: '#ffffff',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 43,
    maxWidth: 300,
  },
  lede: { fontFamily: typography.family, color: '#ffffff', fontSize: 15, lineHeight: 26 },
  search: { backgroundColor: colors.page, borderRadius: 16, padding: spacing.md, gap: spacing.sm },
  section: { padding: spacing.md, paddingTop: spacing.lg, gap: spacing.md },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  heading: {
    flex: 1,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  point: { paddingVertical: spacing.sm, gap: spacing.sm },
  pointTitle: { fontFamily: typography.family, color: colors.ink, fontSize: 17, fontWeight: '700' },
  text: { fontFamily: typography.family, color: colors.muted, fontSize: 15, lineHeight: 24 },
  smallEyebrow: {
    fontFamily: typography.family,
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  tile: { width: 275 },
});
