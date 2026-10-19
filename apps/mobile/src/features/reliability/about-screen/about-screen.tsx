import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { Brand } from '../../../components/brand';
import { Page } from '../../../components/page';
import { colors, typography } from '../../../theme/tokens';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { SUPPORT_TEXT } from '../../support/support.constants';
import { RELIABILITY_TEXT } from '../reliability.constants';

export function AboutScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Page header={<Brand />} title={RELIABILITY_TEXT.about}>
        <Text style={styles.text}>
          {RELIABILITY_TEXT.version(
            Constants.expoConfig?.version ?? RELIABILITY_TEXT.unavailable,
            String(Constants.expoConfig?.android?.versionCode ?? RELIABILITY_TEXT.unavailable),
          )}
        </Text>
        <Text style={styles.text}>{RELIABILITY_TEXT.purpose}</Text>
        <ActionButton label={AUTH_TEXT.terms} onPress={() => router.navigate('/policy/terms')} />
        <ActionButton
          label={AUTH_TEXT.privacy}
          onPress={() => router.navigate('/policy/privacy')}
        />
        <ActionButton label={SUPPORT_TEXT.title} onPress={() => router.navigate('/support')} />
        <ActionButton
          variant="ghost"
          label={RELIABILITY_TEXT.home}
          onPress={() => router.replace('/')}
        />
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
});
