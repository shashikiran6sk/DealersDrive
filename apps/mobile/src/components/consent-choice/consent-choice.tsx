import Svg, { Path } from 'react-native-svg';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

export function ConsentChoice({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onChange}
      style={styles.choice}
    >
      <View style={[styles.box, checked && styles.checked]}>
        {checked ? (
          <Svg width={16} height={16} viewBox="0 0 24 24" accessible={false}>
            <Path d="M5 12l4 4 10-10" fill="none" stroke="#ffffff" strokeWidth={3} />
          </Svg>
        ) : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  choice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
  },
  checked: { backgroundColor: colors.ink },
  label: { flex: 1, fontFamily: typography.family, fontSize: typography.body, color: colors.ink },
});
