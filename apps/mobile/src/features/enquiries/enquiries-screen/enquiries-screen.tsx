import { EmptyState } from '../../../components/empty-state';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CustomerEnquiry } from '@dealers-drive/contracts/enquiry-client';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { colors, typography } from '../../../theme/tokens';
import { enquiriesApi } from '../enquiries-api';
import { ENQUIRY_TEXT } from '../enquiries.constants';

export function EnquiriesScreen() {
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const query = useInfiniteQuery({
    queryKey: ['customer', owner, 'enquiries'],
    enabled: session.status === 'authenticated',
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return enquiriesApi.list(token, pageParam || undefined, signal);
    },
    getNextPageParam: (last) =>
      last.page.hasMore ? (last.page.nextCursor ?? undefined) : undefined,
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
      <FlatList<CustomerEnquiry>
        data={
          session.status === 'authenticated'
            ? (query.data?.pages.flatMap((page) => page.data) ?? [])
            : []
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => {
          if (session.status === 'authenticated') void query.refetch();
        }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage({ cancelRefetch: false });
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <ActionButton
              variant="secondary"
              label={ENQUIRY_TEXT.privacyControls}
              onPress={() => router.navigate('/privacy-controls')}
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
          <Pressable
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={ENQUIRY_TEXT.open(item.vehicle.title, item.dealerName)}
            onPress={() => router.navigate(`/enquiries/${item.id}`)}
          >
            <Text style={styles.heading}>{item.vehicle.title}</Text>
            <Text style={styles.text}>{item.dealerName}</Text>
            <Text style={styles.text}>
              {item.statusLabel} · {item.createdLabel}
            </Text>
            {item.sharingWithdrawn ? (
              <Text style={styles.text}>{ENQUIRY_TEXT.withdrawn}</Text>
            ) : null}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          session.status === 'authenticated' && !query.isError ? (
            query.isPending ? (
              <StatusPanel message={ENQUIRY_TEXT.loading} pending />
            ) : (
              <EmptyState
                title={ENQUIRY_TEXT.emptyTitle}
                description={ENQUIRY_TEXT.emptyBody}
                action={ENQUIRY_TEXT.emptyAction}
                onAction={() => router.navigate('/cars')}
              />
            )
          ) : session.status === 'restoring' || session.status === 'unavailable' ? (
            <StatusPanel
              message={session.error ?? AUTH_TEXT.restoring}
              pending={session.status === 'restoring'}
              retry={session.status === 'unavailable' ? () => void manager.restore() : undefined}
            />
          ) : null
        }
        ListFooterComponent={
          session.status === 'authenticated' && query.hasNextPage ? (
            <ActionButton
              label={ENQUIRY_TEXT.more}
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.page },
  content: { padding: 16, paddingBottom: 32 },
  header: { gap: 16, marginBottom: 16 },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 26, fontWeight: '800' },
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 18, fontWeight: '700' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  card: { borderWidth: 1, borderColor: colors.divider, borderRadius: 12, padding: 16, gap: 8 },
});
