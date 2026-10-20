import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../action-button';
import { colors, spacing, typography } from '../../theme/tokens';
import { CARS_TEXT } from '../../features/cars/cars.constants';

export function StatusPanel({
  message,
  retry,
  pending = false,
}: {
  message: string;
  retry?: () => void;
  pending?: boolean;
}) {
  return (
    <View style={styles.panel}>
      <Text
        accessibilityRole={pending ? 'text' : 'alert'}
        accessibilityLiveRegion="polite"
        style={styles.text}
      >
        {message}
      </Text>
      {retry ? <ActionButton label={CARS_TEXT.retry} onPress={retry} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  panel: { padding: spacing.md, gap: spacing.md },
  text: { fontFamily: typography.family, fontSize: typography.body, color: colors.ink },
});
