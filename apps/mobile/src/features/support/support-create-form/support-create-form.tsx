import { useDiscardChanges } from '../../navigation/use-discard-changes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateSupportTicketInput,
  SupportTicketCategory,
  SUPPORT_CATEGORY_LABELS,
  ENQUIRY_RELATED_CATEGORIES,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_DESCRIPTION_MAX,
} from '@dealers-drive/contracts/support-client';
import { Uuid } from '@dealers-drive/contracts/common';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { enquiriesApi } from '../../enquiries/enquiries-api';
import { SUPPORT_TEXT } from '../support.constants';
import { supportApi } from '../support-api';
import { RetryIdentity } from '../retry-identity';
import { SelectionField } from '../../../components/selection-field';
import { SelectionSheet } from '../../../components/selection-sheet';

export function SupportCreateForm() {
  const params = useLocalSearchParams<{
    category?: string;
    subject?: string;
    enquiryId?: string;
  }>();
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const cache = useQueryClient();
  const initial = SupportTicketCategory.safeParse(params.category);
  const [category, setCategory] = useState<SupportTicketCategory | ''>(
    initial.success ? initial.data : '',
  );
  const [subject, setSubject] = useState(
    (typeof params.subject === 'string' ? params.subject : '').slice(0, SUPPORT_SUBJECT_MAX),
  );
  const [description, setDescription] = useState('');
  const [enquiryId, setEnquiryId] = useState(
    Uuid.safeParse(params.enquiryId).success ? params.enquiryId : '',
  );
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [disclosureOpen, setDisclosureOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const retry = useRef(new RetryIdentity());
  const completed = useRef(false);
  useDiscardChanges(
    Boolean(description.trim()) || subject !== (params.subject ?? '').slice(0, SUPPORT_SUBJECT_MAX),
    busy,
    () => completed.current,
  );
  const asks = category !== '' && ENQUIRY_RELATED_CATEGORIES.includes(category);
  const enquiries = useQuery({
    queryKey: ['customer', owner, 'support-enquiry-options'],
    enabled: session.status === 'authenticated' && asks,
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return enquiriesApi.list(token, undefined, signal);
    },
  });
  const selected = useQuery({
    queryKey: ['customer', owner, 'enquiry', enquiryId],
    enabled: session.status === 'authenticated' && asks && Boolean(enquiryId),
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return enquiriesApi.one(token, enquiryId ?? '', signal);
    },
  });
  useEffect(() => {
    if (
      (enquiries.error instanceof ApiError && enquiries.error.status === 401) ||
      (selected.error instanceof ApiError && selected.error.status === 401)
    )
      if (manager.getSnapshot().customer?.id === owner) void manager.invalidate();
  }, [enquiries.error, selected.error, manager, owner]);
  const submit = async () => {
    if (lock.current) return;
    const token = manager.token();
    const customer = manager.getSnapshot().customer?.id;
    if (!token || !customer) {
      router.navigate('/sign-in');
      return;
    }
    if (!SupportTicketCategory.safeParse(category).success) {
      setError('Choose an issue category.');
      return;
    }
    const parsed = CreateSupportTicketInput.safeParse({
      category,
      subject,
      description,
      ...(asks && enquiryId ? { enquiryId } : {}),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? SUPPORT_TEXT.failed);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const input = { ...parsed.data, clientRequestId: retry.current.forPayload(parsed.data) };
      const result = await supportApi.create(token, input);
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      retry.current.clear();
      void cache.invalidateQueries({ queryKey: ['customer', customer, 'support-tickets'] });
      cache.setQueryData(['customer', customer, 'support-ticket', result.id], result);
      completed.current = true;
      router.replace(`/support-requests/${result.id}`);
    } catch (failure) {
      if (manager.getSnapshot().customer?.id !== customer || manager.token() !== token) return;
      setError(
        failure instanceof ApiError &&
          ['REQUEST_TIMEOUT', 'NETWORK_UNAVAILABLE', 'INVALID_RESPONSE'].includes(failure.code)
          ? SUPPORT_TEXT.createUncertain
          : failure instanceof Error
            ? failure.message
            : SUPPORT_TEXT.failed,
      );
      if (failure instanceof ApiError && failure.status === 401) await manager.invalidate();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <Page title={SUPPORT_TEXT.create} showTitle={false}>
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
              <SelectionField
                label={SUPPORT_TEXT.category}
                value={category ? SUPPORT_CATEGORY_LABELS[category] : undefined}
                placeholder={SUPPORT_TEXT.categoryPlaceholder}
                disabled={busy}
                expanded={categoryOpen}
                onPress={() => setCategoryOpen(true)}
              />
              <Text style={styles.text}>{SUPPORT_TEXT.subject}</Text>
              <TextInput
                accessibilityLabel={SUPPORT_TEXT.subject}
                value={subject}
                onChangeText={setSubject}
                maxLength={SUPPORT_SUBJECT_MAX}
                editable={!busy}
                style={styles.input}
              />
              <Text style={styles.text}>{SUPPORT_TEXT.description}</Text>
              <TextInput
                accessibilityLabel={SUPPORT_TEXT.description}
                value={description}
                onChangeText={setDescription}
                maxLength={SUPPORT_DESCRIPTION_MAX}
                editable={!busy}
                style={[styles.input, styles.multiline]}
                multiline
              />
              {asks ? (
                <>
                  <Text style={styles.text}>{SUPPORT_TEXT.related}</Text>
                  <Text style={styles.text}>{SUPPORT_TEXT.recentEnquiries}</Text>
                  {selected.data ? (
                    <Text style={styles.text}>
                      {selected.data.vehicle.title} · {selected.data.dealerName}
                    </Text>
                  ) : null}
                  <ActionButton
                    variant="secondary"
                    disabled={busy}
                    label={SUPPORT_TEXT.none}
                    onPress={() => setEnquiryId('')}
                  />
                  {enquiries.data?.data.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.option}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: enquiryId === item.id, disabled: busy }}
                      disabled={busy}
                      onPress={() => setEnquiryId(item.id)}
                    >
                      <Text style={styles.text}>
                        {item.vehicle.title} · {item.dealerName} · {item.createdLabel}
                      </Text>
                    </Pressable>
                  ))}
                  {enquiries.isError ? (
                    <StatusPanel
                      message={enquiries.error.message}
                      retry={() => void enquiries.refetch()}
                    />
                  ) : null}
                  {selected.isError ? (
                    <StatusPanel
                      message={selected.error.message}
                      retry={() => void selected.refetch()}
                    />
                  ) : null}
                </>
              ) : null}
              <Text style={styles.text}>
                Tell us what happened. Avoid passwords, OTPs and payment details.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: disclosureOpen }}
                onPress={() => setDisclosureOpen((value) => !value)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Text style={styles.text}>{SUPPORT_TEXT.disclosureToggle}</Text>
              </Pressable>
              {disclosureOpen ? <Text style={styles.text}>{SUPPORT_TEXT.disclosure}</Text> : null}
              <ActionButton
                variant="ghost"
                label={AUTH_TEXT.privacy}
                onPress={() => router.navigate('/policy/privacy')}
              />
              {error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {error}
                </Text>
              ) : null}
              <ActionButton
                label={SUPPORT_TEXT.create}
                pending={busy}
                onPress={() => void submit()}
              />
              <ActionButton
                variant="secondary"
                label={SUPPORT_TEXT.requests}
                onPress={() => router.navigate('/support-requests')}
              />
            </>
          )}
        </Page>
        {categoryOpen ? (
          <SelectionSheet
            title={SUPPORT_TEXT.categoryTitle}
            value={category || undefined}
            options={SupportTicketCategory.options.map((value) => ({
              value,
              label: SUPPORT_CATEGORY_LABELS[value],
            }))}
            onClose={() => setCategoryOpen(false)}
            onSelect={(value) => {
              const parsed = SupportTicketCategory.safeParse(value);
              if (parsed.success) {
                setCategory(parsed.data);
                setError(null);
                setCategoryOpen(false);
              }
            }}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 20, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 14,
    fontFamily: typography.family,
    color: colors.ink,
    fontSize: 15,
    minHeight: 48,
  },
  multiline: { minHeight: 150, textAlignVertical: 'top' },
  option: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 12,
    minHeight: 48,
  },
  selected: { borderColor: colors.ink, backgroundColor: colors.surface },
  error: { fontFamily: typography.family, color: colors.error, fontSize: 15 },
});
