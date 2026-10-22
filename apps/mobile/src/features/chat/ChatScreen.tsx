import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { IconButton, Snackbar, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadError, Loading } from '@/components/Loading';
import { useUserId } from '@/providers/AuthProvider';
import { MIN_TAP } from '@/theme';
import { markRead, useConversations, useMessages, useSendMessage, type Message } from './api';
import { ReportDialog } from './ReportDialog';
import { friendlyError } from '@/lib/errors';

function time(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const hm = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return sameDay ? hm : `${d.getDate()}/${d.getMonth() + 1} ${hm}`;
}

export function ChatScreen({ conversationId }: { conversationId: string }) {
  const userId = useUserId();
  const conversations = useConversations();
  const messages = useMessages(conversationId);
  const send = useSendMessage(conversationId, userId);
  const [draft, setDraft] = useState('');
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const convo = conversations.data?.find((c) => c.conversation_id === conversationId);
  const newest = messages.data?.[0]?.id;

  // Mark the other person's messages read whenever new ones arrive while the chat is open.
  useEffect(() => {
    markRead(conversationId).then(() => conversations.refetch());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, newest]);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    send.mutate(body, {
      onError: (e) => {
        setDraft(body);
        setNotice(friendlyError(e));
      },
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: convo?.other_name ?? 'Chat',
          headerRight: () => (
            <IconButton icon="flag-outline" accessibilityLabel="Report" onPress={() => setReporting(true)} />
          ),
        }}
      />
      {convo ? (
        <Text variant="bodyMedium" style={styles.context}>
          {convo.job_title} · {convo.application_status === 'accepted' ? 'Accepted' : 'Applied'}
        </Text>
      ) : null}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {messages.isPending ? (
          <Loading />
        ) : messages.isError ? (
          <LoadError onRetry={() => messages.refetch()} />
        ) : (
          <FlatList
            inverted
            data={messages.data}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>Say hello 👋</Text>}
            renderItem={({ item }) => <Bubble m={item} mine={item.sender_id === userId} />}
          />
        )}
        <View style={styles.composer}>
          <TextInput
            mode="outlined"
            placeholder="Message"
            accessibilityLabel="Message"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={2000}
            style={styles.input}
          />
          <IconButton
            icon="send"
            mode="contained"
            size={28}
            containerColor="#17482F"
            iconColor="#FFFFFF"
            style={styles.send}
            onPress={submit}
            disabled={!draft.trim()}
            accessibilityLabel="Send message"
          />
        </View>
      </KeyboardAvoidingView>
      <ReportDialog
        visible={reporting}
        subject={convo?.other_name ?? 'this person'}
        conversationId={conversationId}
        onDismiss={() => setReporting(false)}
        onDone={() => {
          setReporting(false);
          setNotice('Thanks. The Croppr team will review your report.');
        }}
      />
      <Snackbar visible={notice !== null} onDismiss={() => setNotice(null)} duration={3500}>
        {notice}
      </Snackbar>
    </SafeAreaView>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text variant="bodyLarge" style={mine ? styles.mineText : undefined}>
        {m.body}
      </Text>
      <Text style={[styles.meta, mine && styles.mineMeta]}>
        {time(m.created_at)}
        {mine && m.read_at ? ' · Seen' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  context: { textAlign: 'center', paddingVertical: 6, backgroundColor: '#F1F8E9' },
  list: { padding: 12, gap: 8 },
  empty: { textAlign: 'center', opacity: 0.6, padding: 24, transform: [{ scaleY: -1 }] },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: 'flex-end', backgroundColor: '#17482F', borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#EEEEEE', borderBottomLeftRadius: 4 },
  mineText: { color: '#FFFFFF' },
  meta: { fontSize: 12, marginTop: 4, opacity: 0.7 },
  mineMeta: { color: '#FFFFFF', textAlign: 'right' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 8,
    borderTopWidth: 1,
    borderColor: '#E0E0E0',
  },
  input: { flex: 1, maxHeight: 140, fontSize: 18 },
  send: { width: MIN_TAP, height: MIN_TAP, borderRadius: MIN_TAP / 2 },
});
