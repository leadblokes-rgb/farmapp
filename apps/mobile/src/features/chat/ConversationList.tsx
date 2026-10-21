import { router, type Href } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Badge, List, Text } from 'react-native-paper';
import { useConversations } from './api';

interface Props {
  basePath: '/worker/chat' | '/farm/chat';
  header?: React.ReactElement;
  emptyText: string;
}

export function ConversationList({ basePath, header, emptyText }: Props) {
  const conversations = useConversations();
  return (
    <FlatList
      data={conversations.data ?? []}
      keyExtractor={(c) => c.conversation_id}
      refreshing={conversations.isRefetching}
      onRefresh={() => conversations.refetch()}
      ListHeaderComponent={header}
      ListEmptyComponent={
        conversations.isPending ? undefined : (
          <Text variant="bodyLarge" style={styles.empty}>
            {emptyText}
          </Text>
        )
      }
      renderItem={({ item }) => (
        <List.Item
          title={item.other_name}
          titleStyle={[styles.title, item.unread > 0 && styles.bold]}
          description={`${item.job_title}\n${item.last_message ?? 'No messages yet'}`}
          descriptionNumberOfLines={2}
          descriptionStyle={styles.desc}
          style={styles.row}
          onPress={() => router.push(`${basePath}/${item.conversation_id}` as Href)}
          left={(p) => (
            <List.Icon
              {...p}
              icon={item.application_status === 'accepted' ? 'account-check' : 'account-clock'}
            />
          )}
          right={() =>
            item.unread > 0 ? (
              <View style={styles.badge}>
                <Badge size={26}>{item.unread}</Badge>
              </View>
            ) : null
          }
          accessibilityLabel={`Chat with ${item.other_name}${item.unread ? `, ${item.unread} unread` : ''}`}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#DDDDDD' },
  title: { fontSize: 18 },
  bold: { fontWeight: '800' },
  desc: { fontSize: 15 },
  badge: { justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 32, opacity: 0.7 },
});
