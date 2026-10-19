import { SaveButton } from '../../../components/save-button';
import { ENQUIRY_TEXT } from '../../enquiries/enquiries.constants';
import { useQuery } from '@tanstack/react-query';
import { titleWithoutYear, VehicleSlugParam } from '@dealers-drive/contracts/public';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { CarCard } from '../../../components/car-card';
import { Page } from '../../../components/page';
import { PhotoGallery } from '../../../components/photo-gallery';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { publicEnvironment } from '../../../services/environment';
import { colors, spacing, typography } from '../../../theme/tokens';
import { useAuth } from '../../auth/auth-provider';
import { carsApi } from '../cars-api';
import { CARS_TEXT } from '../cars.constants';

export function CarDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { manager } = useAuth();
  const valid = VehicleSlugParam.safeParse({ slug }).success;
  const query = useQuery({
    queryKey: ['public', 'car', slug],
    queryFn: ({ signal }) => carsApi.detail(slug, signal),
    enabled: valid,
  });
  const similar = useQuery({
    queryKey: ['public', 'similar', slug],
    queryFn: ({ signal }) => carsApi.similar(slug, signal),
    enabled: valid,
  });
  const missing = !valid || (query.error instanceof ApiError && query.error.status === 404);
  useEffect(() => {
    if (!missing) return;
    const pending = manager.pending.peek();
    if (pending && pending.intent.kind !== 'saved' && pending.intent.slug === slug)
      manager.pending.clear();
  }, [missing, manager, slug]);
  const car = query.data;
  if (missing || !car)
    return (
      <SafeAreaView style={styles.root} edges={['bottom']}>
        <Page title={missing ? CARS_TEXT.unavailable : CARS_TEXT.loading}>
          <StatusPanel
            pending={query.isPending && !missing}
            message={missing ? CARS_TEXT.unavailable : (query.error?.message ?? CARS_TEXT.loading)}
            retry={!missing && query.isError ? () => void query.refetch() : undefined}
          />
        </Page>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Page
        title={titleWithoutYear(car)}
        description={car.summary}
        header={
          <View style={{ gap: spacing.md }}>
            <PhotoGallery images={car.images} primaryIndex={car.primaryIndex} title={car.title} />
            {car.year ? <Text style={styles.plate}>{car.year}</Text> : null}
          </View>
        }
      >
        {car.publishedLabel ? <Text style={styles.muted}>{car.publishedLabel}</Text> : null}
        <View style={styles.box}>
          <Text style={styles.eyebrow}>{CARS_TEXT.dealerPrice}</Text>
          <Text style={styles.price}>{car.priceLabel ?? CARS_TEXT.priceRequest}</Text>
          {car.negotiabilityLabel ? (
            <Text style={styles.muted}>{car.negotiabilityLabel}</Text>
          ) : null}
        </View>
        <SaveButton slug={car.slug} title={car.title} labelled />
        {car.availability === 'AVAILABLE' ? (
          <ActionButton
            label={ENQUIRY_TEXT.enquire}
            onPress={() => router.navigate(`/enquire/${encodeURIComponent(car.slug)}`)}
          />
        ) : null}
        {car.availability === 'RESERVED' ? (
          <View style={styles.box}>
            <Text accessibilityRole="header" style={styles.heading}>
              {CARS_TEXT.reserved}
            </Text>
            <Text style={styles.text}>{CARS_TEXT.reservedBody}</Text>
          </View>
        ) : null}
        <ActionButton
          variant="secondary"
          label={CARS_TEXT.share}
          onPress={() =>
            void Share.share({
              message: `${car.title}\n${new URL(`/car/${encodeURIComponent(car.slug)}`, publicEnvironment().webBaseUrl).href}`,
            }).catch(() => undefined)
          }
        />
        <Text accessibilityRole="header" style={styles.heading}>
          {CARS_TEXT.details}
        </Text>
        <View style={styles.specs}>
          {car.specs.map((spec, index) => (
            <View key={`${spec.label}:${index}`} style={styles.spec}>
              <Text style={styles.muted}>{spec.label}</Text>
              <Text style={styles.value}>{spec.value}</Text>
            </View>
          ))}
        </View>
        {car.description ? (
          <>
            <Text accessibilityRole="header" style={styles.heading}>
              {CARS_TEXT.description}
            </Text>
            <Text style={styles.text}>{car.description}</Text>
          </>
        ) : null}
        <View style={styles.box}>
          <Text style={styles.eyebrow}>{CARS_TEXT.soldBy}</Text>
          <Text accessibilityRole="header" style={styles.heading}>
            {car.dealer.name}
          </Text>
          {car.dealer.location ? <Text style={styles.muted}>{car.dealer.location}</Text> : null}
          {car.dealer.isVerified ? <Text style={styles.plate}>{CARS_TEXT.verified}</Text> : null}
          <Text style={styles.muted}>
            {car.dealer.isVerified ? CARS_TEXT.trust : CARS_TEXT.dealerCheck}
          </Text>
          <ActionButton
            variant="secondary"
            label={CARS_TEXT.viewDealer}
            onPress={() => router.navigate(`/dealers/${encodeURIComponent(car.dealer.slug)}`)}
          />
        </View>
        {similar.data?.data.length ? (
          <>
            <Text accessibilityRole="header" style={styles.heading}>
              {CARS_TEXT.similar}
            </Text>
            {similar.data.data.map((item) => (
              <CarCard
                key={item.slug}
                car={item}
                onOpen={() =>
                  router.navigate({ pathname: '/car/[slug]', params: { slug: item.slug } })
                }
                onDealer={() => router.navigate(`/dealers/${encodeURIComponent(item.dealer.slug)}`)}
              />
            ))}
          </>
        ) : null}
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  box: { padding: 20, borderWidth: 1, borderColor: colors.divider, borderRadius: 16, gap: 10 },
  eyebrow: {
    fontFamily: typography.family,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  price: { fontFamily: typography.family, color: colors.ink, fontSize: 30, fontWeight: '800' },
  text: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: 25,
  },
  muted: { fontFamily: typography.family, color: colors.muted, fontSize: 14, lineHeight: 22 },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 22, fontWeight: '800' },
  plate: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 5,
    padding: 6,
  },
  specs: { borderWidth: 1, borderColor: colors.divider, borderRadius: 16, overflow: 'hidden' },
  spec: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: typography.body,
  },
});
