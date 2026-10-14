import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VehicleSlugParam } from '@dealers-drive/contracts/public';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { ConsentChoice } from '../../../components/consent-choice';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { carsApi } from '../../cars/cars-api';
import { ENQUIRY_TEXT } from '../enquiries.constants';
import { enquiriesApi } from '../enquiries-api';
import { enquiryInput, sharingSignature } from '../enquiry-input';

export function EnquiryFormScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { manager, api } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const navigation = useNavigation();
  const cache = useQueryClient();
  const [message, setMessage] = useState('');
  const [granted, setGranted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const lock = useRef(false);
  const valid = VehicleSlugParam.safeParse({ slug }).success;
  const car = useQuery({
    queryKey: ['public', 'car', slug],
    queryFn: ({ signal }) => carsApi.detail(slug, signal),
    enabled: valid,
  });
  const publication = useQuery({
    queryKey: ['legal-publication'],
    queryFn: ({ signal }) => api.publication(signal),
  });
  const sharing = useQuery({
    queryKey: ['customer', owner, 'sharing-status', slug],
    enabled: session.status === 'authenticated' && valid,
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return enquiriesApi.sharing(token, slug, signal);
    },
  });
  const signature =
    publication.data && sharing.data ? sharingSignature(publication.data, sharing.data) : null;
  useEffect(() => {
    setGranted(false);
  }, [signature, owner]);
  useEffect(() => {
    setMessage('');
    setReceipt(null);
    setError(null);
  }, [owner, slug]);
  useEffect(() => {
    const action = manager.pending.peek();
    if (
      session.status === 'authenticated' &&
      owner &&
      action?.intent.kind === 'enquiry' &&
      action.intent.slug === slug
    )
      manager.pending.consume(action.id, owner);
    if (
      sharing.error instanceof ApiError &&
      sharing.error.status === 401 &&
      manager.getSnapshot().customer?.id === owner
    )
      void manager.invalidate();
  }, [session.status, owner, sharing.error, manager, slug]);
  useEffect(
    () =>
      navigation.addListener('beforeRemove', () => {
        const action = manager.pending.peek();
        if (action?.intent.kind === 'enquiry' && action.intent.slug === slug)
          manager.pending.clear();
      }),
    [navigation, manager, slug],
  );
  const login = () => {
    manager.pending.request({ kind: 'enquiry', slug });
    if (owner) manager.pending.bind(owner);
    router.navigate('/sign-in');
  };
  const send = async () => {
    if (lock.current) return;
    const token = manager.token();
    const customer = manager.getSnapshot().customer?.id;
    if (!token || !customer) {
      login();
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const [current, recipient] = await Promise.all([
        api.publication(),
        enquiriesApi.sharing(token, slug),
      ]);
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      cache.setQueryData(['legal-publication'], current);
      cache.setQueryData(['customer', customer, 'sharing-status', slug], recipient);
      if (!signature || sharingSignature(current, recipient) !== signature) {
        setGranted(false);
        setError(ENQUIRY_TEXT.changed);
        return;
      }
      const input = enquiryInput(slug, message, granted, current, recipient);
      const result = await enquiriesApi.create(token, input);
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      setReceipt(result.dealerName);
      void cache.invalidateQueries({ queryKey: ['customer', customer, 'enquiries'] });
      void cache.invalidateQueries({ queryKey: ['customer', customer, 'sharing-status'] });
      void cache.invalidateQueries({ queryKey: ['customer', customer, 'sharing-permissions'] });
    } catch (failure) {
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      setGranted(false);
      if (failure instanceof ApiError && failure.status === 401) {
        await manager.invalidate();
        manager.pending.request({ kind: 'enquiry', slug });
        manager.pending.bind(customer);
        router.navigate('/sign-in');
      } else if (
        failure instanceof ApiError &&
        ['AGREEMENT_REQUIRED', 'PRIVACY_ACKNOWLEDGMENT_REQUIRED'].includes(failure.code)
      ) {
        router.navigate('/agreements');
      } else
        setError(
          failure instanceof ApiError && failure.code === 'ENQUIRY_ALREADY_OPEN'
            ? ENQUIRY_TEXT.duplicate
            : failure instanceof ApiError &&
                ['NETWORK_UNAVAILABLE', 'REQUEST_TIMEOUT', 'INVALID_RESPONSE'].includes(
                  failure.code,
                )
              ? ENQUIRY_TEXT.uncertain
              : failure instanceof Error
                ? failure.message
                : ENQUIRY_TEXT.failed,
        );
      void sharing.refetch();
      void publication.refetch();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace('/cars'));
  const missing =
    !valid ||
    (sharing.error instanceof ApiError && sharing.error.status === 404) ||
    (car.error instanceof ApiError && car.error.status === 404);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <Page title={receipt ? ENQUIRY_TEXT.sent : ENQUIRY_TEXT.heading}>
          <ActionButton variant="ghost" label={ENQUIRY_TEXT.back} onPress={back} />
          {receipt ? (
            <Text accessibilityLiveRegion="polite" style={styles.text}>
              {ENQUIRY_TEXT.received(receipt)}
            </Text>
          ) : missing ? (
            <StatusPanel message={ENQUIRY_TEXT.unavailable} />
          ) : session.status === 'guest' ? (
            <>
              <Text style={styles.text}>{ENQUIRY_TEXT.login}</Text>
              <ActionButton label={AUTH_TEXT.login} onPress={login} />
            </>
          ) : session.status !== 'authenticated' ? (
            <StatusPanel
              message={session.error ?? AUTH_TEXT.restoring}
              pending={session.status === 'restoring'}
              retry={session.status === 'unavailable' ? () => void manager.restore() : undefined}
            />
          ) : sharing.isPending || publication.isPending ? (
            <StatusPanel message={ENQUIRY_TEXT.prepare} pending />
          ) : sharing.isError || publication.isError || !sharing.data || !publication.data ? (
            <StatusPanel
              message={sharing.error?.message ?? publication.error?.message ?? ENQUIRY_TEXT.failed}
              retry={() => {
                void sharing.refetch();
                void publication.refetch();
              }}
            />
          ) : (
            <>
              {car.data ? <Text style={styles.heading}>{car.data.title}</Text> : null}
              <Text style={styles.heading}>{sharing.data.dealerName}</Text>
              <Text style={styles.text}>{session.customer?.fullName}</Text>
              <Text style={styles.text}>
                {session.customer?.phoneDisplay} · {ENQUIRY_TEXT.verified}
              </Text>
              <Text style={styles.text}>{ENQUIRY_TEXT.message}</Text>
              <TextInput
                accessibilityLabel={ENQUIRY_TEXT.message}
                placeholder={ENQUIRY_TEXT.placeholder}
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={1000}
                editable={!busy}
              />
              {publication.data.state === 'DRAFT' ? (
                <Text style={styles.text}>{AUTH_TEXT.draft}</Text>
              ) : null}
              {publication.data.collectionEnabled && sharing.data.required ? (
                <ConsentChoice
                  checked={granted}
                  disabled={busy}
                  onChange={() => setGranted(!granted)}
                  label={ENQUIRY_TEXT.permission(sharing.data.dealerName)}
                />
              ) : (
                <Text style={styles.text}>{ENQUIRY_TEXT.shareNote(sharing.data.dealerName)}</Text>
              )}
              <ActionButton
                variant="ghost"
                label={ENQUIRY_TEXT.notice}
                onPress={() => router.navigate('/sharing-notice')}
              />
              <ActionButton
                variant="ghost"
                label={AUTH_TEXT.terms}
                onPress={() => router.navigate('/policy/terms')}
              />
              <ActionButton
                variant="ghost"
                label={AUTH_TEXT.privacy}
                onPress={() => router.navigate('/policy/privacy')}
              />
              <ActionButton
                label={ENQUIRY_TEXT.send}
                pending={busy}
                disabled={
                  publication.data.state === 'UNAVAILABLE' ||
                  (publication.data.collectionEnabled && sharing.data.required && !granted)
                }
                onPress={() => void send()}
              />
              <ActionButton
                variant="ghost"
                label={ENQUIRY_TEXT.agreements}
                onPress={() => router.navigate('/agreements')}
              />
            </>
          )}
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <ActionButton
            variant="secondary"
            label={ENQUIRY_TEXT.history}
            onPress={() => router.navigate('/enquiries')}
          />
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 20, fontWeight: '700' },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 14,
    color: colors.ink,
    fontFamily: typography.family,
    textAlignVertical: 'top',
  },
  error: { fontFamily: typography.family, color: colors.error, fontSize: 15 },
});
