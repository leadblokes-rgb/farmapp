import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Badge, Button, IconButton, Text } from 'react-native-paper';
import { LoadError } from '@/components/Loading';
import { Screen } from '@/components/Screen';
import { CardSkeleton } from '@/components/Skeleton';
import {
  activeFilterCount,
  NO_FILTERS,
  useFeed,
  useSaveJob,
  useSwipe,
  useUndoSwipe,
  type FeedFilters,
  type RankedFeedJob,
} from '@/features/worker/feedApi';
import { FiltersSheet } from '@/features/worker/FiltersSheet';
import { ReportDialog } from '@/features/chat/ReportDialog';
import { JobDetailSheet } from '@/features/worker/JobDetailSheet';
import { SwipeDeck, type SwipeDeckHandle, type SwipeDirection } from '@/features/worker/SwipeDeck';
import { useUserId } from '@/providers/AuthProvider';
import { friendlyError } from '@/lib/errors';
import { Toast } from '@/components/Toast';
import { t } from '@/i18n';

export default function Discover() {
  const userId = useUserId();
  const [filters, setFilters] = useState<FeedFilters>(NO_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<RankedFeedJob | null>(null);
  const [reporting, setReporting] = useState<RankedFeedJob | null>(null);
  // Jobs swiped this session, hidden locally while the server catches up.
  const [swipedIds, setSwipedIds] = useState<string[]>([]);
  const [last, setLast] = useState<{ item: RankedFeedJob; direction: SwipeDirection } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const deck = useRef<SwipeDeckHandle>(null);

  const feed = useFeed(userId, filters);
  const swipe = useSwipe();
  const undo = useUndoSwipe();
  const save = useSaveJob(userId);

  const queue = useMemo(
    () => (feed.data ?? []).filter((r) => !swipedIds.includes(r.job.id)),
    [feed.data, swipedIds],
  );

  function handleSwiped(item: RankedFeedJob, direction: SwipeDirection) {
    setSwipedIds((ids) => [...ids, item.job.id]);
    setLast({ item, direction });
    const restore = (e: unknown) => {
      setSwipedIds((ids) => ids.filter((id) => id !== item.job.id));
      setMessage(friendlyError(e));
    };
    if (direction === 'save') {
      save.mutate(
        { jobId: item.job.id, saved: true },
        { onSuccess: () => setMessage(t('discover.savedForLater')), onError: restore },
      );
      return;
    }
    swipe.mutate(
      { jobId: item.job.id, direction },
      {
        onSuccess: () => direction === 'like' && setMessage(t('discover.applied', { title: item.job.title })),
        onError: restore,
      },
    );
  }

  function handleUndo() {
    if (!last) return;
    const { item, direction } = last;
    const onSuccess = () => {
      setSwipedIds((ids) => ids.filter((id) => id !== item.job.id));
      setLast(null);
      setMessage(t('discover.undone'));
    };
    const onError = (e: unknown) => setMessage(friendlyError(e));
    if (direction === 'save') save.mutate({ jobId: item.job.id, saved: false }, { onSuccess, onError });
    else undo.mutate(item.job.id, { onSuccess, onError });
  }

  const filterCount = activeFilterCount(filters);

  return (
    <Screen edges={[]}>
      <View style={styles.toolbar}>
        <Text variant="titleMedium" style={styles.count}>
          {feed.isPending ? t('discover.finding') : t('discover.count', { count: queue.length })}
        </Text>
        <View>
          <Button
            mode="outlined"
            icon="tune"
            onPress={() => setFiltersOpen(true)}
            contentStyle={styles.filterButton}
          >
            {t('discover.filters')}
          </Button>
          {filterCount ? <Badge style={styles.badge}>{filterCount}</Badge> : null}
        </View>
      </View>

      <View style={styles.deckArea}>
        {feed.isPending ? (
          <CardSkeleton />
        ) : feed.isError ? (
          <LoadError onRetry={() => feed.refetch()} />
        ) : queue.length === 0 ? (
          <View style={styles.empty}>
            <Text variant="headlineSmall">{t('discover.caughtUp')}</Text>
            <Text variant="bodyLarge" style={styles.center}>
              {filterCount ? t('discover.widen') : t('discover.checkBack')}
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
              {t('discover.refresh')}
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
          accessibilityLabel={t('discover.skip')}
        />
        <IconButton
          icon="undo"
          mode="outlined"
          size={28}
          style={styles.smallRound}
          disabled={!last || undo.isPending || save.isPending}
          onPress={handleUndo}
          accessibilityLabel={t('discover.undo')}
        />
        <IconButton
          icon="bookmark-outline"
          mode="outlined"
          size={28}
          style={styles.smallRound}
          disabled={!queue.length}
          onPress={() => deck.current?.swipe('save')}
          accessibilityLabel={t('discover.save')}
        />
        <IconButton
          icon="check"
          mode="contained"
          size={40}
          iconColor="#FFFFFF"
          containerColor="#17482F"
          style={styles.round}
          disabled={!queue.length}
          onPress={() => deck.current?.swipe('like')}
          accessibilityLabel={t('discover.apply')}
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
        onReport={(item) => {
          setDetail(null);
          setReporting(item);
        }}
        onDecide={(direction) => {
          setDetail(null);
          deck.current?.swipe(direction);
        }}
        onSave={() => {
          setDetail(null);
          deck.current?.swipe('save');
        }}
      />
      <ReportDialog
        visible={reporting !== null}
        subject={reporting ? t('saved.quoted', { title: reporting.job.title }) : t('saved.job')}
        jobId={reporting?.job.id}
        onDismiss={() => setReporting(null)}
        onDone={() => {
          setReporting(null);
          setMessage(t('chat.reported'));
        }}
      />
      <Toast message={message} onDismiss={() => setMessage(null)} duration={2500} />
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
