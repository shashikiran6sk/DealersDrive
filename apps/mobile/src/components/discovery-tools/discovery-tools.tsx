import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../theme/tokens';
import { Icon } from '../icon';

export function DiscoveryTools({
  count,
  onSort,
  onFilters,
}: {
  count: number;
  onSort: () => void;
  onFilters: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sort"
        onPress={onSort}
        style={styles.button}
      >
        <Icon name="sort" size={19} />
        <Text style={styles.text}>Sort</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Filters${count ? `, ${count} active` : ''}`}
        onPress={onFilters}
        style={styles.button}
      >
        <Icon name="filters" size={19} />
        <Text style={styles.text}>Filters{count ? ` (${count})` : ''}</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.page,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  text: { fontFamily: typography.family, fontSize: 14, fontWeight: '700', color: colors.ink },
});
