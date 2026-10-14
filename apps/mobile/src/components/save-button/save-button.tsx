import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useSaved } from '../../features/saved/saved-provider';
import { SAVED_TEXT } from '../../features/saved/saved.constants';
import { colors, typography } from '../../theme/tokens';

export function SaveButton({
  slug,
  title,
  labelled = false,
}: {
  slug: string;
  title: string;
  labelled?: boolean;
}) {
  const saved = useSaved();
  const active = saved.isSaved(slug);
  const busy = saved.isPending(slug);
  const failed = !saved.ready && saved.error !== null;
  const unavailable = busy || (!saved.ready && !failed);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        failed
          ? SAVED_TEXT.retry
          : active
            ? SAVED_TEXT.removeLabel(title)
            : SAVED_TEXT.saveLabel(title)
      }
      accessibilityState={{ selected: active, busy: unavailable, disabled: unavailable }}
      disabled={unavailable}
      onPress={() => (failed ? saved.retry() : saved.toggle(slug))}
      style={[styles.button, labelled && styles.full]}
    >
      {unavailable ? (
        <ActivityIndicator color={colors.ink} />
      ) : (
        <Text style={styles.heart}>
          {failed ? SAVED_TEXT.retry : active ? SAVED_TEXT.heartFull : SAVED_TEXT.heartEmpty}
        </Text>
      )}
      {labelled ? (
        <Text style={styles.label}>{active ? SAVED_TEXT.saved : SAVED_TEXT.save}</Text>
      ) : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    backgroundColor: colors.page,
    paddingHorizontal: 12,
  },
  full: { width: '100%' },
  heart: { fontSize: 23, color: colors.ink },
  label: { fontFamily: typography.family, fontSize: 15, fontWeight: '700', color: colors.ink },
});
