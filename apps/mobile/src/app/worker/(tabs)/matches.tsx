import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, Text } from 'react-native-paper';
import { SingleChoiceChips } from '@/components/form/SingleChoiceChips';
import { LoadError, Loading } from '@/components/Loading';
import { useConversations } from '@/features/chat/api';
import { ConversationList } from '@/features/chat/ConversationList';
import { Screen } from '@/components/Screen';
import { dateRangeLabel } from '@/features/jobs/format';
import { useMyApplications, useWithdrawApplication } from '@/features/worker/feedApi';

const STATUS = {
  applied: { label: 'Applied', color: '#FFE0A8' },
  accepted: { label: 'Accepted 🎉', color: '#C8E6C9' },
  declined: { label: 'Not this time', color: '#EEEEEE' },
  withdrawn: { label: 'Withdrawn', color: '#EEEEEE' },
  completed: { label: 'Completed', color: '#C8E6C9' },
} as const;

type View_ = 'messages' | 'applications';

export default function Matches() {
  const apps = useMyApplications();
  const withdraw = useWithdrawApplication();
  const conversations = useConversations();
  const unread = (conversations.data ?? []).reduce((n, c) => n + c.unread, 0);
  const [view, setView] = useState<View_>('messages');

  const switcher = (
    <View style={styles.switcher}>
      <SingleChoiceChips<View_>
        value={view}
        onChange={setView}
        options={[
          { key: 'messages', label: unread ? `Messages (${unread} new)` : 'Messages' },
          { key: 'applications', label: `Applications (${apps.data?.length ?? 0})` },
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
      </Screen>
    );
  }

  if (apps.isPending) return <Loading />;
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
              Swipe right on jobs in Discover to apply. Farms review applicants and reply here; chat arrives
              in milestone 5.
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
});
