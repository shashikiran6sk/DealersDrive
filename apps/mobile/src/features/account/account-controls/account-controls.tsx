import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { ConsentChoice } from '../../../components/consent-choice';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { accountApi } from '../account-api';
import { ACCOUNT_TEXT } from '../account.constants';

export function AccountControls() {
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const query = useQuery({
    queryKey: ['customer', owner, 'account-controls', manager.expiresAt()],
    enabled: session.status === 'authenticated',
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return accountApi.status(token, signal);
    },
    staleTime: 0,
  });
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      query.error.status === 401 &&
      manager.getSnapshot().customer?.id === owner
    )
      void manager.invalidate();
  }, [query.error, manager, owner]);
  const deactivate = async () => {
    if (lock.current || !confirmed) return;
    const token = manager.token();
    const customer = manager.getSnapshot().customer?.id;
    if (!token || !customer) {
      router.navigate('/sign-in');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await accountApi.deactivate(token);
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      Alert.alert(ACCOUNT_TEXT.deactivated, ACCOUNT_TEXT.reactivationBody);
      await manager.invalidate();
      if (manager.getSnapshot().status === 'guest') router.replace('/(tabs)/profile');
    } catch (failure) {
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      setConfirmed(false);
      setError(
        failure instanceof ApiError &&
          ['NETWORK_UNAVAILABLE', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE'].includes(failure.code)
          ? ACCOUNT_TEXT.uncertain
          : failure instanceof Error
            ? failure.message
            : ACCOUNT_TEXT.failed,
      );
      if (failure instanceof ApiError && failure.status === 401) await manager.invalidate();
      else if (failure instanceof ApiError && failure.code === 'CUSTOMER_REAUTH_REQUIRED')
        router.navigate('/sign-in');
      void query.refetch();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <Page showTitle={false} title={ACCOUNT_TEXT.title}>
        {session.status === 'guest' ? (
          <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
        ) : session.status !== 'authenticated' ? (
          <StatusPanel
            message={session.error ?? AUTH_TEXT.restoring}
            pending={session.status === 'restoring'}
            retry={session.status === 'unavailable' ? () => void manager.restore() : undefined}
          />
        ) : (
          <>
            <Text style={styles.text}>{session.customer?.fullName}</Text>
            <Text style={styles.text}>{session.customer?.phoneDisplay}</Text>
            <Text style={styles.text}>{ACCOUNT_TEXT.deactivateBody}</Text>
            {query.isPending ? (
              <StatusPanel message={AUTH_TEXT.restoring} pending />
            ) : query.isError ? (
              <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
            ) : !query.data?.canDeactivate ? (
              <>
                <Text style={styles.text}>{ACCOUNT_TEXT.freshOtpBody}</Text>
                <ActionButton
                  label={ACCOUNT_TEXT.freshOtp}
                  onPress={() => router.navigate('/sign-in')}
                />
              </>
            ) : (
              <>
                <ConsentChoice
                  checked={confirmed}
                  label={ACCOUNT_TEXT.confirmDeactivate}
                  disabled={busy}
                  onChange={() => setConfirmed(!confirmed)}
                />
                <ActionButton
                  label={ACCOUNT_TEXT.deactivate}
                  pending={busy}
                  disabled={!confirmed}
                  onPress={() => void deactivate()}
                />
              </>
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.text}>
                {error}
              </Text>
            ) : null}
          </>
        )}
        <Text style={styles.text}>{ACCOUNT_TEXT.records}</Text>
        <ActionButton
          variant="secondary"
          label={ACCOUNT_TEXT.delete}
          onPress={() => router.navigate('/account-deletion')}
        />
        <ActionButton
          variant="ghost"
          label={AUTH_TEXT.privacy}
          onPress={() => router.navigate('/policy/privacy')}
        />
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
});
