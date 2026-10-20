import { StyleSheet, View } from 'react-native';
import { CARS_TEXT } from '../../features/cars/cars.constants';
import { colors, spacing } from '../../theme/tokens';

export function CarCardSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel={CARS_TEXT.loading}
      accessibilityState={{ busy: true }}
      style={styles.card}
    >
      <View style={styles.picture} />
      <View style={styles.body}>
        <View style={styles.title} />
        <View style={styles.price} />
        <View style={styles.meta} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: colors.page,
    marginBottom: spacing.md,
  },
  picture: { aspectRatio: 1.6, backgroundColor: colors.surface },
  body: { padding: 14, gap: 12 },
  title: { height: 20, width: '80%', backgroundColor: colors.surface, borderRadius: 4 },
  price: { height: 24, width: '45%', backgroundColor: colors.surface, borderRadius: 4 },
  meta: { height: 16, width: '65%', backgroundColor: colors.surface, borderRadius: 4 },
});
