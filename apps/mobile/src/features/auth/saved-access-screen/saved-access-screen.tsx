import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { SHELL_TEXT } from '../../navigation/navigation.constants';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../auth-provider';
import { AUTH_TEXT } from '../auth.constants';

export function SavedAccessScreen() {
  const { manager } = useAuth();
  const session = useSession();
  const router = useRouter();
  return (
    <Page
      title={SHELL_TEXT.savedTitle}
      description={session.status === 'authenticated' ? SHELL_TEXT.savedDescription : undefined}
    >
      {session.status === 'restoring' ? (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {AUTH_TEXT.restoring}
        </Text>
      ) : null}
      {session.status === 'guest' ? (
        <>
          <Text style={styles.text}>{AUTH_TEXT.savedGuest}</Text>
          <ActionButton
            label={AUTH_TEXT.login}
            onPress={() => {
              manager.pending.request({ kind: 'saved' });
              router.push('/sign-in');
            }}
          />
        </>
      ) : null}
      {session.status === 'unavailable' ? (
        <>
          <Text accessibilityRole="alert" style={styles.text}>
            {session.error}
          </Text>
          <ActionButton label={AUTH_TEXT.retry} onPress={() => void manager.restore()} />
        </>
      ) : null}
    </Page>
  );
}
const styles = StyleSheet.create({
  text: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
});
