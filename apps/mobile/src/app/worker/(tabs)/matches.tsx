import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { LoadError } from '@/components/Loading';
import { useConversations } from '@/features/chat/api';
import { ConversationList } from '@/features/chat/ConversationList';
import { Screen } from '@/components/Screen';
import { ListSkeleton } from '@/components/Skeleton';
import { dateRangeLabel } from '@/features/jobs/format';
import { DisputeDialog } from '@/features/ratings/DisputeDialog';
import { PendingReviews } from '@/features/ratings/PendingReviews';
import { useMyApplications, useSavedJobs, useWithdrawApplication } from '@/features/worker/feedApi';
import { SavedJobs } from '@/features/worker/SavedJobs';
import { useUserId } from '@/providers/AuthProvider';
import { Toast } from '@/components/Toast';

const STATUS = {
  applied: { label: 'Applied', color: '#FFE0A8' },
  accepted: { label: 'Accepted 🎉', color: '#C8E6C9' },
  declined: { label: 'Not this time', color: '#EEEEEE' },
  withdrawn: { label: 'Withdrawn', color: '#EEEEEE' },
  completed: { label: 'Completed', color: '#C8E6C9' },
} as const;

type View_ = 'messages' | 'applications' | 'saved';

export default function Matches() {
  const userId = useUserId();
  const apps = useMyApplications();
  const saved = useSavedJobs(userId);
  const withdraw = useWithdrawApplication();
  const conversations = useConversations();
  const unread = (conversations.data ?? []).reduce((n, c) => n + c.unread, 0);
  const [view, setView] = useState<View_>('messages');
  const [message, setMessage] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<{ id: string; farm: string } | null>(null);

  const switcher = (
    <View style={styles.switcher}>
      <PendingReviews onMessage={setMessage} />
      <SingleChoiceChips<View_>
        value={view}
        onChange={setView}
        options={[
          { key: 'messages', label: unread ? `Messages (${unread} new)` : 'Messages' },
          { key: 'applications', label: `Applications (${apps.data?.length ?? 0})` },
          { key: 'saved', label: `Saved (${saved.data?.length ?? 0})` },
        ]}
      />
    </View>
  );

  if (view === 'messages') {
    return (
      <Screen edges={[]}>
        <ConversationList
          basePath="/worker/chat"
          header={switcher}
          emptyText="No messages yet. When a farm messages you or accepts your application, the chat appears here."
        />
        <Toast message={message} onDismiss={() => setMessage(null)} />
      </Screen>
    );
  }

  if (view === 'saved') {
    return (
      <Screen edges={[]}>
        <SavedJobs userId={userId} header={switcher} onMessage={setMessage} />
        <Toast message={message} onDismiss={() => setMessage(null)} />
      </Screen>
    );
  }

  if (apps.isPending) return <ListSkeleton label="Loading your matches" />;
  if (apps.isError) return <LoadError onRetry={() => apps.refetch()} />;

  return (
    <Screen edges={[]}>
      <FlatList
        data={apps.data}
        keyExtractor={(a) => a.application_id}
        contentContainerStyle={styles.list}
        refreshing={apps.isRefetching}
        onRefresh={() => apps.refetch()}
        ListHeaderComponent={switcher}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="headlineSmall">No applications yet</Text>
            <Text variant="bodyLarge" style={styles.center}>
              Swipe right on jobs in Discover to apply. Farms review applicants and reply in Messages.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const s = STATUS[item.status];
          return (
            <Card mode="outlined">
              <Card.Content style={styles.card}>
                <View style={styles.row}>
                  <Text variant="titleLarge" style={styles.title}>
                    {item.title}
                  </Text>
                  <Chip style={{ backgroundColor: s.color }}>{s.label}</Chip>
                </View>
                <Text variant="bodyLarge">
                  {item.farm_name ?? 'Farm'}
                  {item.locality ? ` · ${item.locality}` : ''}
                </Text>
                <Text variant="bodyLarge">{dateRangeLabel(item.start_date, item.end_date)}</Text>
                {item.attendance === 'left_early' ? (
                  <Text variant="bodyMedium">The farm marked you as leaving early.</Text>
                ) : null}
                {item.attendance === 'no_show' ? (
                  <View style={styles.noShow}>
                    <Text variant="bodyLarge" style={styles.noShowText}>
                      {item.farm_name ?? 'The farm'} marked you as a no-show.
                    </Text>
                    {item.disputed ? (
                      <Text variant="bodyMedium">
                        {item.dispute_outcome === 'upheld'
                          ? 'The Croppr team reviewed your dispute and the no-show stands.'
                          : 'You disputed this. The Croppr team is looking into it.'}
                      </Text>
                    ) : (
                      <Button
                        mode="outlined"
                        icon="gavel"
                        style={styles.withdraw}
                        contentStyle={styles.tall}
                        onPress={() =>
                          setDisputing({ id: item.application_id, farm: item.farm_name ?? 'the farm' })
                        }
                      >
                        Not right? Dispute it
                      </Button>
                    )}
                  </View>
                ) : null}
                {item.status === 'applied' ? (
                  <Button
                    mode="text"
                    textColor="#B00020"
                    style={styles.withdraw}
                    contentStyle={styles.tall}
                    loading={withdraw.isPending && withdraw.variables === item.application_id}
                    onPress={() => withdraw.mutate(item.application_id)}
                  >
                    Withdraw application
                  </Button>
                ) : null}
              </Card.Content>
            </Card>
          );
        }}
      />
      <DisputeDialog
        target={disputing}
        onDismiss={() => setDisputing(null)}
        onDone={() => {
          setDisputing(null);
          setMessage('Dispute sent. The Croppr team will look into it.');
        }}
      />
      <Toast message={message} onDismiss={() => setMessage(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, flexGrow: 1 },
  switcher: { paddingBottom: 8 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 48 },
  center: { textAlign: 'center' },
  card: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontWeight: '700' },
  withdraw: { alignSelf: 'flex-start' },
  tall: { minHeight: 48 },
  noShow: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 10, gap: 6, marginTop: 4 },
  noShowText: { fontWeight: '700', color: '#7A1C14' },
});
