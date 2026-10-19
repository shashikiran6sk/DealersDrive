import { RELIABILITY_TEXT } from '../../reliability/reliability.constants';
import { SAVED_TEXT } from '../../saved/saved.constants';
import { ENQUIRY_TEXT } from '../../enquiries/enquiries.constants';
import { SUPPORT_TEXT } from '../../support/support.constants';
import { ACCOUNT_TEXT } from '../../account/account.constants';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { NavigationRow } from '../../../components/navigation-row';
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
      {session.status === 'authenticated' ? (
        <View style={styles.group}>
          <NavigationRow
            label={ENQUIRY_TEXT.history}
            onPress={() => router.navigate('/enquiries')}
          />
          <NavigationRow label={ACCOUNT_TEXT.title} onPress={() => router.navigate('/account')} />
          <NavigationRow
            label={SAVED_TEXT.agreements}
            onPress={() => router.navigate('/agreements')}
          />
        </View>
      ) : null}
      <View style={styles.group}>
        <NavigationRow label={SUPPORT_TEXT.title} onPress={() => router.navigate('/support')} />
        <NavigationRow
          label={ENQUIRY_TEXT.privacyControls}
          onPress={() => router.navigate('/privacy-controls')}
        />
        <NavigationRow label={RELIABILITY_TEXT.about} onPress={() => router.navigate('/about')} />
      </View>
      <View style={styles.group}>
        <NavigationRow label={AUTH_TEXT.terms} onPress={() => router.push('/policy/terms')} />
        <NavigationRow label={AUTH_TEXT.privacy} onPress={() => router.push('/policy/privacy')} />
      </View>
    </Page>
  );
}
const styles = StyleSheet.create({
  group: { borderWidth: 1, borderColor: colors.divider, borderRadius: 14, overflow: 'hidden' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: typography.body },
  name: { fontFamily: typography.family, color: colors.ink, fontSize: 20, fontWeight: '700' },
});
