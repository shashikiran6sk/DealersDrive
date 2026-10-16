import { useInfiniteQuery } from '@tanstack/react-query';
import type { SavedVehicle } from '@dealers-drive/contracts/saved';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '../../../components/action-button';
import { CarCard } from '../../../components/car-card';
import { StatusPanel } from '../../../components/status-panel';
import { useAuth, useSession } from '../../auth/auth-provider';
import { SavedAccessScreen } from '../../auth/saved-access-screen';
import { ApiError } from '../../../services/api';
import { colors, spacing, typography } from '../../../theme/tokens';
import { savedApi } from '../saved-api';
import { SAVED_TEXT } from '../saved.constants';
import { useSaved } from '../saved-provider';
import { EmptyState } from '../../../components/empty-state';

export function SavedScreen() {
  const { manager } = useAuth();
  const session = useSession();
  const router = useRouter();
  const owner = session.customer?.id;
  const saved = useSaved();
  const query = useInfiniteQuery({
    queryKey: ['customer', owner, 'saved-list'],
    enabled: session.status === 'authenticated',
    refetchOnWindowFocus: () => !saved.updating,
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const token = manager.token();
      if (!token) throw new ApiError('AUTH_REQUIRED', 'Sign in to continue.', 401);
      return savedApi.list(token, pageParam || undefined, signal);
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
  useEffect(() => {
    const action = manager.pending.peek();
    if (session.status === 'authenticated' && owner && action?.intent.kind === 'saved')
      manager.pending.consume(action.id, owner);
  }, [session.status, owner, manager]);
  if (session.status !== 'authenticated') return <SavedAccessScreen />;
  return (
    <View style={styles.root}>
      <FlatList<SavedVehicle>
        data={query.data?.pages.flatMap((page) => page.data) ?? []}
        keyExtractor={(item) => item.vehicle.slug}
        contentContainerStyle={styles.content}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => {
          if (!saved.updating) void query.refetch();
        }}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage)
            void query.fetchNextPage({ cancelRefetch: false });
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {SAVED_TEXT.title}
            </Text>
            {query.isError ? (
              <StatusPanel message={query.error.message} retry={() => void query.refetch()} />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CarCard
            car={item.vehicle}
            onOpen={() =>
              router.navigate({ pathname: '/car/[slug]', params: { slug: item.vehicle.slug } })
            }
            onDealer={() =>
              router.navigate(`/dealers/${encodeURIComponent(item.vehicle.dealer.slug)}`)
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          !query.isError ? (
            query.isPending || saved.updating ? (
              <StatusPanel pending message={SAVED_TEXT.loading} />
            ) : (
              <EmptyState
                icon="heart"
                title="Build your shortlist"
                description="Tap the heart on a car to keep it here and compare your options."
                action="Explore cars"
                onAction={() => router.navigate('/cars')}
              />
            )
          ) : null
        }
        ListFooterComponent={
          query.hasNextPage ? (
            <ActionButton
              label={SAVED_TEXT.loadMore}
              pending={query.isFetchingNextPage}
              onPress={() => void query.fetchNextPage({ cancelRefetch: false })}
            />
          ) : null
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.md, marginBottom: spacing.lg },
  title: { fontFamily: typography.family, color: colors.ink, fontSize: 26, fontWeight: '800' },
});
