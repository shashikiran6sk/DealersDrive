import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii, spacing, typography } from '../../theme/tokens';

export interface ActionButtonProps {
  label: string;
  testID?: string;
  onPress: () => void;
  disabled?: boolean;
  pending?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function ActionButton({
  label,
  testID,
  onPress,
  disabled = false,
  pending = false,
  variant = 'primary',
}: ActionButtonProps) {
  const unavailable = disabled || pending;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy: pending }}
      disabled={unavailable}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        unavailable && styles.disabled,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={variant === 'primary' ? colors.page : colors.ink} />
      ) : null}
      <Text style={[styles.label, variant !== 'primary' && styles.darkLabel]}>{label}</Text>
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
  secondary: { backgroundColor: colors.page, borderWidth: 1, borderColor: colors.divider },
  ghost: { backgroundColor: 'transparent' },
  darkLabel: { color: colors.ink },
  disabled: { opacity: 0.6 },
  label: {
    color: colors.page,
    fontFamily: typography.family,
    fontSize: typography.label,
    fontWeight: '700',
    flexShrink: 1,
  },
});
