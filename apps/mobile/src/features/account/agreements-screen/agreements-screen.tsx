import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TermsAcceptanceInput } from '@dealers-drive/contracts/legal-client';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { ConsentChoice } from '../../../components/consent-choice';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { publicEnvironment } from '../../../services/environment';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { savedApi } from '../../saved/saved-api';
import { useSaved } from '../../saved/saved-provider';
import { SAVED_TEXT } from '../../saved/saved.constants';

export function AgreementsScreen() {
  const { manager, api } = useAuth();
  const session = useSession();
  const saved = useSaved();
  const router = useRouter();
  const navigation = useNavigation();
  const cache = useQueryClient();
  const userId = session.customer?.id;
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completed = useRef(false);
  const locked = useRef(false);
  const publication = useQuery({
    queryKey: ['legal-publication'],
    queryFn: ({ signal }) => api.publication(signal),
  });
  const status = useQuery({
    queryKey: ['customer', userId, 'legal-status'],
    enabled: session.status === 'authenticated',
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return savedApi.legalStatus(token, signal);
    },
  });
  const history = useQuery({
    queryKey: ['customer', userId, 'legal-history'],
    enabled: session.status === 'authenticated',
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return savedApi.history(token, signal);
    },
  });
  const versions = publication.data?.documents
    .map((doc) => `${doc.version}:${doc.digest}`)
    .join('|');
  useEffect(() => {
    setTerms(false);
    setPrivacy(false);
  }, [versions, publication.data?.collectionEnabled, userId]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        if (!completed.current) manager.pending.clear();
      }),
    [navigation, manager],
  );
  useEffect(() => {
    if (
      (status.error instanceof ApiError && status.error.status === 401) ||
      (history.error instanceof ApiError && history.error.status === 401)
    )
      if (manager.getSnapshot().customer?.id === userId) void manager.invalidate();
  }, [status.error, history.error, manager, userId]);
  const accept = async () => {
    if (locked.current) return;
    const token = manager.token();
    const owner = manager.getSnapshot().customer?.id;
    if (!token || !owner) {
      router.navigate('/sign-in');
      return;
    }
    const documents = publication.data?.documents;
    const input = TermsAcceptanceInput.safeParse({
      version: documents?.find((doc) => doc.id === 'terms')?.version,
      accepted: terms,
      privacyAcknowledged: privacy,
      privacyVersion: documents?.find((doc) => doc.id === 'privacy')?.version,
    });
    if (!input.success) {
      setError(AUTH_TEXT.agreements);
      return;
    }
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await savedApi.accept(token, input.data);
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      await cache.invalidateQueries({ queryKey: ['customer', owner, 'legal-status'] });
      await cache.invalidateQueries({ queryKey: ['customer', owner, 'legal-history'] });
      if (manager.getSnapshot().customer?.id !== owner || manager.token() !== token) return;
      completed.current = true;
      saved.resume();
      if (router.canGoBack()) router.back();
    } catch (failure) {
      if (manager.getSnapshot().customer?.id !== owner) return;
      setError(failure instanceof Error ? failure.message : AUTH_TEXT.restoreError);
      setTerms(false);
      setPrivacy(false);
      void publication.refetch();
      if (failure instanceof ApiError && failure.status === 401) await manager.invalidate();
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Page title={SAVED_TEXT.agreements}>
        <ActionButton
          variant="ghost"
          label={SAVED_TEXT.decline}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
        />
        {session.status !== 'authenticated' ? (
          <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
        ) : (
          <>
            {status.isPending ? (
              <StatusPanel message={AUTH_TEXT.restoring} pending />
            ) : status.isError ? (
              <StatusPanel message={status.error.message} retry={() => void status.refetch()} />
            ) : !status.data?.enabled ? (
              <Text style={styles.text}>{SAVED_TEXT.draft}</Text>
            ) : !status.data.termsRequired && !status.data.privacyRequired ? (
              <Text style={styles.text}>{SAVED_TEXT.current}</Text>
            ) : (
              <>
                <ActionButton
                  variant="secondary"
                  label={AUTH_TEXT.terms}
                  onPress={() => router.navigate('/policy/terms')}
                />
                <ActionButton
                  variant="secondary"
                  label={AUTH_TEXT.privacy}
                  onPress={() => router.navigate('/policy/privacy')}
                />
                <ConsentChoice
                  label={AUTH_TEXT.acceptTerms}
                  checked={terms}
                  onChange={() => setTerms(!terms)}
                  disabled={busy}
                />
                <ConsentChoice
                  label={AUTH_TEXT.acknowledgePrivacy}
                  checked={privacy}
                  onChange={() => setPrivacy(!privacy)}
                  disabled={busy}
                />
                <ActionButton
                  label={SAVED_TEXT.agree}
                  pending={busy}
                  disabled={
                    !terms ||
                    !privacy ||
                    !publication.data ||
                    publication.data.state === 'UNAVAILABLE'
                  }
                  onPress={() => void accept()}
                />
              </>
            )}
            {error ? (
              <Text accessibilityRole="alert" style={styles.text}>
                {error}
              </Text>
            ) : null}
            <Text accessibilityRole="header" style={styles.heading}>
              {SAVED_TEXT.history}
            </Text>
            <Text style={styles.text}>{SAVED_TEXT.historyLimit}</Text>
            {history.isError ? (
              <StatusPanel message={history.error.message} retry={() => void history.refetch()} />
            ) : null}
            {history.data?.data.length === 0 ? (
              <Text style={styles.text}>{SAVED_TEXT.historyEmpty}</Text>
            ) : null}
            {history.data?.data.map((receipt) => (
              <View key={receipt.id} style={styles.receipt}>
                <Text style={styles.text}>
                  {SAVED_TEXT.historyItem(receipt.action, receipt.version)}
                </Text>
                <Text style={styles.text}>
                  {new Date(receipt.createdAt).toLocaleString('en-IN')}
                </Text>
                {['terms', 'privacy'].includes(receipt.documentId) ? (
                  <ActionButton
                    variant="ghost"
                    label={receipt.documentId === 'terms' ? AUTH_TEXT.terms : AUTH_TEXT.privacy}
                    onPress={() =>
                      void Linking.openURL(
                        new URL(
                          `/legal/${encodeURIComponent(receipt.documentId)}/${encodeURIComponent(receipt.version)}`,
                          publicEnvironment().webBaseUrl,
                        ).href,
                      ).catch(() => undefined)
                    }
                  />
                ) : null}
              </View>
            ))}
          </>
        )}
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 21, fontWeight: '700' },
  receipt: { padding: 14, borderWidth: 1, borderColor: colors.divider, borderRadius: 10, gap: 8 },
});
