import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckBoxMark } from '../consent-choice/check-box-mark';
import { AUTH_TEXT } from '../../features/auth/auth.constants';
import { colors, typography } from '../../theme/tokens';

export function PolicyChoice({
  kind,
  checked,
  onChange,
  disabled = false,
}: {
  kind: 'terms' | 'privacy';
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const router = useRouter();
  const policy = kind === 'terms' ? AUTH_TEXT.terms : AUTH_TEXT.privacy;
  const label = kind === 'terms' ? AUTH_TEXT.acceptTerms : AUTH_TEXT.acknowledgePrivacy;
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={onChange}
        style={styles.checkbox}
      >
        <CheckBoxMark checked={checked} />
      </Pressable>
      <View style={styles.sentence}>
        <Text style={styles.prefix}>
          {kind === 'terms' ? 'I accept the ' : 'I acknowledge the '}
        </Text>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Read ${policy}`}
          onPress={() => router.push(`/policy/${kind}`)}
          style={styles.link}
        >
          <Text style={styles.text}>{policy}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, minHeight: 48 },
  checkbox: { minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  sentence: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    minHeight: 48,
  },
  prefix: { fontFamily: typography.family, fontSize: 14, color: colors.ink },
  link: { minHeight: 48, maxWidth: '100%', justifyContent: 'center' },
  text: {
    color: colors.ink,
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
