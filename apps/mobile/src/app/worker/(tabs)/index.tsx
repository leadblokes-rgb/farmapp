import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Button, IconButton, Snackbar, Text } from 'react-native-paper';
import { LoadError, Loading } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import {
  activeFilterCount,
  NO_FILTERS,
  useFeed,
  useSwipe,
  useUndoSwipe,
  type FeedFilters,
  type RankedFeedJob,
} from '@/features/worker/feedApi';
import { FiltersSheet } from '@/features/worker/FiltersSheet';
import { JobDetailSheet } from '@/features/worker/JobDetailSheet';
import { SwipeDeck, type SwipeDeckHandle, type SwipeDirection } from '@/features/worker/SwipeDeck';
import { useUserId } from '@/providers/AuthProvider';

export default function Discover() {
  const userId = useUserId();
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<RankedFeedJob | null>(null);
  // Jobs swiped this session, hidden locally while the server catches up.
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [last, setLast] = useState<{ item: RankedFeedJob; direction: SwipeDirection } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const deck = useRef<SwipeDeckHandle>(null);

  const feed = useFeed(userId, filters);
  const swipe = useSwipe();
  const undo = useUndoSwipe();

  const queue = useMemo(
    () => (feed.data ?? []).filter((r) => !swipedIds.includes(r.job.id)),
    [feed.data, swipedIds],
  );

  function handleSwiped(item: RankedFeedJob, direction: SwipeDirection) {
    setSwipedIds((ids) => [...ids, item.job.id]);
    setLast({ item, direction });
    swipe.mutate(
      { jobId: item.job.id, direction },
      {
        onSuccess: () => direction === 'like' && setMessage(`Applied to ${item.job.title}`),
        onError: (e) => {
          setSwipedIds((ids) => ids.filter((id) => id !== item.job.id));
          setMessage(e.message || 'Couldn’t save that. Check your connection.');
        },
      },
    );
  }

  function handleUndo() {
    if (!last) return;
    const { item } = last;
    undo.mutate(item.job.id, {
      onSuccess: () => {
        setSwipedIds((ids) => ids.filter((id) => id !== item.job.id));
        setLast(null);
        setMessage('Undone');
      },
      onError: (e) => setMessage(e.message),
    });
  }

  const filterCount = activeFilterCount(filters);

  return (
    <Screen edges={[]}>
      <View style={styles.toolbar}>
        <Text variant="titleMedium" style={styles.count}>
          {feed.isPending ? 'Finding jobs…' : `${queue.length} job${queue.length === 1 ? '' : 's'} for you`}
        </Text>
        <View>
          <Button
            mode="outlined"
            icon="tune"
            onPress={() => setFiltersOpen(true)}
            contentStyle={styles.filterButton}
          >
            Filters
          </Button>
          {filterCount ? <Badge style={styles.badge}>{filterCount}</Badge> : null}
        </View>
      </View>

      <View style={styles.deckArea}>
        {feed.isPending ? (
          <Loading />
        ) : feed.isError ? (
          <LoadError onRetry={() => feed.refetch()} />
        ) : queue.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="headlineSmall">You&apos;re all caught up</Text>
            <Text variant="bodyLarge" style={styles.center}>
              {filterCount
                ? 'Try widening your filters to see more jobs.'
                : 'Check back soon: farms post new jobs every day.'}
            </Text>
            <Button
              mode="contained"
              icon="refresh"
              onPress={() => {
                setSwipedIds([]);
                feed.refetch();
              }}
              contentStyle={styles.tall}
            >
              Refresh
            </Button>
          </View>
        ) : (
          <SwipeDeck ref={deck} items={queue} onSwiped={handleSwiped} onOpen={setDetail} />
        )}
      </View>

      <View style={styles.actions}>
        <IconButton
          icon="close"
          mode="outlined"
          size={40}
          iconColor="#B00020"
          style={[styles.round, styles.skip]}
          disabled={!queue.length}
          onPress={() => deck.current?.swipe('pass')}
          accessibilityLabel="Skip this job"
        />
        <IconButton
          icon="undo"
          mode="outlined"
          size={28}
          style={styles.smallRound}
          disabled={!last || undo.isPending}
          onPress={handleUndo}
          accessibilityLabel="Undo last swipe"
        />
        <IconButton
          icon="check"
          mode="contained"
          size={40}
          iconColor="#FFFFFF"
          containerColor="#1B5E20"
          style={styles.round}
          disabled={!queue.length}
          onPress={() => deck.current?.swipe('like')}
          accessibilityLabel="Apply for this job"
        />
      </View>

      <FiltersSheet
        visible={filtersOpen}
        value={filters}
        onDismiss={() => setFiltersOpen(false)}
        onApply={(f) => {
          setFilters(f);
          setFiltersOpen(false);
        }}
      />
      <JobDetailSheet
        item={detail}
        onDismiss={() => setDetail(null)}
        onDecide={(direction) => {
          setDetail(null);
          deck.current?.swipe(direction);
        }}
      />
      <Snackbar visible={message !== null} onDismiss={() => setMessage(null)} duration={2500}>
        {message}
      </Snackbar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontWeight: '700' },
  filterButton: { minHeight: 48 },
  badge: { position: 'absolute', top: -6, right: -6 },
  deckArea: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  center: { textAlign: 'center' },
  tall: { minHeight: 56 },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 28 },
  round: { width: 80, height: 80, borderRadius: 40 },
  skip: { borderColor: '#B00020', borderWidth: 2 },
  smallRound: { width: 56, height: 56, borderRadius: 28 },
});
