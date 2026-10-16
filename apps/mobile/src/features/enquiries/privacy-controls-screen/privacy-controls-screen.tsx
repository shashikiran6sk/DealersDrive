import { useQuery } from '@tanstack/react-query';
import type { SharingPermissions } from '@dealers-drive/contracts/legal-client';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { colors, typography } from '../../../theme/tokens';
import { enquiriesApi } from '../enquiries-api';
import { ENQUIRY_TEXT } from '../enquiries.constants';
import { WithdrawButton } from '../withdraw-button';

export function PrivacyControlsScreen() {
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const query = useQuery({
    queryKey: ['customer', owner, 'sharing-permissions'],
    enabled: session.status === 'authenticated',
    queryFn: ({ signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return enquiriesApi.permissions(token, signal);
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
  return (
    <SafeAreaView style={styles.root} edges={['bottom']}>
      <FlatList<SharingPermissions['data'][number]>
        data={session.status === 'authenticated' ? (query.data?.data ?? []) : []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        windowSize={7}
        refreshing={query.isRefetching}
        onRefresh={() => {
          if (session.status === 'authenticated') void query.refetch();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.heading}>
              {ENQUIRY_TEXT.privacyControls}
            </Text>
            <Text style={styles.text}>{ENQUIRY_TEXT.withdrawBody}</Text>
            <ActionButton
              variant="secondary"
              label={ENQUIRY_TEXT.agreements}
              onPress={() => router.navigate('/agreements')}
            />
            <ActionButton
              variant="secondary"
              label={ENQUIRY_TEXT.history}
              onPress={() => router.navigate('/enquiries')}
            />
            {session.status === 'guest' ? (
              <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
            ) : null}
            {query.isError && session.status === 'authenticated' ? (
              <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.text}>{item.dealerName}</Text>
            <Text style={styles.text}>{new Date(item.grantedAt).toLocaleString('en-IN')}</Text>
            <Text style={styles.text}>{ENQUIRY_TEXT.permissionVersion(item.noticeVersion)}</Text>
            <WithdrawButton key={`${owner}:${item.id}`} id={item.id} grant />
          </View>
        )}
        ListEmptyComponent={
          session.status === 'authenticated' && !query.isError ? (
            <StatusPanel
              message={query.isPending ? ENQUIRY_TEXT.loading : ENQUIRY_TEXT.emptyPermissions}
              pending={query.isPending}
            />
          ) : session.status === 'restoring' || session.status === 'unavailable' ? (
            <StatusPanel
              message={session.error ?? AUTH_TEXT.restoring}
              pending={session.status === 'restoring'}
              retry={session.status === 'unavailable' ? () => void manager.restore() : undefined}
            />
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 16 },
  heading: { fontFamily: typography.family, fontSize: 24, fontWeight: '800', color: colors.ink },
  text: { fontFamily: typography.family, fontSize: 15, lineHeight: 24, color: colors.ink },
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 16, gap: 12 },
});
