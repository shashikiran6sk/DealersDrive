import type { SupportMessage } from '@dealers-drive/contracts/support-client';
import { StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '../../../theme/tokens';

export function SupportMessageBubble({ message }: { message: SupportMessage }) {
  return (
    <View style={[styles.root, message.author === 'CUSTOMER' && styles.customer]}>
      <Text style={styles.label}>
        {message.authorLabel} · {message.createdLabel}
      </Text>
      <Text style={styles.body}>{message.body}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  customer: { backgroundColor: colors.surface },
  label: { fontFamily: typography.family, color: colors.muted, fontSize: 12 },
  body: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
});
