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
import { OutcomePrompts } from '@/features/ratings/OutcomePrompts';
import { PendingReviews } from '@/features/ratings/PendingReviews';
import { useMyApplications, useSavedJobs, useWithdrawApplication } from '@/features/worker/feedApi';
import { SavedJobs } from '@/features/worker/SavedJobs';
import { useUserId } from '@/providers/AuthProvider';
import { Toast } from '@/components/Toast';
import { t } from '@/i18n';

// Chip colour per status; the label is matches.status.<status> in en.json.
const STATUS_COLOR = {
  applied: '#FFE0A8',
  accepted: '#C8E6C9',
  declined: '#EEEEEE',
  withdrawn: '#EEEEEE',
  completed: '#C8E6C9',
  ended: '#E3F2FD',
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
      <OutcomePrompts onMessage={setMessage} />
      <PendingReviews onMessage={setMessage} />
      <SingleChoiceChips<View_>
        value={view}
        onChange={setView}
        options={[
          {
            key: 'messages',
            label: unread ? t('matches.messagesNew', { count: unread }) : t('matches.messages'),
          },
          { key: 'applications', label: t('matches.applications', { count: apps.data?.length ?? 0 }) },
          { key: 'saved', label: t('matches.saved', { count: saved.data?.length ?? 0 }) },
        ]}
      />
    </View>
  );

  if (view === 'messages') {
    return (
      <Screen edges={[]}>
        <ConversationList basePath="/worker/chat" header={switcher} emptyText={t('matches.messagesEmpty')} />
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

  if (apps.isPending) return <ListSkeleton label={t('matches.loading')} />;
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
            <Text variant="headlineSmall">{t('matches.emptyTitle')}</Text>
            <Text variant="bodyLarge" style={styles.center}>
              {t('matches.emptyBody')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = item.status as keyof typeof STATUS_COLOR;
          return (
            <Card mode="outlined">
              <Card.Content style={styles.card}>
                <View style={styles.row}>
                  <Text variant="titleLarge" style={styles.title}>
                    {item.title}
                  </Text>
                  <Chip style={{ backgroundColor: STATUS_COLOR[status] }}>
                    {t(`matches.status.${status}`)}
                  </Chip>
                </View>
                <Text variant="bodyLarge">
                  {item.farm_name ?? t('matches.farm')}
                  {item.locality ? ` · ${item.locality}` : ''}
                </Text>
                <Text variant="bodyLarge">{dateRangeLabel(item.start_date, item.end_date)}</Text>
                {item.work_verified ? (
                  <Text variant="bodyMedium" style={styles.verified}>
                    {t('matches.verified')}
                  </Text>
                ) : item.outcome_disputed ? (
                  <Text variant="bodyMedium">{t('matches.outcomeDisputed')}</Text>
                ) : item.status === 'ended' && item.my_answer && !item.outcome ? (
                  <Text variant="bodyMedium">{t('matches.waitingFarm')}</Text>
                ) : null}
                {item.attendance === 'left_early' ? (
                  <Text variant="bodyMedium">{t('matches.leftEarly')}</Text>
                ) : null}
                {item.attendance === 'no_show' ? (
                  <View style={styles.noShow}>
                    <Text variant="bodyLarge" style={styles.noShowText}>
                      {t('matches.noShow', { farm: item.farm_name ?? t('matches.theFarmCap') })}
                    </Text>
                    {item.disputed ? (
                      <Text variant="bodyMedium">
                        {item.dispute_outcome === 'upheld'
                          ? t('matches.disputeUpheld')
                          : t('matches.disputePending')}
                      </Text>
                    ) : (
                      <Button
                        mode="outlined"
                        icon="gavel"
                        style={styles.withdraw}
                        contentStyle={styles.tall}
                        onPress={() =>
                          setDisputing({
                            id: item.application_id,
                            farm: item.farm_name ?? t('matches.theFarm'),
                          })
                        }
                      >
                        {t('matches.dispute')}
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
                    {t('matches.withdraw')}
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
          setMessage(t('matches.disputeSent'));
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
  verified: { color: '#17482F', fontWeight: '700' },
  noShow: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 10, gap: 6, marginTop: 4 },
  noShowText: { fontWeight: '700', color: '#7A1C14' },
});
