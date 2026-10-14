import { useQuery } from '@tanstack/react-query';
import { Uuid } from '@dealers-drive/contracts/common';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { Page } from '../../../components/page';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { colors, typography } from '../../../theme/tokens';
import { enquiriesApi } from '../enquiries-api';
import { enquiryCarSlug } from '../enquiry-input';
import { ENQUIRY_TEXT } from '../enquiries.constants';
import { WithdrawButton } from '../withdraw-button';

export function EnquiryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const valid = Uuid.safeParse(id).success;
  const query = useQuery({
    queryKey: ['customer', owner, 'enquiry', id],
    enabled: session.status === 'authenticated' && valid,
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return enquiriesApi.one(token, id, signal);
    },
  });
  useEffect(() => {
    if (
      query.error instanceof ApiError &&
      query.error.status === 401 &&
      manager.getSnapshot().customer?.id === owner
    )
      void manager.invalidate();
  }, [query.error, manager, owner]);
  const enquiry = session.status === 'authenticated' ? query.data : undefined;
  const slug = enquiryCarSlug(enquiry?.vehicle.href ?? null);
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Page title={enquiry?.vehicle.title ?? ENQUIRY_TEXT.history}>
        <ActionButton
          variant="ghost"
          label={ENQUIRY_TEXT.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/enquiries'))}
        />
        {session.status === 'guest' ? (
          <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
        ) : enquiry ? (
          <>
            <Text style={styles.text}>{enquiry.dealerName}</Text>
            <Text style={styles.text}>
              {enquiry.statusLabel} · {enquiry.createdLabel}
            </Text>
            {enquiry.message ? <Text style={styles.text}>{enquiry.message}</Text> : null}
            {slug ? (
              <ActionButton
                variant="secondary"
                label={ENQUIRY_TEXT.viewCar}
                onPress={() => router.navigate({ pathname: '/car/[slug]', params: { slug } })}
              />
            ) : null}
            {enquiry.sharingWithdrawn ? (
              <Text style={styles.text}>{ENQUIRY_TEXT.withdrawn}</Text>
            ) : (
              <WithdrawButton
                key={`${owner}:${id}`}
                id={id}
                grant={false}
                dealershipScope={Boolean(enquiry.sharingGrantId)}
              />
            )}
          </>
        ) : (
          <StatusPanel
            message={
              !valid
                ? ENQUIRY_TEXT.failed
                : (session.error ?? query.error?.message ?? ENQUIRY_TEXT.loading)
            }
            pending={
              session.status === 'restoring' ||
              (session.status === 'authenticated' && query.isPending && valid)
            }
            retry={
              session.status === 'unavailable'
                ? () => void manager.restore()
                : valid && query.isError
                  ? () => void query.refetch()
                  : undefined
            }
          />
        )}
        <ActionButton
          variant="secondary"
          label={ENQUIRY_TEXT.privacyControls}
          onPress={() => router.navigate('/privacy-controls')}
        />
      </Page>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  text: { fontFamily: typography.family, fontSize: 15, color: colors.ink, lineHeight: 24 },
});
