import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Linking, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { Brand } from '../../../components/brand';
import { ConsentChoice } from '../../../components/consent-choice';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { publicEnvironment } from '../../../services/environment';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { supportApi } from '../../support/support-api';
import { RetryIdentity } from '../../support/retry-identity';
import { SUPPORT_TEXT } from '../../support/support.constants';
import { ACCOUNT_TEXT } from '../account.constants';

export function DeletionRequest() {
  const { manager } = useAuth();
  const session = useSession();
  const router = useRouter();
  const cache = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const lock = useRef(false);
  const retry = useRef(new RetryIdentity());
  const submit = async () => {
    if (lock.current || !confirmed) return;
    const token = manager.token();
    const owner = manager.getSnapshot().customer?.id;
    if (!token || !owner) {
      router.navigate('/sign-in');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        category: 'ACCOUNT_ISSUE',
        subject: ACCOUNT_TEXT.deletionSubject,
        description: `${ACCOUNT_TEXT.deletionDescription}${message.trim() ? `\n\n${message.trim()}` : ''}`,
      };
      const result = await supportApi.create(token, {
        ...payload,
        category: 'ACCOUNT_ISSUE',
        clientRequestId: retry.current.forPayload(payload),
      });
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      retry.current.clear();
      setReceipt(result.reference);
      void cache.invalidateQueries({ queryKey: ['customer', owner, 'support-tickets'] });
    } catch (failure) {
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      setError(
        failure instanceof ApiError &&
          ['NETWORK_UNAVAILABLE', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE'].includes(failure.code)
          ? SUPPORT_TEXT.createUncertain
          : failure instanceof Error
            ? failure.message
            : ACCOUNT_TEXT.failed,
      );
      if (failure instanceof ApiError && failure.status === 401) await manager.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <Page header={<Brand />} title={ACCOUNT_TEXT.delete}>
          <ActionButton
            variant="ghost"
            label={ACCOUNT_TEXT.back}
            disabled={busy}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/account'))}
          />
          <Text style={styles.text}>{ACCOUNT_TEXT.deletionBody}</Text>
          {session.status === 'guest' ? (
            <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
          ) : session.status !== 'authenticated' ? (
            <StatusPanel
              message={session.error ?? AUTH_TEXT.restoring}
              pending={session.status === 'restoring'}
              retry={session.status === 'unavailable' ? () => void manager.restore() : undefined}
            />
          ) : receipt ? (
            <>
              <Text accessibilityLiveRegion="polite" style={styles.text}>
                {ACCOUNT_TEXT.deletionReceived(receipt)}
              </Text>
              <Text style={styles.text}>{ACCOUNT_TEXT.deletionPending}</Text>
            </>
          ) : (
            <>
              <TextInput
                accessibilityLabel={ACCOUNT_TEXT.deletionMessage}
                placeholder={ACCOUNT_TEXT.deletionMessage}
                value={message}
                onChangeText={setMessage}
                maxLength={4000}
                multiline
                editable={!busy}
                style={styles.input}
              />
              <ConsentChoice
                label={ACCOUNT_TEXT.deletionConfirm}
                checked={confirmed}
                disabled={busy}
                onChange={() => setConfirmed(!confirmed)}
              />
              {error ? (
                <Text accessibilityRole="alert" style={styles.text}>
                  {error}
                </Text>
              ) : null}
              <ActionButton
                label={ACCOUNT_TEXT.delete}
                pending={busy}
                disabled={!confirmed}
                onPress={() => void submit()}
              />
            </>
          )}
          {error && session.status !== 'authenticated' ? (
            <Text accessibilityRole="alert" style={styles.text}>
              {error}
            </Text>
          ) : null}
          {error && session.status !== 'authenticated' ? (
            <Text accessibilityRole="alert" style={styles.text}>
              {error}
            </Text>
          ) : null}
          <ActionButton
            variant="secondary"
            label={ACCOUNT_TEXT.requests}
            onPress={() => router.navigate('/support-requests')}
          />
          <Text style={styles.text}>{ACCOUNT_TEXT.withoutAccount}</Text>
          <ActionButton
            variant="secondary"
            label={ACCOUNT_TEXT.external}
            onPress={() =>
              void Linking.openURL(
                new URL('/account-deletion', publicEnvironment().webBaseUrl).href,
              ).catch(() => setError(ACCOUNT_TEXT.failed))
            }
          />
          <ActionButton
            variant="ghost"
            label={AUTH_TEXT.privacy}
            onPress={() => router.navigate('/policy/privacy')}
          />
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  input: {
    fontFamily: typography.family,
    color: colors.ink,
    minHeight: 100,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    textAlignVertical: 'top',
  },
});
