import { SaveButton } from '../save-button';
import { titleWithoutYear, type VehicleCardDto } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';
import { CARS_TEXT } from '../../features/cars/cars.constants';

export interface CarCardProps {
  car: VehicleCardDto;
  onOpen: () => void;
  onDealer?: () => void;
}
export function CarCard({ car, onOpen, onDealer }: CarCardProps) {
  const [failed, setFailed] = useState(false);
  const reserved = car.availability !== 'AVAILABLE';
  const availabilityLabel =
    car.availability === 'SOLD'
      ? CARS_TEXT.sold
      : car.availability === 'UNAVAILABLE'
        ? CARS_TEXT.unavailableBadge
        : CARS_TEXT.reserved;
  return (
    <View style={styles.card}>
      <View style={styles.save}>
        <SaveButton slug={car.slug} title={car.title} />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CARS_TEXT.openCar(
          car.title,
          car.priceLabel ?? CARS_TEXT.priceRequest,
          car.metaLabel,
          car.availability === 'RESERVED',
        )}
        accessibilityState={{ disabled: reserved }}
        disabled={reserved}
        onPress={onOpen}
      >
        <View style={[styles.picture, reserved && styles.reserved]}>
          {car.image && !failed ? (
            <Image
              source={{ uri: car.image.url }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              recyclingKey={car.slug}
              accessibilityLabel={car.image.alt}
              onError={() => setFailed(true)}
            />
          ) : (
            <Text style={styles.fallback}>
              {failed ? CARS_TEXT.imageFailed : CARS_TEXT.noPhoto}
            </Text>
          )}
          {car.year ? <Text style={styles.year}>{car.year}</Text> : null}
          {reserved ? <Text style={styles.badge}>{availabilityLabel}</Text> : null}
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {titleWithoutYear(car)}
          </Text>
          <Text style={styles.price}>{car.priceLabel ?? CARS_TEXT.priceRequest}</Text>
          <Text style={styles.meta}>{car.metaLabel}</Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CARS_TEXT.openDealer(car.dealer.name)}
        disabled={!onDealer}
        onPress={onDealer}
        style={styles.dealer}
      >
        <Text style={styles.dealerName}>{car.dealer.name}</Text>
        {car.dealer.isVerified ? <Text style={styles.verified}>{CARS_TEXT.verified}</Text> : null}
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  save: { position: 'absolute', top: 10, right: 10, zIndex: 3 },
  card: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 15,
    overflow: 'hidden',
  },
  picture: {
    aspectRatio: 1.6,
    backgroundColor: '#eeeeec',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: { width: '100%', height: '100%' },
  reserved: { opacity: 0.6 },
  fallback: { fontFamily: typography.family, color: colors.muted, fontSize: 13 },
  year: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: colors.page,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  badge: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: colors.page,
    padding: 6,
    fontFamily: typography.family,
    fontWeight: '700',
    color: colors.ink,
  },
  content: { padding: 14, gap: 8 },
  title: {
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  price: { fontFamily: typography.family, color: colors.ink, fontSize: 20, fontWeight: '700' },
  meta: { fontFamily: typography.family, color: colors.muted, fontSize: 13, lineHeight: 20 },
  dealer: {
    padding: 14,
    paddingTop: 8,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: spacing.xs,
  },
  dealerName: { fontFamily: typography.family, color: colors.ink, fontSize: 14, fontWeight: '700' },
  verified: { fontFamily: typography.family, color: colors.muted, fontSize: 12 },
});
