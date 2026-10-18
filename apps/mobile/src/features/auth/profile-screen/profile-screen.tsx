import { SAVED_TEXT } from '../../saved/saved.constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../auth-provider';
import { AUTH_TEXT } from '../auth.constants';

export function ProfileScreen() {
  const { manager } = useAuth();
  const session = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = useRef(false);
  const logout = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setNotice(null);
    try {
      if (!(await manager.logout()))
        setNotice(manager.getSnapshot().error ?? AUTH_TEXT.signedOutLocal);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <Page title={AUTH_TEXT.profileName}>
      {session.status === 'restoring' ? (
        <Text accessibilityLiveRegion="polite" style={styles.text}>
          {AUTH_TEXT.restoring}
        </Text>
      ) : null}
      {session.status === 'unavailable' ? (
        <>
          <Text accessibilityRole="alert" style={styles.text}>
            {session.error}
          </Text>
          <ActionButton label={AUTH_TEXT.retry} onPress={() => void manager.restore()} />
          <ActionButton label={AUTH_TEXT.logout} pending={busy} onPress={() => void logout()} />
        </>
      ) : null}
      {session.status === 'authenticated' && session.customer ? (
        <>
          <Text accessibilityRole="header" style={styles.name}>
            {session.customer.fullName}
          </Text>
          <Text style={styles.text}>{AUTH_TEXT.profileNumber}</Text>
          <Text style={styles.text}>{session.customer.phoneDisplay}</Text>
          <ActionButton label={AUTH_TEXT.logout} pending={busy} onPress={() => void logout()} />
        </>
      ) : session.status === 'guest' ? (
        <ActionButton
          label={AUTH_TEXT.login}
          disabled={busy}
          onPress={() => router.push('/sign-in')}
        />
      ) : null}
      {notice ? (
        <Text accessibilityRole="alert" style={styles.text}>
          {notice}
        </Text>
      ) : null}
      <ActionButton
        variant="secondary"
        label={SAVED_TEXT.agreements}
        onPress={() => router.navigate('/agreements')}
      />
      <ActionButton label={AUTH_TEXT.terms} onPress={() => router.push('/policy/terms')} />
      <ActionButton label={AUTH_TEXT.privacy} onPress={() => router.push('/policy/privacy')} />
    </Page>
  );
}
const styles = StyleSheet.create({
  text: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
  name: { fontFamily: typography.family, color: colors.ink, fontSize: 20, fontWeight: '700' },
});
