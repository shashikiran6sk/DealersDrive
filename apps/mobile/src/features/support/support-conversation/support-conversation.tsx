import { useDiscardChanges } from '../../navigation/use-discard-changes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  SupportMessageInput,
  SUPPORT_MESSAGE_MAX,
  type SupportMessage,
} from '@dealers-drive/contracts/support-client';
import { Uuid } from '@dealers-drive/contracts/common';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  KeyboardAvoidingView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { supportApi } from '../support-api';
import { SUPPORT_TEXT } from '../support.constants';
import { RetryIdentity } from '../retry-identity';
import { SupportMessageBubble } from '../support-message';

export function SupportConversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const cache = useQueryClient();
  const [active, setActive] = useState(
    AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
  );
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  useDiscardChanges(Boolean(message.trim()), busy);
  const retry = useRef(new RetryIdentity());
  const valid = Uuid.safeParse(id).success;
  const query = useQuery({
    queryKey: ['customer', owner, 'support-ticket', id],
    enabled: session.status === 'authenticated' && valid,
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return supportApi.one(token, id, signal);
    },
    refetchInterval: active ? 15000 : false,
  });
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      query.error.status === 401 &&
      manager.getSnapshot().customer?.id === owner
    )
      void manager.invalidate();
  }, [query.error, manager, owner]);
  const missing = !valid || (query.error instanceof ApiError && query.error.status === 404);
  const ticket = session.status === 'authenticated' && !missing ? query.data : undefined;
  const mutate = async (reopen: boolean) => {
    if (lock.current) return;
    const token = manager.token();
    const customer = manager.getSnapshot().customer?.id;
    if (!token || !customer) {
      router.navigate('/sign-in');
      return;
    }
    const parsed = SupportMessageInput.safeParse({ message });
    if (!reopen && !parsed.success) {
      setNotice(parsed.error.issues[0]?.message ?? SUPPORT_TEXT.failed);
      return;
    }
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = reopen
        ? await supportApi.reopen(token, id)
        : await supportApi.reply(token, id, {
            message: parsed.success ? parsed.data.message : '',
            clientMessageId: retry.current.forPayload({
              message: parsed.success ? parsed.data.message : '',
            }),
          });
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      await cache.cancelQueries({ queryKey: ['customer', customer, 'support-ticket', id] });
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      cache.setQueryData(['customer', customer, 'support-ticket', id], result);
      void cache.invalidateQueries({ queryKey: ['customer', customer, 'support-tickets'] });
      if (reopen) setNotice(SUPPORT_TEXT.reopened);
      else {
        setMessage('');
        retry.current.clear();
      }
    } catch (error) {
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      setNotice(
        error instanceof ApiError &&
          ['REQUEST_TIMEOUT', 'NETWORK_UNAVAILABLE', 'INVALID_RESPONSE'].includes(error.code)
          ? SUPPORT_TEXT.replyUncertain
          : error instanceof Error
            ? error.message
            : SUPPORT_TEXT.failed,
      );
      if (error instanceof ApiError && error.status === 401) await manager.invalidate();
      else void query.refetch();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <FlatList<SupportMessage>
          data={ticket?.messages ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.content}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          windowSize={7}
          refreshing={query.isRefetching}
          onRefresh={() => {
            if (session.status === 'authenticated' && valid) void query.refetch();
          }}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.heading}>
                {ticket ? `${ticket.reference} · ${ticket.subject}` : SUPPORT_TEXT.requests}
              </Text>
              {session.status === 'guest' ? (
                <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
              ) : ticket ? (
                <>
                  <Text style={styles.text}>
                    {ticket.categoryLabel} · {ticket.statusLabel}
                  </Text>
                  <Text style={styles.text}>{ticket.description}</Text>
                  {ticket.enquiry ? (
                    <ActionButton
                      variant="secondary"
                      label={SUPPORT_TEXT.enquiry}
                      onPress={() => router.navigate(`/enquiries/${ticket.enquiry?.id}`)}
                    />
                  ) : null}
                  <ActionButton
                    variant="secondary"
                    label={SUPPORT_TEXT.refresh}
                    onPress={() => void query.refetch()}
                  />
                  {query.isError ? (
                    <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
                  ) : null}
                </>
              ) : (
                <StatusPanel
                  message={
                    missing
                      ? SUPPORT_TEXT.missing
                      : (session.error ?? query.error?.message ?? SUPPORT_TEXT.loading)
                  }
                  pending={
                    !missing &&
                    (session.status === 'restoring' ||
                      (session.status === 'authenticated' && query.isPending))
                  }
                  retry={
                    session.status === 'unavailable'
                      ? () => void manager.restore()
                      : !missing && query.isError
                        ? () => void query.refetch()
                        : undefined
                  }
                />
              )}
            </View>
          }
          renderItem={({ item }) => <SupportMessageBubble message={item} />}
          ListFooterComponent={
            ticket ? (
              <View style={styles.footer}>
                {ticket.canReply ? (
                  <>
                    <Text style={styles.text}>{SUPPORT_TEXT.reply}</Text>
                    {ticket.remainingMessages !== undefined ? (
                      <Text accessibilityLiveRegion="polite" style={styles.text}>
                        {SUPPORT_TEXT.remaining(ticket.remainingMessages)}
                      </Text>
                    ) : null}
                    <TextInput
                      accessibilityLabel={SUPPORT_TEXT.reply}
                      value={message}
                      onChangeText={setMessage}
                      maxLength={SUPPORT_MESSAGE_MAX}
                      multiline
                      editable={!busy}
                      style={styles.input}
                    />
                    <ActionButton
                      label={SUPPORT_TEXT.send}
                      pending={busy}
                      disabled={!message.trim() || ticket.remainingMessages === 0}
                      onPress={() => void mutate(false)}
                    />
                  </>
                ) : (
                  <Text style={styles.text}>
                    {ticket.status === 'CLOSED'
                      ? SUPPORT_TEXT.closed
                      : ticket.canReopen
                        ? SUPPORT_TEXT.resolved
                        : SUPPORT_TEXT.limited}
                  </Text>
                )}
                {ticket.canReopen ? (
                  <ActionButton
                    label={SUPPORT_TEXT.reopen}
                    pending={busy}
                    onPress={() => void mutate(true)}
                  />
                ) : null}
                {notice ? (
                  <Text accessibilityRole="alert" style={styles.text}>
                    {notice}
                  </Text>
                ) : null}
                <ActionButton
                  variant="secondary"
                  label={SUPPORT_TEXT.create}
                  onPress={() => router.navigate('/support-requests/new')}
                />
              </View>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 20 },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 23, fontWeight: '800' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  footer: { gap: 16, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 15,
  },
});
