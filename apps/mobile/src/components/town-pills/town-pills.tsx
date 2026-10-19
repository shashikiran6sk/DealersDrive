import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../theme/tokens';

export function TownPills({
  options,
  selected,
  onToggle,
  onClear,
}: {
  options: readonly { value: string; label: string; count: number }[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  if (!options.length) return null;
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: !selected.length }}
        accessibilityLabel="All towns"
        onPress={onClear}
        style={[styles.pill, !selected.length && styles.active]}
      >
        <Text style={[styles.text, !selected.length && styles.white]}>All towns</Text>
      </Pressable>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active, disabled: option.count === 0 && !active }}
            accessibilityLabel={`${option.label}, ${option.count} ${option.count === 1 ? 'dealership' : 'dealerships'}`}
            disabled={option.count === 0 && !active}
            style={[styles.pill, active && styles.active]}
            onPress={() => onToggle(option.value)}
          >
            <Text style={[styles.text, active && styles.white]}>
              {option.label}
              {option.count ? ` (${option.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.page,
  },
  active: { backgroundColor: colors.ink, borderColor: colors.ink },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 13, fontWeight: '600' },
  white: { color: colors.page },
});
