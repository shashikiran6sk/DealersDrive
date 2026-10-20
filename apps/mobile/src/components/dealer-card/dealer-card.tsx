import type { DealerCard as Dealer } from '@dealers-drive/contracts/public';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import cover from '../../assets/dealer-cover.svg';
import { colors, spacing, typography } from '../../theme/tokens';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { DEALERS_TEXT } from '../../features/dealers/dealers.constants';

export function DealerCard({ dealer, onPress }: { dealer: Dealer; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${dealer.brandName}. ${dealer.yearsLabel}. ${DEALERS_TEXT.cars(dealer.carCount)}. ${dealer.fromPriceLabel}`}
      onPress={onPress}
      style={styles.card}
    >
      <Image
        source={cover}
        style={styles.cover}
        contentFit="cover"
        accessibilityLabel={DEALERS_TEXT.illustration}
      />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.initials}>{dealer.initials}</Text>
          {dealer.isVerified ? <Text style={styles.badge}>{CARS_TEXT.verified}</Text> : null}
        </View>
        <Text style={styles.name}>{dealer.brandName}</Text>
        <Text style={styles.meta}>{dealer.yearsLabel}</Text>
        <View style={styles.services}>
          {dealer.services.slice(0, 3).map((service) => (
            <Text key={service} style={styles.tag}>
              {service}
            </Text>
          ))}
        </View>
        <View style={styles.footer}>
          <Text style={styles.meta}>{DEALERS_TEXT.cars(dealer.carCount)}</Text>
          <Text style={styles.price}>{dealer.fromPriceLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cover: { width: '100%', height: 112 },
  body: { padding: 18, gap: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -42,
  },
  initials: {
    width: 48,
    height: 48,
    paddingTop: 13,
    textAlign: 'center',
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    fontFamily: typography.family,
    fontWeight: '800',
    fontSize: 16,
    color: colors.ink,
  },
  badge: {
    fontFamily: typography.family,
    fontSize: 11,
    color: colors.ink,
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 6,
    borderRadius: 5,
  },
  name: { fontFamily: typography.family, fontSize: 18, fontWeight: '800', color: colors.ink },
  meta: { fontFamily: typography.family, fontSize: 13, color: colors.muted },
  services: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: {
    fontFamily: typography.family,
    fontSize: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderRadius: 5,
    padding: 5,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  price: { fontFamily: typography.family, fontSize: 14, fontWeight: '700', color: colors.ink },
});
