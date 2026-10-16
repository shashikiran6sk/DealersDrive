import type { VehicleCardDto } from '@dealers-drive/contracts/public';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { CarCard } from '../../../components/car-card';
import { colors, spacing, typography } from '../../../theme/tokens';

export function InventoryRow({
  title,
  cars,
  onBrowse,
}: {
  title: string;
  cars: VehicleCardDto[];
  onBrowse: () => void;
}) {
  const router = useRouter();
  if (!cars.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View all ${title.toLowerCase()}`}
          onPress={onBrowse}
          style={styles.link}
        >
          <Text style={styles.linkText}>View all →</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={cars}
        keyExtractor={(car) => car.slug}
        initialNumToRender={2}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <CarCard
              car={item}
              onOpen={() =>
                router.navigate({ pathname: '/car/[slug]', params: { slug: item.slug } })
              }
              onDealer={() => router.navigate(`/dealers/${encodeURIComponent(item.dealer.slug)}`)}
            />
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  section: { paddingTop: spacing.lg, gap: 8 },
  header: { paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flex: 1,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  link: { minHeight: 48, justifyContent: 'center' },
  linkText: { fontFamily: typography.family, color: colors.ink, fontSize: 13, fontWeight: '700' },
  cards: { paddingHorizontal: spacing.md },
  card: { width: 280 },
  separator: { width: 12 },
});
