import { useInfiniteQuery } from '@tanstack/react-query';
import type { SupportTicketRow } from '@dealers-drive/contracts/support-client';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/action-button';
import { StatusPanel } from '../../../components/status-panel';
import { ApiError } from '../../../services/api';
import { colors, typography } from '../../../theme/tokens';
import { useAuth, useSession } from '../../auth/auth-provider';
import { AUTH_TEXT } from '../../auth/auth.constants';
import { supportApi } from '../support-api';
import { SUPPORT_TEXT } from '../support.constants';

export function SupportListScreen() {
  const { manager } = useAuth();
  const session = useSession();
  const owner = session.customer?.id;
  const router = useRouter();
  const query = useInfiniteQuery({
    queryKey: ['customer', owner, 'support-tickets'],
    enabled: session.status === 'authenticated',
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', AUTH_TEXT.login, 401);
      return supportApi.list(token, pageParam || undefined, signal);
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <FlatList<SupportTicketRow>
        data={
          session.status === 'authenticated'
            ? (query.data?.pages.flatMap((page) => page.data) ?? [])
            : []
        }
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        initialNumToRender={8}
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
            <Text accessibilityRole="header" style={styles.heading}>
              {SUPPORT_TEXT.requests}
            </Text>
            <ActionButton
              variant="ghost"
              label={SUPPORT_TEXT.back}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/support'))}
            />
            <ActionButton
              label={SUPPORT_TEXT.create}
              onPress={() => router.navigate('/support-requests/new')}
            />
            {session.status === 'guest' ? (
              <ActionButton label={AUTH_TEXT.login} onPress={() => router.navigate('/sign-in')} />
            ) : null}
            {session.status === 'authenticated' && query.isError ? (
              <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={SUPPORT_TEXT.open(item.reference, item.subject)}
            style={styles.card}
            onPress={() => router.navigate(`/support-requests/${item.id}`)}
          >
            <Text style={styles.title}>
              {item.reference} · {item.subject}
            </Text>
            <Text style={styles.text}>{item.categoryLabel}</Text>
            <Text style={styles.text}>
              {item.statusLabel} · {item.updatedLabel}
            </Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListEmptyComponent={
          session.status === 'authenticated' && !query.isError ? (
            <StatusPanel
              message={query.isPending ? SUPPORT_TEXT.loading : SUPPORT_TEXT.empty}
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
        ListFooterComponent={
          session.status === 'authenticated' && query.hasNextPage ? (
            <ActionButton
              label={SUPPORT_TEXT.more}
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
  heading: { fontFamily: typography.family, color: colors.ink, fontSize: 25, fontWeight: '800' },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 18, fontWeight: '700' },
  text: { fontFamily: typography.family, color: colors.ink, fontSize: 15, lineHeight: 24 },
  card: { padding: 16, gap: 8, borderWidth: 1, borderColor: colors.divider, borderRadius: 12 },
});
