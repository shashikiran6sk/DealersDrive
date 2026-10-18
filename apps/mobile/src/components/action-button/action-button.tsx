import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

export interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
}

export function ActionButton({
  label,
  onPress,
  disabled = false,
  pending = false,
}: ActionButtonProps) {
  const unavailable = disabled || pending;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy: pending }}
      disabled={unavailable}
      onPress={onPress}
      style={[styles.button, unavailable && styles.disabled]}
    >
      {pending ? <ActivityIndicator color={colors.page} /> : null}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  disabled: { opacity: 0.6 },
  label: {
    color: colors.page,
    fontFamily: typography.family,
    fontSize: typography.label,
    fontWeight: '700',
    flexShrink: 1,
  },
});
